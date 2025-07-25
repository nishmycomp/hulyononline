//
// Copyright © 2024 Hardcore Engineering Inc.
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
import {
  type AccountRole,
  type Data,
  type Person,
  type Version,
  type WorkspaceMemberInfo,
  type WorkspaceUuid,
  type AccountUuid,
  buildSocialIdString,
  type SocialKey
} from '@hcengineering/core'
import type {
  Collection,
  CreateIndexesOptions,
  Db,
  Filter,
  FindCursor,
  OptionalUnlessRequiredId,
  Sort as RawSort
} from 'mongodb'
import { UUID } from 'mongodb'

import type {
  Account,
  AccountDB,
  AccountEvent,
  AccountAggregatedInfo,
  DbCollection,
  Integration,
  IntegrationSecret,
  Mailbox,
  MailboxSecret,
  Operations,
  OTP,
  Query,
  SocialId,
  Sort,
  WorkspaceData,
  WorkspaceInfoWithStatus,
  WorkspaceInvite,
  WorkspaceOperation,
  WorkspaceStatus,
  WorkspaceStatusData
} from '../types'
import { isShallowEqual } from '../utils'

interface MongoIndex {
  key: Record<string, any>
  options: CreateIndexesOptions & { name: string }
}

function getFilteredQuery<T> (query: Query<T>): Query<T> {
  return Object.entries(query).reduce<Query<T>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key as keyof Query<T>] = value
    }
    return acc
  }, {})
}

export class MongoDbCollection<T extends Record<string, any>, K extends keyof T | undefined = undefined>
implements DbCollection<T> {
  constructor (
    readonly name: string,
    readonly db: Db,
    readonly idKey?: K
  ) {}

  get collection (): Collection<T> {
    return this.db.collection<T>(this.name)
  }

  /**
   * Ensures indices in the collection or creates new if needed.
   * Drops all other indices that are not in the list.
   * @param indicesToEnsure MongoIndex
   */
  async ensureIndices (indicesToEnsure: MongoIndex[]): Promise<void> {
    try {
      const indices = await this.collection.listIndexes().toArray()

      for (const idx of indices) {
        if (idx.key._id !== undefined) {
          continue
        }

        const isEqualIndex = (ensureIdx: MongoIndex): boolean => {
          const { key, options } = ensureIdx
          const sameKeys = isShallowEqual(idx.key, key)

          if (!sameKeys) {
            return false
          }

          const shortIdxOptions = { ...idx }
          delete shortIdxOptions.key
          delete shortIdxOptions.v

          return isShallowEqual(shortIdxOptions, options)
        }

        if (indicesToEnsure.some(isEqualIndex)) {
          continue
        }

        await this.collection.dropIndex(idx.name)
      }
    } catch (e: any) {
      if (e?.codeName === 'NamespaceNotFound') {
        // Nothing to do, new DB
      } else {
        throw e
      }
    }

    for (const { key, options } of indicesToEnsure) {
      await this.collection.createIndex(key, options)
    }
  }

  async exists (query: Query<T>): Promise<boolean> {
    return (await this.findOne(query)) !== null
  }

  async find (query: Query<T>, sort?: Sort<T>, limit?: number): Promise<T[]> {
    return await this.findCursor(getFilteredQuery(query), sort, limit).toArray()
  }

  findCursor (query: Query<T>, sort?: Sort<T>, limit?: number): FindCursor<T> {
    const cursor = this.collection.find<T>(getFilteredQuery(query) as Filter<T>)

    if (sort !== undefined) {
      cursor.sort(sort as RawSort)
    }

    if (limit !== undefined) {
      cursor.limit(limit)
    }

    return cursor.map((doc) => {
      if (this.idKey !== '_id') {
        delete doc._id
      }

      return doc
    })
  }

  async findOne (query: Query<T>): Promise<T | null> {
    const doc = await this.collection.findOne<T>(getFilteredQuery(query) as Filter<T>)
    if (doc === null) {
      return null
    }

    if (this.idKey !== '_id') {
      delete doc._id
    }
    return doc
  }

  async insertOne (data: Partial<T>): Promise<K extends keyof T ? T[K] : undefined> {
    const toInsert: Partial<T> & {
      _id?: string
    } = { ...data }
    const idKey = this.idKey

    if (idKey !== undefined) {
      const key = new UUID().toJSON()
      toInsert[idKey] = data[idKey] ?? (key as any)
      toInsert._id = toInsert._id ?? toInsert[idKey]
    }

    await this.collection.insertOne(toInsert as OptionalUnlessRequiredId<T>)

    return (idKey !== undefined ? toInsert[idKey] : undefined) as K extends keyof T ? T[K] : undefined
  }

  async insertMany (data: Array<Partial<T>>): Promise<K extends keyof T ? Array<T[K]> : undefined> {
    throw new Error('Not implemented')
  }

  async update (query: Query<T>, ops: Operations<T>): Promise<void> {
    const resOps: any = { $set: {} }

    for (const key of Object.keys(ops)) {
      switch (key) {
        case '$inc': {
          resOps.$inc = ops.$inc
          break
        }
        default: {
          resOps.$set[key] = ops[key]
        }
      }
    }
    await this.collection.updateMany(getFilteredQuery(query) as Filter<T>, resOps)
  }

  async deleteMany (query: Query<T>): Promise<void> {
    await this.collection.deleteMany(getFilteredQuery(query) as Filter<T>)
  }
}

export class AccountMongoDbCollection extends MongoDbCollection<Account, 'uuid'> implements DbCollection<Account> {
  constructor (db: Db) {
    super('account', db, 'uuid')
  }

  private convertToObj (acc: Account): Account {
    return {
      ...acc,
      hash: acc.hash != null ? Buffer.from(acc.hash.buffer) : acc.hash,
      salt: acc.salt != null ? Buffer.from(acc.salt.buffer) : acc.salt
    }
  }

  async find (query: Query<Account>, sort?: Sort<Account>, limit?: number): Promise<Account[]> {
    const res = await super.find(query, sort, limit)

    return res.map((acc: Account) => this.convertToObj(acc))
  }

  async findOne (query: Query<Account>): Promise<Account | null> {
    const res = await this.collection.findOne<Account>(getFilteredQuery(query) as Filter<Account>)

    return res !== null ? this.convertToObj(res) : null
  }
}

export class SocialIdMongoDbCollection extends MongoDbCollection<SocialId, '_id'> implements DbCollection<SocialId> {
  constructor (db: Db) {
    super('socialId', db, '_id')
  }

  async insertOne (data: Partial<SocialId>): Promise<any> {
    if (data.type === undefined || data.value === undefined) {
      throw new Error('Type and value are required')
    }

    return await super.insertOne({
      ...data,
      key: buildSocialIdString(data as SocialKey)
    })
  }
}

export class WorkspaceStatusMongoDbCollection implements DbCollection<WorkspaceStatus> {
  constructor (private readonly wsCollection: MongoDbCollection<WorkspaceInfoWithStatus, 'uuid'>) {}

  private toWsQuery (query: Query<WorkspaceStatus>): Query<WorkspaceInfoWithStatus> {
    const res: Query<WorkspaceInfoWithStatus> = {}

    for (const key of Object.keys(getFilteredQuery(query))) {
      const qVal = (query as any)[key]
      if (key === 'workspaceUuid') {
        res.uuid = qVal
      } else {
        if (res.status === undefined) {
          res.status = {}
        }

        ;(res.status as any)[key] = qVal
      }
    }

    return res
  }

  private toWsSort (sort?: Sort<WorkspaceStatus>): Sort<WorkspaceInfoWithStatus> | undefined {
    if (sort === undefined) {
      return undefined
    }

    const res: Sort<WorkspaceInfoWithStatus> = {
      status: {}
    }

    for (const key of Object.keys(sort)) {
      ;(res.status as any)[key] = (sort as any)[key]
    }

    return res
  }

  private toWsOperations (ops: Operations<WorkspaceStatus>): Operations<WorkspaceInfoWithStatus> {
    const res: any = {}

    for (const key of Object.keys(ops)) {
      const op = (ops as any)[key]

      if (key === '$inc') {
        res[key] = {}
        for (const opKey of Object.keys(op)) {
          res[key][`status.${opKey}`] = op[opKey]
        }
      } else if (key === '$set') {
        for (const opKey of Object.keys(op)) {
          res[`status.${opKey}`] = op[opKey]
        }
      } else {
        res[`status.${key}`] = op
      }
    }

    return res
  }

  async exists (query: Query<WorkspaceStatus>): Promise<boolean> {
    return await this.wsCollection.exists(this.toWsQuery(query))
  }

  async find (query: Query<WorkspaceStatus>, sort?: Sort<WorkspaceStatus>, limit?: number): Promise<WorkspaceStatus[]> {
    return (await this.wsCollection.find(this.toWsQuery(query), this.toWsSort(sort), limit)).map((ws) => ({
      ...ws.status,
      workspaceUuid: ws.uuid
    }))
  }

  async findOne (query: Query<WorkspaceStatus>): Promise<WorkspaceStatus | null> {
    return (await this.wsCollection.findOne(this.toWsQuery(query)))?.status ?? null
  }

  async insertOne (data: Partial<WorkspaceStatus>): Promise<any> {
    if (data.workspaceUuid === undefined) {
      throw new Error('workspaceUuid is required')
    }

    const wsData = await this.wsCollection.findOne({ uuid: data.workspaceUuid })

    if (wsData === null) {
      throw new Error(`Workspace with uuid ${data.workspaceUuid} not found`)
    }

    const statusData: any = {}

    for (const key of Object.keys(data)) {
      if (key !== 'workspaceUuid') {
        statusData[`status.${key}`] = (data as any)[key]
      }
    }

    await this.wsCollection.update({ uuid: data.workspaceUuid }, statusData)

    return data.workspaceUuid
  }

  async insertMany (data: Partial<WorkspaceStatus>[]): Promise<any> {
    throw new Error('Not implemented')
  }

  async update (query: Query<WorkspaceStatus>, ops: Operations<WorkspaceStatus>): Promise<void> {
    await this.wsCollection.update(this.toWsQuery(query), this.toWsOperations(ops))
  }

  async deleteMany (query: Query<WorkspaceStatus>): Promise<void> {
    await this.wsCollection.deleteMany(this.toWsQuery(query))
  }
}

interface WorkspaceMember {
  workspaceUuid: WorkspaceUuid
  accountUuid: AccountUuid
  role: AccountRole
}

interface Migration {
  key: string
  op: () => Promise<void>
}

interface MigrationInfo {
  key: string
  completed: boolean
  lastProcessedTime: number
}

export class MongoAccountDB implements AccountDB {
  migration: MongoDbCollection<MigrationInfo, 'key'>
  person: MongoDbCollection<Person, 'uuid'>
  socialId: SocialIdMongoDbCollection
  workspace: MongoDbCollection<WorkspaceInfoWithStatus, 'uuid'>
  workspaceStatus: WorkspaceStatusMongoDbCollection
  account: AccountMongoDbCollection
  accountEvent: MongoDbCollection<AccountEvent>
  otp: MongoDbCollection<OTP>
  invite: MongoDbCollection<WorkspaceInvite, 'id'>
  mailbox: MongoDbCollection<Mailbox, 'mailbox'>
  mailboxSecret: MongoDbCollection<MailboxSecret>
  integration: MongoDbCollection<Integration>
  integrationSecret: MongoDbCollection<IntegrationSecret>

  workspaceMembers: MongoDbCollection<WorkspaceMember>

  constructor (readonly db: Db) {
    this.migration = new MongoDbCollection<MigrationInfo, 'key'>('migration', db, 'key')
    this.person = new MongoDbCollection<Person, 'uuid'>('person', db, 'uuid')
    this.socialId = new SocialIdMongoDbCollection(db)
    this.workspace = new MongoDbCollection<WorkspaceInfoWithStatus, 'uuid'>('workspace', db, 'uuid')
    this.workspaceStatus = new WorkspaceStatusMongoDbCollection(this.workspace)
    this.account = new AccountMongoDbCollection(db)
    this.accountEvent = new MongoDbCollection<AccountEvent>('accountEvent', db)
    this.otp = new MongoDbCollection<OTP>('otp', db)
    this.invite = new MongoDbCollection<WorkspaceInvite, 'id'>('invite', db, 'id')
    this.mailbox = new MongoDbCollection<Mailbox, 'mailbox'>('mailbox', db)
    this.mailboxSecret = new MongoDbCollection<MailboxSecret>('mailboxSecrets', db)
    this.integration = new MongoDbCollection<Integration>('integration', db)
    this.integrationSecret = new MongoDbCollection<IntegrationSecret>('integrationSecret', db)

    this.workspaceMembers = new MongoDbCollection<WorkspaceMember>('workspaceMembers', db)
  }

  async init (): Promise<void> {
    // Apply all the migrations
    for (const migration of this.getMigrations()) {
      await this.migrate(migration)
    }

    await this.account.ensureIndices([
      {
        key: { uuid: 1 },
        options: { unique: true, name: 'hc_account_account_uuid_1' }
      }
    ])

    await this.socialId.ensureIndices([
      {
        key: { type: 1, value: 1 },
        options: { unique: true, name: 'hc_account_social_id_type_value_1' }
      }
    ])

    await this.workspace.ensureIndices([
      {
        key: { uuid: 1 },
        options: {
          unique: true,
          name: 'hc_account_workspace_uuid_1'
        }
      },
      {
        key: { url: 1 },
        options: {
          unique: true,
          name: 'hc_account_workspace_url_1'
        }
      }
    ])

    await this.workspaceMembers.ensureIndices([
      {
        key: { workspaceUuid: 1 },
        options: {
          name: 'hc_account_workspace_members_workspace_uuid_1'
        }
      },
      {
        key: { accountUuid: 1 },
        options: {
          name: 'hc_account_workspace_members_account_uuid_1'
        }
      }
    ])
  }

  async migrate ({ key, op }: Migration): Promise<void> {
    const { completed, exists } = await this.shouldMigrate(key)
    if (completed) {
      return
    }

    console.log(`Applying migration: ${key}`)
    if (!exists) {
      await this.migration.insertOne({ key, completed: false, lastProcessedTime: Date.now() })
    } else {
      await this.migration.update({ key }, { lastProcessedTime: Date.now() })
    }

    const processingHandle = setInterval(() => {
      void this.migration.update({ key }, { lastProcessedTime: Date.now() })
    }, 1000 * 5)
    await op()
    await this.migration.update({ key }, { completed: true, lastProcessedTime: Date.now() })
    clearInterval(processingHandle)
    console.log(`Migration ${key} completed`)
  }

  async shouldMigrate (key: string): Promise<{ completed: boolean, exists: boolean }> {
    while (true) {
      const migrationInfo = await this.migration.findOne({ key })
      if (migrationInfo?.completed === true) {
        return { completed: true, exists: true }
      }

      if (migrationInfo == null) {
        return { completed: false, exists: false }
      }

      if (migrationInfo.lastProcessedTime === undefined || Date.now() - migrationInfo.lastProcessedTime > 1000 * 15) {
        return { completed: false, exists: true }
      }

      console.log(`Migration ${key} is in progress by other process, waiting...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }

  protected getMigrations (): Migration[] {
    return [this.getV1Migration()]
  }

  // NOTE: NEVER MODIFY EXISTING MIGRATIONS. IF YOU NEED TO DO SOMETHING, ADD A NEW MIGRATION.
  private getV1Migration (): Migration {
    return {
      key: 'account_db_v1_fill_social_id_ids',
      op: async () => {
        const sidCursor = this.socialId.findCursor({})

        try {
          let sidsCount = 0
          while (await sidCursor.hasNext()) {
            const socialIdObj = await sidCursor.next()
            if (socialIdObj == null) break

            if (socialIdObj._id != null && socialIdObj._id !== socialIdObj.key) continue

            await this.socialId.deleteMany({ key: socialIdObj.key })
            const newSocialId: any = { ...socialIdObj }
            delete newSocialId._id
            await this.socialId.insertOne(newSocialId)

            sidsCount++
          }

          console.log(`Migrated ${sidsCount} social ids`)
        } finally {
          await sidCursor.close()
        }
      }
    }
  }

  async assignWorkspace (accountId: AccountUuid, workspaceId: WorkspaceUuid, role: AccountRole): Promise<void> {
    await this.workspaceMembers.insertOne({
      workspaceUuid: workspaceId,
      accountUuid: accountId,
      role
    })
  }

  async batchAssignWorkspace (data: [AccountUuid, WorkspaceUuid, AccountRole][]): Promise<void> {
    await this.workspaceMembers.insertMany(
      data.map(([accountId, workspaceId, role]) => ({
        workspaceUuid: workspaceId,
        accountUuid: accountId,
        role
      }))
    )
  }

  async unassignWorkspace (accountId: AccountUuid, workspaceId: WorkspaceUuid): Promise<void> {
    await this.workspaceMembers.deleteMany({
      workspaceUuid: workspaceId,
      accountUuid: accountId
    })
  }

  async createWorkspace (data: WorkspaceData, status: WorkspaceStatusData): Promise<WorkspaceUuid> {
    const res = await this.workspace.insertOne(data)

    await this.workspaceStatus.insertOne({
      workspaceUuid: res,
      ...status
    })

    return res
  }

  async updateAllowReadOnlyGuests (workspaceId: WorkspaceUuid, readOnlyGuestsAllowed: boolean): Promise<void> {
    await this.workspace.update(
      {
        uuid: workspaceId
      },
      { allowReadOnlyGuest: readOnlyGuestsAllowed }
    )
  }

  async updateAllowGuestSignUp (workspaceId: WorkspaceUuid, guestSignUpAllowed: boolean): Promise<void> {
    await this.workspace.update(
      {
        uuid: workspaceId
      },
      { allowGuestSignUp: guestSignUpAllowed }
    )
  }

  async getPendingWorkspace (
    region: string,
    version: Data<Version>,
    operation: WorkspaceOperation,
    processingTimeoutMs: number,
    wsLivenessMs?: number
  ): Promise<WorkspaceInfoWithStatus | undefined> {
    const pendingCreationQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      { 'status.mode': { $in: ['pending-creation', 'creating'] } }
    ]

    const migrationQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      {
        'status.mode': {
          $in: ['migration-backup', 'migration-pending-backup', 'migration-clean', 'migration-pending-clean']
        }
      }
    ]

    const archivingQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      {
        'status.mode': {
          $in: ['archiving-pending-backup', 'archiving-backup', 'archiving-pending-clean', 'archiving-clean']
        }
      }
    ]

    const deletingQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      { 'status.mode': { $in: ['pending-deletion', 'deleting'] } }
    ]
    const restoreQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      { 'status.mode': { $in: ['pending-restore', 'restoring'] } }
    ]

    const versionQuery = {
      $or: [
        { 'status.versionMajor': { $lt: version.major } },
        { 'status.versionMajor': version.major, 'status.versionMinor': { $lt: version.minor } },
        {
          'status.versionMajor': version.major,
          'status.versionMinor': version.minor,
          'status.versionPatch': { $lt: version.patch }
        }
      ]
    }
    const pendingUpgradeQuery: Filter<WorkspaceInfoWithStatus>['$or'] = [
      {
        $and: [
          {
            $or: [{ 'status.isDisabled': false }, { 'status.isDisabled': { $exists: false } }]
          },
          {
            $or: [{ 'status.mode': 'active' }, { 'status.mode': { $exists: false } }]
          },
          versionQuery,
          ...(wsLivenessMs !== undefined
            ? [
                {
                  'status.lastVisit': { $gt: Date.now() - wsLivenessMs }
                }
              ]
            : [])
        ]
      },
      {
        $or: [{ 'status.isDisabled': false }, { 'status.isDisabled': { $exists: false } }],
        'status.mode': 'upgrading'
      }
    ]
    // TODO: support returning pending deletion workspaces when we will actually want
    // to clear them with the worker.

    const defaultRegionQuery = { $or: [{ region: { $exists: false } }, { region: '' }] }
    let operationQuery: Filter<WorkspaceInfoWithStatus> = {}

    switch (operation) {
      case 'create':
        operationQuery = { $or: pendingCreationQuery }
        break
      case 'upgrade':
        operationQuery = { $or: pendingUpgradeQuery }
        break
      case 'all':
        operationQuery = { $or: [...pendingCreationQuery, ...pendingUpgradeQuery] }
        break
      case 'all+backup':
        operationQuery = {
          $or: [
            ...pendingCreationQuery,
            ...pendingUpgradeQuery,
            ...migrationQuery,
            ...archivingQuery,
            ...restoreQuery,
            ...deletingQuery
          ]
        }
        break
    }
    const attemptsQuery = {
      $or: [{ 'status.processingAttempts': { $exists: false } }, { 'status.processingAttempts': { $lte: 3 } }]
    }

    // We must have all the conditions in the DB query and we cannot filter anything in the code
    // because of possible concurrency between account services. We have to update "lastProcessingTime"
    // at the time of retrieval and not after some additional processing.
    const query: Filter<WorkspaceInfoWithStatus> = {
      $and: [
        { 'status.mode': { $ne: 'manual-creation' } },
        operationQuery,
        attemptsQuery,
        region !== '' ? { region } : defaultRegionQuery,
        {
          $or: [
            { 'status.lastProcessingTime': { $exists: false } },
            { 'status.lastProcessingTime': { $lt: Date.now() - processingTimeoutMs } }
          ]
        }
      ]
    }

    return (
      (await this.workspace.collection.findOneAndUpdate(
        query,
        {
          $inc: {
            'status.processingAttempts': 1
          },
          $set: {
            'status.lastProcessingTime': Date.now()
          }
        },
        {
          returnDocument: 'after',
          sort: {
            'status.lastVisit': -1 // Use last visit as a priority
          }
        }
      )) ?? undefined
    )
  }

  async updateWorkspaceRole (accountId: AccountUuid, workspaceId: WorkspaceUuid, role: AccountRole): Promise<void> {
    await this.workspaceMembers.update(
      {
        workspaceUuid: workspaceId,
        accountUuid: accountId
      },
      { role }
    )
  }

  async getWorkspaceRole (accountId: AccountUuid, workspaceId: WorkspaceUuid): Promise<AccountRole | null> {
    const assignment = await this.workspaceMembers.findOne({
      workspaceUuid: workspaceId,
      accountUuid: accountId
    })

    return assignment?.role ?? null
  }

  async getWorkspaceRoles (accountId: AccountUuid): Promise<Map<WorkspaceUuid, AccountRole>> {
    const assignment = await this.workspaceMembers.find({
      accountUuid: accountId
    })

    return assignment.reduce<Map<WorkspaceUuid, AccountRole>>((acc, it) => {
      acc.set(it.workspaceUuid, it.role)
      return acc
    }, new Map())
  }

  async getWorkspaceMembers (workspaceId: WorkspaceUuid): Promise<WorkspaceMemberInfo[]> {
    return (await this.workspaceMembers.find({ workspaceUuid: workspaceId })).map((wmi) => ({
      person: wmi.accountUuid,
      role: wmi.role
    }))
  }

  async getAccountWorkspaces (accountId: AccountUuid): Promise<WorkspaceInfoWithStatus[]> {
    const members = await this.workspaceMembers.find({ accountUuid: accountId })
    const wsIds = members.map((m) => m.workspaceUuid)

    return await this.workspace.find({ uuid: { $in: wsIds } })
  }

  async setPassword (accountId: AccountUuid, passwordHash: Buffer, salt: Buffer): Promise<void> {
    await this.account.update({ uuid: accountId }, { hash: passwordHash, salt })
  }

  async resetPassword (accountId: AccountUuid): Promise<void> {
    await this.account.update({ uuid: accountId }, { hash: null, salt: null })
  }

  async deleteAccount (accountUuid: AccountUuid): Promise<void> {
    const socialIds = await this.socialId.find({ personUuid: accountUuid })

    for (const socialIdObj of socialIds) {
      await this.integrationSecret.deleteMany({ socialId: socialIdObj._id })
      await this.integration.deleteMany({ socialId: socialIdObj._id })
    }

    const mailboxes = await this.mailbox.find({ accountUuid })

    for (const mailboxObj of mailboxes) {
      await this.mailboxSecret.deleteMany({ mailbox: mailboxObj.mailbox })
    }

    await this.mailbox.deleteMany({ accountUuid })

    await this.socialId.update({ personUuid: accountUuid }, { verifiedOn: undefined })
    await this.workspaceMembers.deleteMany({ accountUuid })
    await this.account.deleteMany({ uuid: accountUuid })
  }

  async listAccounts (search?: string, skip?: number, limit?: number): Promise<AccountAggregatedInfo[]> {
    throw new Error('Not implemented')
  }
}
