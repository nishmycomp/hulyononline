//
// Copyright © 2022 Hardcore Engineering Inc.
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

import chunter from '@hcengineering/chunter'
import contact, { type PersonSpace } from '@hcengineering/contact'
import core, {
  DOMAIN_TX,
  type PersonId,
  type Class,
  type Doc,
  type DocumentQuery,
  type Ref,
  type Space,
  type AccountUuid,
  DOMAIN_COLLABORATOR,
  type Collaborator,
  generateId,
  DOMAIN_TRANSIENT
} from '@hcengineering/core'
import {
  migrateSpace,
  type MigrateUpdate,
  type MigrationDocumentQuery,
  tryMigrate,
  type MigrateOperation,
  type MigrationClient,
  type MigrationUpgradeClient
} from '@hcengineering/model'
import notification, {
  notificationId,
  type PushSubscription,
  type BrowserNotification,
  type DocNotifyContext,
  type InboxNotification,
  type OldCollaborators
} from '@hcengineering/notification'
import { DOMAIN_PREFERENCE } from '@hcengineering/preference'

import {
  DOMAIN_SPACE,
  getSocialKeyByOldAccount,
  getAccountUuidByOldAccount,
  getUniqueAccountsFromOldAccounts,
  getSocialIdFromOldAccount
} from '@hcengineering/model-core'
import { DOMAIN_DOC_NOTIFY, DOMAIN_NOTIFICATION, DOMAIN_USER_NOTIFY } from './index'

export async function removeNotifications (
  client: MigrationClient,
  query: DocumentQuery<DocNotifyContext>
): Promise<void> {
  while (true) {
    const contexts = await client.find<DocNotifyContext>(
      DOMAIN_NOTIFICATION,
      {
        _class: notification.class.DocNotifyContext,
        ...query
      },
      { limit: 500 }
    )

    if (contexts.length === 0) {
      return
    }

    const ids = contexts.map(({ _id }) => _id)

    await client.deleteMany(DOMAIN_NOTIFICATION, {
      _class: notification.class.CommonInboxNotification,
      docNotifyContext: { $in: ids }
    })

    await client.deleteMany(DOMAIN_NOTIFICATION, {
      _class: notification.class.ActivityInboxNotification,
      docNotifyContext: { $in: ids }
    })

    await client.deleteMany(DOMAIN_NOTIFICATION, {
      _class: notification.class.MentionInboxNotification,
      docNotifyContext: { $in: ids }
    })

    await client.deleteMany(DOMAIN_NOTIFICATION, {
      _class: notification.class.DocNotifyContext,
      _id: { $in: ids }
    })
  }
}

export async function migrateNotificationsSpace (client: MigrationClient): Promise<void> {
  const personSpaces = await client.find<PersonSpace>(DOMAIN_SPACE, { _class: contact.class.PersonSpace }, {})

  await client.update(
    DOMAIN_DOC_NOTIFY,
    {
      _class: notification.class.DocNotifyContext,
      objectSpace: { $exists: false }
    },
    { $rename: { space: 'objectSpace' } }
  )

  for (const space of personSpaces) {
    await client.update(
      DOMAIN_DOC_NOTIFY,
      {
        _class: notification.class.DocNotifyContext,
        user: { $in: space.members }
      },
      { space: space._id }
    )
    await client.update(
      DOMAIN_NOTIFICATION,
      {
        _class: notification.class.ActivityInboxNotification,
        user: { $in: space.members }
      },
      { space: space._id }
    )
    await client.update(
      DOMAIN_NOTIFICATION,
      {
        _class: notification.class.CommonInboxNotification,
        user: { $in: space.members }
      },
      { space: space._id }
    )
    await client.update(
      DOMAIN_NOTIFICATION,
      {
        _class: notification.class.MentionInboxNotification,
        user: { $in: space.members }
      },
      { space: space._id }
    )
  }

  await client.deleteMany(DOMAIN_DOC_NOTIFY, { space: { $nin: personSpaces.map(({ _id }) => _id) } })
  await client.deleteMany(DOMAIN_NOTIFICATION, {
    _class: notification.class.ActivityInboxNotification,
    space: { $nin: personSpaces.map(({ _id }) => _id) }
  })
  await client.deleteMany(DOMAIN_NOTIFICATION, {
    _class: notification.class.CommonInboxNotification,
    space: { $nin: personSpaces.map(({ _id }) => _id) }
  })
  await client.deleteMany(DOMAIN_NOTIFICATION, {
    _class: notification.class.MentionInboxNotification,
    space: { $nin: personSpaces.map(({ _id }) => _id) }
  })

  while (true) {
    const contexts = await client.find<DocNotifyContext>(
      DOMAIN_DOC_NOTIFY,
      {
        _class: notification.class.DocNotifyContext,
        attachedTo: { $exists: true }
      },
      { limit: 500 }
    )

    if (contexts.length === 0) {
      break
    }

    const classesOfSpace = new Set<Ref<Class<Doc>>>()

    for (const context of contexts) {
      const _class = (context as any).attachedToClass
      if (client.hierarchy.isDerived(_class, core.class.Space)) {
        classesOfSpace.add(_class)
      }
    }
    if (classesOfSpace.size > 0) {
      await client.update<DocNotifyContext>(
        DOMAIN_DOC_NOTIFY,
        { objectClass: { $in: Array.from(classesOfSpace) } },
        { objectSpace: core.space.Space }
      )
      await client.update<DocNotifyContext>(
        DOMAIN_DOC_NOTIFY,
        { objectClass: { $in: Array.from(classesOfSpace) } },
        { $rename: { attachedTo: 'objectId', attachedToClass: 'objectClass' } }
      )
    }
    await client.update(
      DOMAIN_DOC_NOTIFY,
      {
        _class: notification.class.DocNotifyContext,
        _id: { $in: contexts.map(({ _id }) => _id) }
      },
      { $rename: { attachedTo: 'objectId', attachedToClass: 'objectClass' } }
    )
  }

  await client.deleteMany(DOMAIN_NOTIFICATION, { _class: notification.class.BrowserNotification })
  await client.deleteMany(DOMAIN_USER_NOTIFY, { _class: notification.class.BrowserNotification })
}

export async function migrateDuplicateContexts (client: MigrationClient): Promise<void> {
  const personSpaces = await client.find<PersonSpace>(DOMAIN_SPACE, { _class: contact.class.PersonSpace }, {})

  for (const space of personSpaces) {
    const contexts = await client.find<DocNotifyContext>(
      DOMAIN_DOC_NOTIFY,
      { _class: notification.class.DocNotifyContext, space: space._id },
      {}
    )
    const toRemove = new Set<Ref<DocNotifyContext>>()
    const contextByUser = new Map<string, DocNotifyContext>()

    for (const context of contexts) {
      const key = context.objectId + '.' + context.user
      const existContext = contextByUser.get(key)

      if (existContext != null) {
        const existLastViewedTimestamp = existContext.lastViewedTimestamp ?? 0
        const newLastViewedTimestamp = context.lastViewedTimestamp ?? 0
        if (existLastViewedTimestamp > newLastViewedTimestamp) {
          toRemove.add(context._id)
        } else {
          toRemove.add(existContext._id)
          contextByUser.set(key, context)
        }
      } else {
        contextByUser.set(key, context)
      }
    }
    if (toRemove.size > 0) {
      await client.deleteMany(DOMAIN_DOC_NOTIFY, { _id: { $in: Array.from(toRemove) } })
      await client.deleteMany(DOMAIN_NOTIFICATION, { docNotifyContext: { $in: Array.from(toRemove) } })
    }
  }
}

async function migrateCollaborators (client: MigrationClient): Promise<void> {
  const hierarchy = client.hierarchy
  client.logger.log('processing extract collaborators ', {})
  for (const domain of client.hierarchy.domains()) {
    if ([DOMAIN_TX, DOMAIN_TRANSIENT].includes(domain)) continue
    client.logger.log('processing domain ', { domain })
    let processed = 0
    const iterator = await client.traverse(domain, { 'notification:mixin:Collaborators': { $exists: true } })

    try {
      while (true) {
        const docs = await iterator.next(200)
        if (docs === null || docs.length === 0) {
          break
        }

        const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []

        const collabs: Collaborator[] = []

        for (const doc of docs) {
          const mixin = hierarchy.as(doc, notification.mixin.Collaborators) as any as OldCollaborators
          const oldCollaborators = mixin.collaborators

          if (oldCollaborators === undefined || oldCollaborators.length === 0) continue

          for (const collab of oldCollaborators) {
            collabs.push({
              _id: generateId(),
              _class: core.class.Collaborator,
              space: doc.space,
              collaborator: collab,
              attachedTo: doc._id,
              attachedToClass: doc._class,
              collection: 'collaborators',
              modifiedOn: Date.now(),
              modifiedBy: core.account.System
            })
          }

          operations.push({
            filter: { _id: doc._id },
            update: {
              $unset: {
                'notification:mixin:Collaborators': true
              }
            }
          })
        }

        if (operations.length > 0) {
          await client.bulk(domain, operations)
          await client.create(DOMAIN_COLLABORATOR, collabs)
        }

        processed += docs.length
        client.logger.log('...processed', { count: processed })
      }

      client.logger.log('finished processing domain ', { domain, processed })
    } finally {
      await iterator.close()
    }
  }
  client.logger.log('finished processing collaborators ', {})
}

/**
 * Migrates old accounts to new accounts/social ids.
 * Should be applied to prodcution directly without applying migrateSocialIdsToAccountUuids
 * @param client
 * @returns
 */
async function migrateAccounts (client: MigrationClient): Promise<void> {
  const hierarchy = client.hierarchy
  const socialKeyByAccount = await getSocialKeyByOldAccount(client)
  const socialIdBySocialKey = new Map<string, PersonId | null>()
  const socialIdByOldAccount = new Map<string, PersonId | null>()
  const accountUuidByOldAccount = new Map<string, AccountUuid | null>()

  client.logger.log('processing collaborators ', {})
  for (const domain of client.hierarchy.domains()) {
    if (['tx'].includes(domain)) continue
    client.logger.log('processing domain ', { domain })
    let processed = 0
    const iterator = await client.traverse(domain, {})

    try {
      while (true) {
        const docs = await iterator.next(200)
        if (docs === null || docs.length === 0) {
          break
        }

        const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []

        const collabs: Collaborator[] = []

        for (const doc of docs) {
          const mixin = hierarchy.as(doc, notification.mixin.Collaborators) as any as OldCollaborators
          const oldCollaborators = mixin.collaborators

          if (oldCollaborators === undefined || oldCollaborators.length === 0) continue

          const newCollaborators = await getUniqueAccountsFromOldAccounts(
            client,
            oldCollaborators,
            socialKeyByAccount,
            accountUuidByOldAccount
          )

          for (const collab of newCollaborators) {
            collabs.push({
              _id: generateId(),
              _class: core.class.Collaborator,
              space: doc.space,
              collaborator: collab,
              attachedTo: doc._id,
              attachedToClass: doc._class,
              collection: 'collaborators',
              modifiedOn: Date.now(),
              modifiedBy: core.account.System
            })
          }

          operations.push({
            filter: { _id: doc._id },
            update: {
              $unset: {
                'notification:mixin:Collaborators': true
              }
            }
          })
        }

        if (operations.length > 0) {
          await client.bulk(domain, operations)
          await client.create(DOMAIN_COLLABORATOR, collabs)
        }

        processed += docs.length
        client.logger.log('...processed', { count: processed })
      }

      client.logger.log('finished processing domain ', { domain, processed })
    } finally {
      await iterator.close()
    }
  }
  client.logger.log('finished processing collaborators ', {})

  client.logger.log('processing notifications fields ', {})
  function chunkArray<T> (array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  const operations: { filter: MigrationDocumentQuery<Doc>, update: MigrateUpdate<Doc> }[] = []
  const groupByUser = await client.groupBy<any, Doc>(DOMAIN_NOTIFICATION, 'user', {
    _class: {
      $in: [
        notification.class.BrowserNotification,
        notification.class.InboxNotification,
        notification.class.ActivityInboxNotification,
        notification.class.CommonInboxNotification
      ]
    }
  })

  for (const oldAccId of groupByUser.keys()) {
    if (oldAccId == null) continue
    const newAccId = await getAccountUuidByOldAccount(client, oldAccId, socialKeyByAccount, accountUuidByOldAccount)
    if (newAccId == null || oldAccId === newAccId) continue

    operations.push({
      filter: {
        user: oldAccId,
        _class: {
          $in: [
            notification.class.BrowserNotification,
            notification.class.InboxNotification,
            notification.class.ActivityInboxNotification,
            notification.class.CommonInboxNotification
          ]
        }
      },
      update: {
        user: newAccId
      }
    })
  }

  const groupBySenderId = await client.groupBy<any, Doc>(DOMAIN_NOTIFICATION, 'senderId', {
    _class: notification.class.BrowserNotification
  })

  for (const oldAccId of groupBySenderId.keys()) {
    if (oldAccId == null) continue
    const socialId = await getSocialIdFromOldAccount(
      client,
      oldAccId,
      socialKeyByAccount,
      socialIdBySocialKey,
      socialIdByOldAccount
    )
    if (socialId == null || oldAccId === socialId) continue

    operations.push({
      filter: {
        senderId: oldAccId,
        _class: notification.class.BrowserNotification
      },
      update: {
        senderId: socialId
      }
    })
  }

  if (operations.length > 0) {
    const operationsChunks = chunkArray(operations, 40)
    let processed = 0
    for (const operationsChunk of operationsChunks) {
      if (operationsChunk.length === 0) continue

      await client.bulk(DOMAIN_NOTIFICATION, operationsChunk)
      processed++
      if (operationsChunks.length > 1) {
        client.logger.log('processed chunk', { processed, of: operationsChunks.length })
      }
    }
  } else {
    client.logger.log('no user accounts to migrate', {})
  }

  client.logger.log('finished processing notifications fields ', {})

  client.logger.log('processing doc notify contexts ', {})
  const dncIterator = await client.traverse<DocNotifyContext>(DOMAIN_DOC_NOTIFY, {
    _class: notification.class.DocNotifyContext
  })
  try {
    let processed = 0
    while (true) {
      const docs = await dncIterator.next(200)
      if (docs === null || docs.length === 0) {
        break
      }

      const operations: {
        filter: MigrationDocumentQuery<DocNotifyContext>
        update: MigrateUpdate<DocNotifyContext>
      }[] = []

      for (const doc of docs) {
        const oldUser: any = doc.user
        const newUser = await getAccountUuidByOldAccount(client, oldUser, socialKeyByAccount, accountUuidByOldAccount)

        if (newUser != null && newUser !== oldUser) {
          operations.push({
            filter: { _id: doc._id },
            update: {
              user: newUser
            }
          })
        }
      }

      if (operations.length > 0) {
        await client.bulk(DOMAIN_DOC_NOTIFY, operations)
      }

      processed += docs.length
      client.logger.log('...processed', { count: processed })
    }
  } finally {
    await dncIterator.close()
  }
  client.logger.log('finished processing doc notify contexts ', {})

  client.logger.log('processing push subscriptions ', {})
  const psIterator = await client.traverse<PushSubscription>(DOMAIN_USER_NOTIFY, {
    _class: notification.class.PushSubscription
  })
  try {
    let processed = 0
    while (true) {
      const docs = await psIterator.next(200)
      if (docs === null || docs.length === 0) {
        break
      }

      const operations: {
        filter: MigrationDocumentQuery<PushSubscription>
        update: MigrateUpdate<PushSubscription>
      }[] = []

      for (const doc of docs) {
        const oldUser: any = doc.user
        const newUser = await getAccountUuidByOldAccount(client, oldUser, socialKeyByAccount, accountUuidByOldAccount)

        if (newUser != null && newUser !== oldUser) {
          operations.push({
            filter: { _id: doc._id },
            update: {
              user: newUser
            }
          })
        }
      }

      if (operations.length > 0) {
        await client.bulk(DOMAIN_USER_NOTIFY, operations)
      }

      processed += docs.length
      client.logger.log('...processed', { count: processed })
    }
  } finally {
    await psIterator.close()
  }
  client.logger.log('finished processing push subscriptions ', {})
}

export async function migrateSettings (client: MigrationClient): Promise<void> {
  await client.update(
    DOMAIN_PREFERENCE,
    {
      _class: 'notification:class:NotificationSetting' as Ref<Class<Doc>>,
      attachedTo: 'notification:providers:BrowserNotification' as Ref<Doc>
    },
    {
      _class: notification.class.NotificationTypeSetting,
      attachedTo: notification.providers.PushNotificationProvider
    }
  )

  await client.update(
    DOMAIN_PREFERENCE,
    {
      _class: 'notification:class:NotificationSetting' as Ref<Class<Doc>>,
      attachedTo: 'notification:providers:PlatformNotification' as Ref<Doc>
    },
    {
      _class: notification.class.NotificationTypeSetting,
      attachedTo: notification.providers.InboxNotificationProvider
    }
  )
}

export async function migrateNotificationsObject (client: MigrationClient): Promise<void> {
  while (true) {
    const notifications = await client.find<InboxNotification>(
      DOMAIN_NOTIFICATION,
      { objectId: { $exists: false }, docNotifyContext: { $exists: true } },
      { limit: 500 }
    )

    if (notifications.length === 0) return

    const contextIds = Array.from(new Set(notifications.map((n) => n.docNotifyContext)))
    const contexts = await client.find<DocNotifyContext>(DOMAIN_DOC_NOTIFY, { _id: { $in: contextIds } })

    for (const context of contexts) {
      await client.update(
        DOMAIN_NOTIFICATION,
        { docNotifyContext: context._id, objectId: { $exists: false } },
        { objectId: context.objectId, objectClass: context.objectClass }
      )
    }

    const toDelete: Ref<InboxNotification>[] = []

    for (const notification of notifications) {
      const context = contexts.find((c) => c._id === notification.docNotifyContext)

      if (context === undefined) {
        toDelete.push(notification._id)
      }
    }

    if (toDelete.length > 0) {
      await client.deleteMany(DOMAIN_NOTIFICATION, { _id: { $in: toDelete } })
    }
  }
}

export const notificationOperation: MigrateOperation = {
  async migrate (client: MigrationClient, mode): Promise<void> {
    await tryMigrate(mode, client, notificationId, [
      {
        state: 'delete-hidden-notifications',
        mode: 'upgrade',
        func: async (client) => {
          await removeNotifications(client, { hidden: true })
        }
      },
      {
        state: 'delete-invalid-notifications',
        mode: 'upgrade',
        func: async (client) => {
          await removeNotifications(client, { attachedToClass: 'chunter:class:Comment' as Ref<Class<Doc>> })
        }
      },
      {
        state: 'remove-old-classes',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany(DOMAIN_NOTIFICATION, { _class: 'notification:class:DocUpdates' as Ref<Class<Doc>> })
          await client.deleteMany(DOMAIN_TX, { objectClass: 'notification:class:DocUpdates' as Ref<Class<Doc>> })
        }
      },
      {
        state: 'removeDeprecatedSpace',
        mode: 'upgrade',
        func: async (client: MigrationClient) => {
          await migrateSpace(client, 'notification:space:Notifications' as Ref<Space>, core.space.Workspace, [
            DOMAIN_NOTIFICATION
          ])
        }
      },
      {
        state: 'migrate-setting',
        mode: 'upgrade',
        func: migrateSettings
      },
      {
        state: 'move-doc-notify',
        mode: 'upgrade',
        func: async (client) => {
          await client.move(DOMAIN_NOTIFICATION, { _class: notification.class.DocNotifyContext }, DOMAIN_DOC_NOTIFY)
        }
      },
      {
        state: 'remove-last-view',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany(DOMAIN_NOTIFICATION, { _class: 'notification:class:LastView' as any })
        }
      },
      {
        state: 'remove-notification',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany(DOMAIN_NOTIFICATION, { _class: 'notification:class:Notification' as any })
        }
      },
      {
        state: 'remove-email-notification',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany(DOMAIN_NOTIFICATION, { _class: 'notification:class:EmailNotification' as any })
        }
      },
      {
        state: 'move-user',
        mode: 'upgrade',
        func: async (client) => {
          await client.move(
            DOMAIN_NOTIFICATION,
            { _class: { $in: [notification.class.BrowserNotification, notification.class.PushSubscription] } },
            DOMAIN_USER_NOTIFY
          )
        }
      },
      {
        state: 'fill-notification-archived-field-v1',
        mode: 'upgrade',
        func: async (client) => {
          await client.update<InboxNotification>(
            DOMAIN_NOTIFICATION,
            { _class: notification.class.ActivityInboxNotification, archived: { $exists: false } },
            { archived: false }
          )
          await client.update<InboxNotification>(
            DOMAIN_NOTIFICATION,
            { _class: notification.class.CommonInboxNotification, archived: { $exists: false } },
            { archived: false }
          )
          await client.update<InboxNotification>(
            DOMAIN_NOTIFICATION,
            { _class: notification.class.MentionInboxNotification, archived: { $exists: false } },
            { archived: false }
          )
        }
      },
      {
        state: 'fill-contexts-pinned-field-v1',
        mode: 'upgrade',
        func: async (client) => {
          await client.update<DocNotifyContext>(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, isPinned: { $exists: false } },
            { isPinned: false }
          )
        }
      },
      {
        state: 'migrate-notifications-space-v1',
        mode: 'upgrade',
        func: migrateNotificationsSpace
      },
      {
        state: 'migrate-employee-space-v1',
        mode: 'upgrade',
        func: async () => {
          await client.update<DocNotifyContext>(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, objectSpace: 'contact:space:Employee' as Ref<Space> },
            { objectSpace: contact.space.Contacts }
          )
        }
      },
      {
        state: 'migrate-wrong-spaces-v1',
        mode: 'upgrade',
        func: async () => {
          await client.update<DocNotifyContext>(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, objectClass: chunter.class.DirectMessage },
            { objectSpace: core.space.Space }
          )
          await client.update<DocNotifyContext>(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, objectClass: chunter.class.Channel },
            { objectSpace: core.space.Space }
          )
          await client.update<DocNotifyContext>(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, objectClass: 'recruit:class:Vacancy' as any },
            { objectSpace: core.space.Space }
          )
        }
      },
      {
        state: 'migrate-duplicated-contexts-v4',
        mode: 'upgrade',
        func: migrateDuplicateContexts
      },
      {
        state: 'set-default-hidden',
        mode: 'upgrade',
        func: async () => {
          await client.update(
            DOMAIN_DOC_NOTIFY,
            { _class: notification.class.DocNotifyContext, hidden: { $exists: false } },
            { hidden: false }
          )
        }
      },
      {
        state: 'remove-update-txes-docnotify-ctx-v2',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany(DOMAIN_TX, {
            _class: core.class.TxUpdateDoc,
            objectClass: notification.class.DocNotifyContext,
            'operations.lastViewedTimestamp': {
              $exists: true
            }
          })
          await client.deleteMany(DOMAIN_TX, {
            _class: core.class.TxUpdateDoc,
            objectClass: notification.class.DocNotifyContext,
            'operations.lastUpdateTimestamp': {
              $exists: true
            }
          })
        }
      },
      {
        state: 'remove-browser-notification-v2',
        mode: 'upgrade',
        func: async (client) => {
          await client.deleteMany<BrowserNotification>(DOMAIN_USER_NOTIFY, {
            _class: notification.class.BrowserNotification
          })

          await client.deleteMany(DOMAIN_TX, {
            objectClass: notification.class.BrowserNotification
          })
        }
      },
      {
        state: 'migrate-dnc-space',
        mode: 'upgrade',
        func: async (client) => {
          await client.update(DOMAIN_DOC_NOTIFY, { space: core.space.Space }, { space: core.space.Workspace })
        }
      },
      {
        state: 'accounts-to-social-ids-v2',
        mode: 'upgrade',
        func: migrateAccounts
      },
      {
        state: 'migrate-collaborators-v2',
        mode: 'upgrade',
        func: migrateCollaborators
      }
    ])
  },
  async upgrade (state: Map<string, Set<string>>, client: () => Promise<MigrationUpgradeClient>): Promise<void> {}
}
