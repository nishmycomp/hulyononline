import core, {
  type Class,
  type Doc,
  type Hierarchy,
  type OperationDomain,
  type Ref,
  type TxCreateDoc,
  type TxCUD,
  TxProcessor
} from '@hcengineering/core'
import { type Card } from '@hcengineering/card'
import { type TriggerControl } from '@hcengineering/server-core'
import activity from '@hcengineering/activity'
import { type ActivityControl } from '@hcengineering/server-activity'
import { MessageEventType, type CreateMessageEvent } from '@hcengineering/communication-sdk-types'
import {
  type ActivityAttributeUpdate,
  type ActivityMessageExtra,
  type ActivityUpdate,
  ActivityUpdateType,
  MessageType
} from '@hcengineering/communication-types'
import { translate } from '@hcengineering/platform'

import { getNewActivityUpdates } from './utils'

export async function generateActivity (
  tx: TxCUD<Card>,
  control: TriggerControl,
  cache: Map<Ref<Card>, Card>
): Promise<void> {
  const { hierarchy } = control

  if (tx.space === core.space.DerivedTx) return

  if (
    hierarchy.isDerived(tx.objectClass, activity.class.ActivityMessage) ||
    (tx.attachedToClass !== undefined && hierarchy.isDerived(tx.attachedToClass, activity.class.ActivityMessage))
  ) {
    return
  }

  switch (tx._class) {
    case core.class.TxCreateDoc: {
      const card = TxProcessor.createDoc2Doc(tx as TxCreateDoc<Card>)
      await createMessages(tx, control, card)
      break
    }
    case core.class.TxMixin:
    case core.class.TxUpdateDoc: {
      const card =
        cache.get(tx.objectId) ??
        (await control.findAll(control.ctx, tx.objectClass, { _id: tx.objectId }, { limit: 1 }))[0]
      if (card !== undefined) {
        cache.set(tx.objectId, card)
        await createMessages(tx, control, card)
      }
    }
  }
}

async function createMessages (tx: TxCUD<Card>, control: TriggerControl, card: Card | undefined): Promise<void> {
  if (card === undefined) return

  const action = getActivityAction(control, tx)

  const result: ActivityMessageExtra[] = []
  const attributesUpdates = await getNewActivityUpdates(control, tx, card)

  for (const attributeUpdates of attributesUpdates) {
    result.push({ action, update: attributeUpdates })
  }

  if (attributesUpdates.length === 0 && action !== 'update') {
    result.push({ action })
  }

  const events: CreateMessageEvent[] = []
  for (const data of result) {
    const event: CreateMessageEvent = {
      type: MessageEventType.CreateMessage,
      messageType: MessageType.Activity,
      cardId: card._id,
      cardType: card._class,
      content: await getActivityContent(control, data, card),
      socialId: tx.modifiedBy,
      extra: data,
      date: new Date(tx.modifiedOn)
    }
    events.push(event)
  }

  await Promise.all(
    events.map((event) => control.domainRequest(control.ctx, 'communication' as OperationDomain, { event }))
  )
}

function getActivityAction (control: ActivityControl, tx: TxCUD<Doc>): 'create' | 'remove' | 'update' {
  const hierarchy = control.hierarchy

  if (hierarchy.isDerived(tx._class, core.class.TxCreateDoc)) return 'create'
  if (hierarchy.isDerived(tx._class, core.class.TxRemoveDoc)) return 'remove'

  return 'update'
}

async function getActivityContent (control: TriggerControl, extra: ActivityMessageExtra, card: Card): Promise<string> {
  const { action, update } = extra
  const { hierarchy } = control
  const clazz = hierarchy.getClass(card._class)
  const objectType = await translate(clazz.label, {})

  if (action === 'create') {
    return await translate(activity.string.NewObjectType, { type: objectType, title: card.title })
  }

  if (action === 'remove') {
    return await translate(activity.string.RemovedObjectType, { type: objectType, title: card.title })
  }

  if (action === 'update' && update !== undefined) {
    const text = await getUpdateText(update, card, hierarchy)

    return text ?? (await translate(activity.string.ChangedObject, { object: card.title }))
  }

  return ''
}

async function getUpdateText (update: ActivityUpdate, card: Card, hierarchy: Hierarchy): Promise<string | undefined> {
  if (update.type === ActivityUpdateType.Attribute) {
    const attrName = await getAttrName(update, card._class, hierarchy)

    if (attrName === undefined) {
      return undefined
    }

    const { added, removed, set, attrClass } = update

    if (added != null && added.length > 0) {
      return await translate(activity.string.NewObject, { object: attrName })
    }
    if (removed != null && removed.length > 0) {
      return await translate(activity.string.RemovedObject, { object: attrName })
    }

    if (set !== undefined) {
      const isUnset = set === null

      if (isUnset) {
        return await translate(activity.string.UnsetObject, { object: attrName })
      } else {
        const values = await getAttributeValues(set, attrClass)
        if (values !== undefined) {
          return await translate(activity.string.AttributeSetTo, {
            name: capitalizeFirstLetter(attrName),
            value: values.join(', ')
          })
        }
        return await translate(activity.string.ChangedObject, { object: attrName })
      }
    }
  }

  if (update.type === ActivityUpdateType.Tag) {
    const clazz = hierarchy.getClass(update.tag)
    if (update.action === 'add') {
      const tagName = await translate(clazz.label, {})
      return await translate(activity.string.AddedTag, { title: tagName })
    }
    if (update.action === 'remove') {
      const tagName = await translate(clazz.label, {})
      return await translate(activity.string.RemovedTag, { title: tagName })
    }
  }
  return undefined
}

async function getAttrName (
  attributeUpdates: ActivityAttributeUpdate,
  objectClass: Ref<Class<Doc>>,
  hierarchy: Hierarchy
): Promise<string | undefined> {
  const { attrKey } = attributeUpdates

  try {
    const attribute = hierarchy.getAttribute(objectClass, attrKey)

    const label = attribute.shortLabel ?? attribute.label

    if (label === undefined) {
      return undefined
    }

    return await translate(label, {})
  } catch (e) {
    console.error(e)
    return undefined
  }
}

const valueTypes: ReadonlyArray<Ref<Class<Doc>>> = [
  core.class.TypeString,
  core.class.EnumOf,
  core.class.TypeNumber,
  core.class.TypeDate,
  core.class.TypeFileSize,
  core.class.TypeMarkup,
  core.class.TypeHyperlink
]

async function getAttributeValues (value: any | any[], attrClass: Ref<Class<Doc>>): Promise<any[] | undefined> {
  const values = Array.isArray(value) ? value : [value]
  if (values.some((value) => typeof value !== 'string')) {
    return values
  }

  if (valueTypes.includes(attrClass)) {
    return values
  }

  return undefined
}

function capitalizeFirstLetter (str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
