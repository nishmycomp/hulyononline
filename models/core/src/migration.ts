//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { saveCollabJson } from '@hcengineering/collaboration'
import core, {
  buildSocialIdString,
  configUserAccountUuid,
  coreId,
  DOMAIN_MODEL_TX,
  DOMAIN_SPACE,
  DOMAIN_STATUS,
  DOMAIN_TX,
  generateId,
  groupByArray,
  makeCollabJsonId,
  makeCollabYdocId,
  makeDocCollabId,
  RateLimiter,
  SocialIdType,
  systemAccountUuid,
  toIdMap,
  TxProcessor,
  type AccountUuid,
  type AnyAttribute,
  type AttachedDoc,
  type Blob,
  type Class,
  type Doc,
  type Domain,
  type PersonId,
  type Ref,
  type Role,
  type SocialKey,
  type Space,
  type SpaceType,
  type Status,
  type TxCreateDoc,
  type TxCUD,
  type TxMixin,
  type TxUpdateDoc,
  type TypedSpace
} from '@hcengineering/core'
import {
  createDefaultSpace,
  tryMigrate,
  tryUpgrade,
  type MigrateMode,
  type MigrateOperation,
  type MigrateUpdate,
  type MigrationClient,
  type MigrationDocumentQuery,
  type MigrationIterator,
  type MigrationUpgradeClient
} from '@hcengineering/model'
import { type StorageAdapter } from '@hcengineering/storage'

async function migrateStatusesToModel (client: MigrationClient, mode: MigrateMode): Promise<void> {
  // Move statuses to model:
  // Migrate the default ones with well-known ids as system's model
  // And the rest as user's model
  // Skip __superseded statuses
  const allStatuses = await client.find<Status>(DOMAIN_STATUS, {
    _class: core.class.Status,
    __superseded: { $exists: false }
  })

  for (const status of allStatuses) {
    const isSystem = (status as any).__migratedFrom !== undefined
    const modifiedBy =
      status.modifiedBy === core.account.System
        ? isSystem
          ? core.account.System
          : core.account.ConfigUser
        : status.modifiedBy

    const tx: TxCreateDoc<Status> = {
      _id: generateId(),
      _class: core.class.TxCreateDoc,
      space: core.space.Tx,
      objectId: status._id,
      objectClass: status._class,
      objectSpace: core.space.Model,
      attributes: {
        ofAttribute: status.ofAttribute,
        category: status.category,
        name: status.name,
        color: status.color,
        description: status.description
      },
      modifiedOn: status.modifiedOn,
      createdBy: status.createdBy,
      createdOn: status.createdOn,
      modifiedBy
    }

    await client.create(DOMAIN_TX, tx)
  }
}

async function migrateAllSpaceToTyped (client: MigrationClient): Promise<void> {
  await client.update(
    DOMAIN_SPACE,
    {
      _id: core.space.Space,
      _class: core.class.Space
    },
    {
      _class: core.class.TypedSpace,
      type: core.spaceType.SpacesType
    }
  )
}

async function migrateSpacesOwner (client: MigrationClient): Promise<void> {
  const targetClasses = client.hierarchy.getDescendants(core.class.Space)
  const targetSpaces = await client.find<Space>(DOMAIN_SPACE, {
    _class: { $in: targetClasses },
    owners: { $exists: false }
  })

  for (const space of targetSpaces) {
    await client.update(
      DOMAIN_SPACE,
      {
        _id: space._id
      },
      {
        owners: [space.createdBy]
      }
    )
  }
}

async function migrateStatusTransactions (client: MigrationClient): Promise<void> {
  await client.update(
    DOMAIN_TX,
    {
      objectClass: core.class.Status,
      'attributes.title': { $exists: true }
    },
    {
      $rename: { 'attributes.title': 'attributes.name' }
    }
  )
  await client.update(
    DOMAIN_TX,
    {
      objectClass: core.class.Status,
      'operations.title': { $exists: true }
    },
    {
      $rename: { 'operations.title': 'operations.name' }
    }
  )
}

async function migrateCollaborativeContentToStorage (client: MigrationClient): Promise<void> {
  const storageAdapter = client.storageAdapter

  const hierarchy = client.hierarchy
  const classes = hierarchy.getDescendants(core.class.Doc)
  for (const _class of classes) {
    const domain = hierarchy.findDomain(_class)
    if (domain === undefined) continue

    const allAttributes = hierarchy.getAllAttributes(_class)
    const attributes = Array.from(allAttributes.values()).filter((attribute) => {
      return hierarchy.isDerived(attribute.type._class, core.class.TypeCollaborativeDoc)
    })

    if (attributes.length === 0) continue
    if (hierarchy.isMixin(_class) && attributes.every((p) => p.attributeOf !== _class)) continue

    const query = hierarchy.isMixin(_class) ? { [_class]: { $exists: true } } : { _class }

    const iterator = await client.traverse(domain, query)
    try {
      client.logger.log('processing', { _class })
      await processMigrateContentFor(domain, attributes, client, storageAdapter, iterator)
    } finally {
      await iterator.close()
    }
  }
}

async function processMigrateContentFor (
  domain: Domain,
  attributes: AnyAttribute[],
  client: MigrationClient,
  storageAdapter: StorageAdapter,
  iterator: MigrationIterator<Doc>
): Promise<void> {
  const hierarchy = client.hierarchy

  const rateLimiter = new RateLimiter(10)

  let processed = 0

  while (true) {
    const docs = await iterator.next(1000)
    if (docs === null || docs.length === 0) {
      break
    }

    const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []

    for (const doc of docs) {
      await rateLimiter.add(async () => {
        const update: MigrateUpdate<Doc> = {}

        for (const attribute of attributes) {
          const value = hierarchy.isMixin(attribute.attributeOf)
            ? ((doc as any)[attribute.attributeOf]?.[attribute.name] as string)
            : ((doc as any)[attribute.name] as string)

          const attributeName = hierarchy.isMixin(attribute.attributeOf)
            ? `${attribute.attributeOf}.${attribute.name}`
            : attribute.name

          const collabId = makeDocCollabId(doc, attribute.name)
          const blobId = makeCollabJsonId(collabId)

          if (value != null && value.startsWith('{')) {
            try {
              const buffer = Buffer.from(value)
              await storageAdapter.put(client.ctx, client.wsIds, blobId, buffer, 'application/json', buffer.length)
            } catch (err: any) {
              client.logger.error('failed to process document', {
                _class: doc._class,
                _id: doc._id,
                err: err.message,
                stack: err.stack
              })
            }

            update[attributeName] = blobId
          } else if (value == null || value === '') {
            update[attributeName] = null
          }
        }

        if (Object.keys(update).length > 0) {
          operations.push({ filter: { _id: doc._id }, update })
        }
      })
    }

    await rateLimiter.waitProcessing()

    if (operations.length > 0) {
      await client.bulk(domain, operations)
    }

    processed += docs.length
    client.logger.log('...processed', { count: processed })
  }
}

export async function migrateBackupMixins (client: MigrationClient): Promise<void> {
  // Go via classes with domain and check if mixin exists and need to flush %hash%
  const hierarchy = client.hierarchy
  const curHash = Date.now().toString(16) // Current hash value

  const txIterator = await client.traverse<TxMixin<Doc, AttachedDoc>>(DOMAIN_TX, { _class: core.class.TxMixin })

  try {
    while (true) {
      const mixinOps = await txIterator.next(500)
      if (mixinOps === null || mixinOps.length === 0) break
      const _classes = groupByArray(mixinOps, (it) => it.objectClass)

      for (const [_class, ops] of _classes.entries()) {
        const domain = hierarchy.findDomain(_class)
        if (domain === undefined) continue
        let docs = await client.find(domain, { _id: { $in: ops.map((it) => it.objectId) } })

        docs = docs.filter((it) => {
          // Check if mixin is last operation by modifiedOn
          const mops = ops.filter((mi) => mi.objectId === it._id)
          if (mops.length === 0) return false
          return mops.some((mi) => mi.modifiedOn === it.modifiedOn && mi.modifiedBy === it.modifiedBy)
        })

        if (docs.length > 0) {
          // Check if docs has mixins from list
          const toUpdate = docs.filter((it) => hierarchy.findAllMixins(it).length > 0)
          if (toUpdate.length > 0) {
            await client.update(domain, { _id: { $in: toUpdate.map((it) => it._id) } }, { '%hash%': curHash })
          }
        }
      }
    }
  } finally {
    await txIterator.close()
  }
}

async function migrateCollaborativeDocsToJson (client: MigrationClient): Promise<void> {
  const storageAdapter = client.storageAdapter

  const hierarchy = client.hierarchy
  const classes = hierarchy.getDescendants(core.class.Doc)
  for (const _class of classes) {
    const domain = hierarchy.findDomain(_class)
    if (domain === undefined) continue

    const allAttributes = hierarchy.getAllAttributes(_class)
    const attributes = Array.from(allAttributes.values()).filter((attribute) => {
      return hierarchy.isDerived(attribute.type._class, core.class.TypeCollaborativeDoc)
    })

    if (attributes.length === 0) continue
    if (hierarchy.isMixin(_class) && attributes.every((p) => p.attributeOf !== _class)) continue

    const query = hierarchy.isMixin(_class) ? { [_class]: { $exists: true } } : { _class }

    const iterator = await client.traverse(domain, query)
    try {
      client.logger.log('processing', { _class })
      await processMigrateJsonForDomain(domain, attributes, client, storageAdapter, iterator)
    } finally {
      await iterator.close()
    }
  }
}

export function getAccountsFromTxes (accTxes: TxCUD<Doc>[]): any {
  const byAccounts = accTxes.reduce<Record<string, TxCUD<Doc>[]>>((acc, tx) => {
    if (acc[tx.objectId] === undefined) {
      acc[tx.objectId] = []
    }

    acc[tx.objectId].push(tx)
    return acc
  }, {})

  return Object.values(byAccounts)
    .map((txes) => TxProcessor.buildDoc2Doc(txes))
    .filter((it) => it != null)
}

export async function getSocialKeyByOldAccount (client: MigrationClient): Promise<Record<string, string>> {
  const systemAccounts = [core.account.System, core.account.ConfigUser]
  const accountsTxes: TxCUD<Doc>[] = await client.find<TxCUD<Doc>>(DOMAIN_MODEL_TX, {
    objectClass: { $in: ['core:class:Account', 'contact:class:PersonAccount'] as Ref<Class<Doc>>[] }
  })
  const accounts = getAccountsFromTxes(accountsTxes)

  const socialKeyByAccount: Record<string, string> = {}
  for (const account of accounts) {
    if (account.email === undefined) {
      continue
    }

    if (systemAccounts.includes(account._id)) {
      socialKeyByAccount[account._id] = account._id
    } else {
      socialKeyByAccount[account._id] = buildSocialIdString(getSocialKeyByOldEmail(account.email)) as any
    }
  }

  return socialKeyByAccount
}

export function getSocialKeyByOldEmail (rawEmail: string): SocialKey {
  const email = rawEmail.toLowerCase()
  let type: SocialIdType
  let value: string
  if (email.startsWith('github:')) {
    type = SocialIdType.GITHUB
    value = email.slice(7)
  } else if (email.startsWith('openid:')) {
    type = SocialIdType.OIDC
    value = email.slice(7)
  } else {
    type = SocialIdType.EMAIL
    value = email
  }

  return {
    type,
    value
  }
}

/**
 * Migrates old accounts to new accounts/social ids.
 * Should be applied to prodcution directly without applying migrateSpaceMembersToAccountUuids
 * @param client
 * @returns
 */
async function migrateAccounts (client: MigrationClient): Promise<void> {
  const hierarchy = client.hierarchy
  const socialKeyByAccount = await getSocialKeyByOldAccount(client)
  const socialIdBySocialKey = new Map<string, PersonId | null>()
  const socialIdByOldAccount = new Map<string, PersonId | null>()

  client.logger.log('migrating createdBy and modifiedBy', {})
  function chunkArray<T> (array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  for (const domain of client.hierarchy.domains()) {
    client.logger.log('processing domain ', { domain })
    const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []
    const groupByCreated = await client.groupBy<any, Doc>(domain, 'createdBy', {})
    const groupByModified = await client.groupBy<any, Doc>(domain, 'modifiedBy', {})

    for (const accId of groupByCreated.keys()) {
      if (accId == null) continue
      const socialId = await getSocialIdFromOldAccount(
        client,
        accId,
        socialKeyByAccount,
        socialIdBySocialKey,
        socialIdByOldAccount
      )
      if (socialId == null || accId === socialId) continue

      operations.push({
        filter: { createdBy: accId },
        update: {
          createdBy: socialId
        }
      })
    }

    for (const accId of groupByModified.keys()) {
      if (accId == null) continue
      const socialId = await getSocialIdFromOldAccount(
        client,
        accId,
        socialKeyByAccount,
        socialIdBySocialKey,
        socialIdByOldAccount
      )
      if (socialId == null || accId === socialId) continue

      operations.push({
        filter: { modifiedBy: accId },
        update: {
          modifiedBy: socialId
        }
      })
    }

    if (operations.length > 0) {
      const operationsChunks = chunkArray(operations, 40)
      client.logger.log('chunks to process ', { total: operationsChunks.length })
      let processed = 0
      for (const operationsChunk of operationsChunks) {
        if (operationsChunk.length === 0) continue

        await client.bulk(domain, operationsChunk)
        processed++
        if (operationsChunks.length > 1) {
          client.logger.log('processed chunk', { processed, of: operationsChunks.length })
        }
      }
    } else {
      client.logger.log('no user accounts to migrate', {})
    }
  }

  client.logger.log('finished migrating createdBy and modifiedBy', {})

  const spaceTypes = client.model.findAllSync(core.class.SpaceType, {})
  const spaceTypesById = toIdMap(spaceTypes)
  const roles = client.model.findAllSync(core.class.Role, {})
  const rolesBySpaceType = new Map<Ref<SpaceType>, Role[]>()
  for (const role of roles) {
    const spaceType = role.attachedTo
    if (spaceType === undefined) continue
    if (rolesBySpaceType.has(spaceType)) {
      rolesBySpaceType.get(spaceType)?.push(role)
    } else {
      rolesBySpaceType.set(spaceType, [role])
    }
  }

  const accountUuidBySocialKey = new Map<string, AccountUuid | null>()

  client.logger.log('processing spaces members, owners and roles assignment', {})
  let processedSpaces = 0
  const spacesIterator = await client.traverse(DOMAIN_SPACE, {})

  try {
    while (true) {
      const spaces = await spacesIterator.next(200)
      if (spaces === null || spaces.length === 0) {
        break
      }

      const operations: { filter: MigrationDocumentQuery<Space>, update: MigrateUpdate<Space> }[] = []

      for (const s of spaces) {
        if (!hierarchy.isDerived(s._class, core.class.Space)) continue
        const space = s as Space

        const newMembers = await getUniqueAccountsFromOldAccounts(
          client,
          space.members,
          socialKeyByAccount,
          accountUuidBySocialKey
        )
        const newOwners = await getUniqueAccountsFromOldAccounts(
          client,
          space.owners ?? [],
          socialKeyByAccount,
          accountUuidBySocialKey
        )
        const update: MigrateUpdate<Space> = {
          members: newMembers as any,
          owners: newOwners as any
        }

        const type = spaceTypesById.get((space as TypedSpace).type)

        if (type !== undefined) {
          const mixin = hierarchy.as(space, type.targetClass)
          if (mixin !== undefined) {
            const roles = rolesBySpaceType.get(type._id)

            for (const role of roles ?? []) {
              const oldAssignees: string[] | undefined = (mixin as any)[role._id]
              if (oldAssignees != null && oldAssignees.length > 0) {
                const newAssignees = await getUniqueAccountsFromOldAccounts(
                  client,
                  oldAssignees,
                  socialKeyByAccount,
                  accountUuidBySocialKey
                )

                if (update[`${type.targetClass}`] == null) {
                  update[`${type.targetClass}`] = {}
                }
                update[`${type.targetClass}`][role._id] = newAssignees
              }
            }
          }
        }

        operations.push({
          filter: { _id: space._id },
          update
        })
      }

      if (operations.length > 0) {
        await client.bulk(DOMAIN_SPACE, operations)
      }

      processedSpaces += spaces.length
      client.logger.log('...spaces processed', { count: processedSpaces })
    }

    client.logger.log('finished processing spaces members, owners and roles assignment', { processedSpaces })
  } finally {
    await spacesIterator.close()
  }

  client.logger.log('processing space types members', {})
  let updatedSpaceTypes = 0
  for (const spaceType of spaceTypes) {
    if (spaceType.members === undefined || spaceType.members.length === 0) continue

    const newMembers = await getUniqueAccountsFromOldAccounts(
      client,
      spaceType.members,
      socialKeyByAccount,
      accountUuidBySocialKey
    )
    const tx: TxUpdateDoc<SpaceType> = {
      _id: generateId(),
      _class: core.class.TxUpdateDoc,
      space: core.space.Tx,
      objectId: spaceType._id,
      objectClass: spaceType._class,
      objectSpace: spaceType.space,
      operations: {
        members: newMembers as any
      },
      modifiedOn: Date.now(),
      createdBy: core.account.ConfigUser,
      createdOn: Date.now(),
      modifiedBy: core.account.ConfigUser
    }

    await client.create(DOMAIN_MODEL_TX, tx)
    updatedSpaceTypes++
  }
  client.logger.log('finished processing space types members', {
    totalSpaceTypes: spaceTypes.length,
    updatedSpaceTypes
  })
}

export async function getAccountUuidBySocialKey (
  client: MigrationClient,
  socialKey: string,
  accountUuidBySocialKey: Map<string, AccountUuid | null>
): Promise<AccountUuid | null> {
  if (socialKey === core.account.System) {
    return systemAccountUuid
  }

  if (socialKey === core.account.ConfigUser) {
    return configUserAccountUuid
  }

  const cached = accountUuidBySocialKey.has(socialKey)

  if (!cached) {
    const personUuid = await client.accountClient.findPersonBySocialKey(socialKey)
    if (personUuid === undefined) {
      console.log('Could not find person for', socialKey)
    }

    accountUuidBySocialKey.set(socialKey, (personUuid as AccountUuid | undefined) ?? null)
  }

  return accountUuidBySocialKey.get(socialKey) ?? null
}

export async function getUniqueAccounts (
  client: MigrationClient,
  socialKeys: string[],
  accountUuidBySocialKey = new Map<string, AccountUuid | null>()
): Promise<AccountUuid[]> {
  const accounts = new Set<AccountUuid>()
  for (const person of socialKeys) {
    let newAccount = await getAccountUuidBySocialKey(client, person, accountUuidBySocialKey)

    if (newAccount == null && isUuid(person)) {
      newAccount = person as unknown as AccountUuid
    }
    if (newAccount != null) {
      accounts.add(newAccount)
    }
  }

  return Array.from(accounts)
}

export async function getAccountUuidByOldAccount (
  client: MigrationClient,
  oldAccount: string,
  socialKeyByOldAccount: Record<string, string>,
  accountUuidByOldAccount: Map<string, AccountUuid | null>
): Promise<AccountUuid | null> {
  if (oldAccount === core.account.System) {
    return systemAccountUuid
  }

  if (oldAccount === core.account.ConfigUser) {
    return configUserAccountUuid
  }

  const cached = accountUuidByOldAccount.has(oldAccount)

  if (!cached) {
    const socialKey = socialKeyByOldAccount[oldAccount]
    if (socialKey == null) {
      accountUuidByOldAccount.set(oldAccount, null)
      return null
    }

    const personUuid = await client.accountClient.findPersonBySocialKey(socialKey)

    accountUuidByOldAccount.set(oldAccount, (personUuid as AccountUuid | undefined) ?? null)
  }

  return accountUuidByOldAccount.get(oldAccount) ?? null
}

export async function getSocialIdBySocialKey (
  client: MigrationClient,
  socialKey: string,
  socialIdBySocialKey?: Map<string, PersonId | null>
): Promise<PersonId | null> {
  if ([core.account.System, core.account.ConfigUser].includes(socialKey as PersonId)) {
    return socialKey as PersonId
  }

  if (socialIdBySocialKey == null || !socialIdBySocialKey.has(socialKey)) {
    const val = (await client.accountClient.findSocialIdBySocialKey(socialKey)) ?? null
    if (socialIdBySocialKey == null) return val

    socialIdBySocialKey.set(socialKey, val)
  }

  return socialIdBySocialKey.get(socialKey) ?? null
}

export async function getSocialIdFromOldAccount (
  client: MigrationClient,
  oldAccount: string,
  socialKeyByOldAccount: Record<string, string>,
  socialIdBySocialKey: Map<string, PersonId | null>,
  socialIdByOldAccount: Map<string, PersonId | null>
): Promise<PersonId | null> {
  if (!socialIdByOldAccount.has(oldAccount)) {
    const socialKey = socialKeyByOldAccount[oldAccount]
    if (socialKey == null) return null

    socialIdByOldAccount.set(oldAccount, await getSocialIdBySocialKey(client, socialKey, socialIdBySocialKey))
  }

  return socialIdByOldAccount.get(oldAccount) ?? null
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function isUuid (val: string): boolean {
  return uuidRegex.test(val)
}

export async function getUniqueAccountsFromOldAccounts (
  client: MigrationClient,
  oldAccounts: string[],
  socialKeyByOldAccount: Record<string, string>,
  accountUuidByOldAccount: Map<string, AccountUuid | null> = new Map<string, AccountUuid | null>()
): Promise<AccountUuid[]> {
  const accounts = new Set<AccountUuid>()
  for (const oldAcc of oldAccounts) {
    let newAccount = await getAccountUuidByOldAccount(client, oldAcc, socialKeyByOldAccount, accountUuidByOldAccount)

    if (newAccount == null && isUuid(oldAcc)) {
      newAccount = oldAcc as unknown as AccountUuid
    }

    if (newAccount != null) {
      accounts.add(newAccount)
    }
  }

  return Array.from(accounts)
}

async function processMigrateJsonForDomain (
  domain: Domain,
  attributes: AnyAttribute[],
  client: MigrationClient,
  storageAdapter: StorageAdapter,
  iterator: MigrationIterator<Doc>
): Promise<void> {
  const rateLimiter = new RateLimiter(10)

  let processed = 0

  while (true) {
    const docs = await iterator.next(100)
    if (docs === null || docs.length === 0) {
      break
    }

    const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []

    for (const doc of docs) {
      await rateLimiter.add(async () => {
        const update = await processMigrateJsonForDoc(doc, attributes, client, storageAdapter)
        if (Object.keys(update).length > 0) {
          operations.push({ filter: { _id: doc._id }, update })
        }
      })
    }

    await rateLimiter.waitProcessing()

    if (operations.length > 0) {
      await client.bulk(domain, operations)
    }

    processed += docs.length
    client.logger.log('...processed', { count: processed })
  }
}

async function processMigrateJsonForDoc (
  doc: Doc,
  attributes: AnyAttribute[],
  client: MigrationClient,
  storageAdapter: StorageAdapter
): Promise<MigrateUpdate<Doc>> {
  const { hierarchy, wsIds } = client

  const update: MigrateUpdate<Doc> = {}

  for (const attribute of attributes) {
    const value = hierarchy.isMixin(attribute.attributeOf)
      ? ((doc as any)[attribute.attributeOf]?.[attribute.name] as string)
      : ((doc as any)[attribute.name] as string)

    if (value == null || value === '') {
      continue
    }

    const attributeName = hierarchy.isMixin(attribute.attributeOf)
      ? `${attribute.attributeOf}.${attribute.name}`
      : attribute.name

    const collabId = makeDocCollabId(doc, attribute.name)
    if (value.startsWith('{')) {
      // For some reason we have documents that are already markups
      const jsonId = await retry(5, async () => {
        return await saveCollabJson(client.ctx, storageAdapter, wsIds, collabId, value)
      })

      update[attributeName] = jsonId
      continue
    }

    if (!value.includes(':')) {
      // not a collaborative document, skip
      continue
    }

    // Name of existing ydoc document
    // original value here looks like '65b7f82f4d422b89d4cbdd6f:HEAD:0'
    // where the first part is the blob id
    const currentYdocId = value.split(':')[0] as Ref<Blob>

    try {
      // If document id has changed, save it with new name to ensure we will be able to load it later
      const ydocId = makeCollabYdocId(collabId)
      if (ydocId !== currentYdocId) {
        await retry(5, async () => {
          const stat = await storageAdapter.stat(client.ctx, wsIds, currentYdocId)
          if (stat !== undefined) {
            const data = await storageAdapter.read(client.ctx, wsIds, currentYdocId)
            const buffer = Buffer.concat(data as any)
            await storageAdapter.put(client.ctx, wsIds, ydocId, buffer, 'application/ydoc', buffer.length)
          }
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      client.logger.error('failed to process collaborative doc', {
        workspace: wsIds.uuid,
        collabId,
        currentYdocId,
        error
      })
    }

    const unset = update.$unset ?? {}
    update.$unset = { ...unset, [attribute.name]: 1 }
  }

  return update
}

export const coreOperation: MigrateOperation = {
  async migrate (client: MigrationClient, mode): Promise<void> {
    await tryMigrate(mode, client, coreId, [
      {
        state: 'statuses-to-model',
        mode: 'upgrade',
        func: migrateStatusesToModel
      },
      {
        state: 'all-space-to-typed',
        mode: 'upgrade',
        func: migrateAllSpaceToTyped
      },
      {
        state: 'add-spaces-owner-v1',
        mode: 'upgrade',
        func: migrateSpacesOwner
      },
      {
        state: 'old-statuses-transactions',
        mode: 'upgrade',
        func: migrateStatusTransactions
      },
      {
        state: 'collaborative-content-to-storage',
        mode: 'upgrade',
        func: migrateCollaborativeContentToStorage
      },
      {
        state: 'fix-backups-hash-timestamp-v2',
        mode: 'upgrade',
        func: async (client: MigrationClient): Promise<void> => {
          const now = Date.now().toString(16)
          for (const d of client.hierarchy.domains()) {
            await client.update(d, { '%hash%': { $in: [null, ''] } }, { '%hash%': now })
          }
        }
      },
      {
        state: 'remove-collection-txes',
        mode: 'upgrade',
        func: async (client) => {
          let processed = 0
          let last = 0
          const iterator = await client.traverse<TxCUD<Doc>>(DOMAIN_TX, {
            _class: 'core:class:TxCollectionCUD' as Ref<Class<Doc>>
          })
          try {
            while (true) {
              const txes = await iterator.next(1000)
              if (txes === null || txes.length === 0) break
              processed += txes.length
              try {
                await client.create(
                  DOMAIN_TX,
                  txes.map((tx) => {
                    const { collection, objectId, objectClass } = tx
                    return {
                      collection,
                      attachedTo: objectId,
                      attachedToClass: objectClass,
                      ...(tx as any).tx,
                      objectSpace: (tx as any).tx.objectSpace ?? tx.objectSpace
                    }
                  })
                )
                await client.deleteMany(DOMAIN_TX, {
                  _id: { $in: txes.map((it) => it._id) }
                })
              } catch (err: any) {
                console.error(err)
              }
              if (last !== Math.round(processed / 1000)) {
                last = Math.round(processed / 1000)
                console.log('processed', processed)
              }
            }
          } finally {
            await iterator.close()
          }
        }
      },
      {
        state: 'move-model-txes',
        mode: 'upgrade',
        func: async (client) => {
          await client.move(
            DOMAIN_TX,
            {
              objectSpace: core.space.Model
            },
            DOMAIN_MODEL_TX
          )
        }
      },
      {
        state: 'collaborative-docs-to-json',
        mode: 'upgrade',
        func: migrateCollaborativeDocsToJson
      },
      {
        state: 'accounts-to-social-ids',
        mode: 'upgrade',
        func: migrateAccounts
      },
      {
        state: 'clean-old-model',
        mode: 'upgrade',
        func: cleanOldModel
      },
      {
        state: 'reindex-after-elastic-mapping-change',
        mode: 'upgrade',
        func: async (client) => {
          await client.fullReindex()
        }
      }
      // ,
      // {
      //   state: 'migrate-backup-mixins',
      //   mode: 'upgrade',
      //   func: migrateBackupMixins
      // }
    ])
  },
  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>, mode): Promise<void> {
    await tryUpgrade(mode, state, client, coreId, [
      {
        state: 'create-defaults-v2',
        func: async (client) => {
          await createDefaultSpace(
            client,
            core.space.Space,
            { name: 'Spaces', description: 'Space for all spaces', type: core.spaceType.SpacesType },
            core.class.TypedSpace
          )
        }
      },
      {
        state: 'default-space',
        func: async (client) => {
          await createDefaultSpace(client, core.space.Tx, { name: 'Space for all txes' })
          await createDefaultSpace(client, core.space.DerivedTx, { name: 'Space for derived txes' })
          await createDefaultSpace(client, core.space.Model, { name: 'Space for model' })
          await createDefaultSpace(client, core.space.Configuration, { name: 'Space for config' })
          await createDefaultSpace(client, core.space.Workspace, { name: 'Space for common things' })
        }
      }
    ])
  }
}

async function retry<T> (retries: number, op: () => Promise<T>): Promise<T> {
  let error: any
  while (retries > 0) {
    retries--
    try {
      return await op()
    } catch (err: any) {
      error = err
      if (retries !== 0) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
  }
  throw error
}

async function cleanOldModel (client: MigrationClient): Promise<void> {
  await client.deleteMany(DOMAIN_MODEL_TX, {
    modifiedBy: core.account.System,
    objectClass: { $nin: ['core:class:Account', 'contact:class:PersonAccount'] }
  })
}
