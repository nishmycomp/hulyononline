//
// Copyright © 2023-2024 Hardcore Engineering Inc.
//
import { Person, type Employee } from '@hcengineering/contact'
import core, {
  combineAttributes,
  DocumentQuery,
  PersonId,
  Ref,
  SortingOrder,
  Tx,
  TxCreateDoc,
  TxFactory,
  TxUpdateDoc,
  pickPrimarySocialId,
  type Doc,
  type RolesAssignment,
  type Timestamp,
  type TxCUD,
  concatLink
} from '@hcengineering/core'
import { NotificationType } from '@hcengineering/notification'
import { getEmployees, getSocialIds } from '@hcengineering/server-contact'
import serverCore, { TriggerControl } from '@hcengineering/server-core'

import documents, {
  ControlledDocument,
  ControlledDocumentState,
  Document,
  DocumentApprovalRequest,
  DocumentState,
  DocumentTemplate,
  getEffectiveDocUpdates,
  type DocumentRequest,
  type DocumentTraining
} from '@hcengineering/controlled-documents'
import { RequestStatus } from '@hcengineering/request'
import training, { TrainingState, type TrainingRequest } from '@hcengineering/training'
import { getMetadata } from '@hcengineering/platform'
import { workbenchId } from '@hcengineering/workbench'
import slugify from 'slugify'

async function getDocs (
  control: TriggerControl,
  seqNumber: number,
  predicate: (doc: Document) => boolean,
  template?: Ref<DocumentTemplate>,
  states?: DocumentState[],
  controlledStates?: ControlledDocumentState[]
): Promise<ControlledDocument[]> {
  let query: DocumentQuery<ControlledDocument> = { template, seqNumber }
  if (template != null) query = { ...query, template }
  if (states != null) query = { ...query, state: { $in: states } }
  if (controlledStates != null) query = { ...query, controlledState: { $in: controlledStates } }

  const allDocs = await control.findAll(control.ctx, documents.class.ControlledDocument, query, {
    sort: { major: SortingOrder.Descending, minor: SortingOrder.Descending, patch: SortingOrder.Descending }
  })

  return allDocs.filter(predicate)
}

function makeDocEffective (doc: ControlledDocument, txFactory: TxFactory): Tx[] {
  const updates = getEffectiveDocUpdates()
  return updates.map((u) => txFactory.createTxUpdateDoc(doc._class, doc.space, doc._id, u))
}

function archiveDocs (docs: ControlledDocument[], txFactory: TxFactory): Tx[] {
  const res: Tx[] = []

  for (const doc of docs) {
    res.push(
      txFactory.createTxUpdateDoc<ControlledDocument>(doc._class, doc.space, doc._id, {
        state: DocumentState.Archived
      }),
      txFactory.createTxUpdateDoc<ControlledDocument>(doc._class, doc.space, doc._id, {
        $unset: { controlledState: true }
      })
    )
  }

  return res
}

function updateMeta (doc: ControlledDocument, txFactory: TxFactory): Tx[] {
  return [
    txFactory.createTxUpdateDoc(doc.attachedToClass, doc.space, doc.attachedTo, {
      title: `${doc.code} ${doc.title}`
    })
  ]
}

// TODO: Find a way to avoid duplicate logic and reuse createTrainingRequest() from `training-resources`
async function createDocumentTrainingRequest (doc: ControlledDocument, control: TriggerControl): Promise<Tx[]> {
  if (!control.hierarchy.hasMixin(doc, documents.mixin.DocumentTraining)) {
    return []
  }

  const documentTraining: DocumentTraining = control.hierarchy.as<Document, DocumentTraining>(
    doc,
    documents.mixin.DocumentTraining
  )
  if (
    doc.owner === undefined ||
    !documentTraining.enabled ||
    documentTraining.training === null ||
    documentTraining.trainees.length + documentTraining.roles.length === 0
  ) {
    return []
  }

  const trainingObject =
    (await control.findAll(control.ctx, training.class.Training, { _id: documentTraining.training }))[0] ?? null

  if (trainingObject === null) {
    console.error(`Planned training ${documentTraining.training} not found`)
    return []
  }
  if (trainingObject.state !== TrainingState.Released) {
    console.error(`Planned training ${documentTraining.training} has not been released`)
    return []
  }

  if (doc.effectiveDate === undefined) {
    return []
  }

  const dueDate: Timestamp | null =
    documentTraining.dueDays === null ? null : doc.effectiveDate + documentTraining.dueDays * 24 * 60 * 60 * 1000

  const ownerSocialIds = await getSocialIds(control, doc.owner)
  if (ownerSocialIds.length === 0) {
    console.error(`Owner ${doc.owner} has no social ids`)
    return []
  }

  // TODO: Encapsulate training request creation logic in training plugin?
  const modifiedBy = pickPrimarySocialId(ownerSocialIds)._id

  let trainees: Array<Ref<Employee>> = documentTraining.trainees
  const roles = documentTraining.roles
  if (roles.length > 0) {
    const traineesMap = new Map<Ref<Employee>, boolean>(trainees.map((employeeRef) => [employeeRef, true]))

    const space = (
      await control.findAll(
        control.ctx,
        core.class.TypedSpace,
        {
          _id: trainingObject.space
        },
        {
          lookup: {
            type: core.class.SpaceType
          }
        }
      )
    ).shift()

    if (space === undefined) {
      console.error(`Space #${trainingObject.space} not found`)
      return []
    }

    const spaceType = space.$lookup?.type

    if (spaceType === undefined) {
      console.error(`Space type #${space.type} not found`)
      return []
    }

    const mixin = control.hierarchy.as(space, spaceType.targetClass) as unknown as RolesAssignment
    const accounts = roles.map((roleId) => mixin[roleId] ?? []).flat()
    const employees = await getEmployees(control, accounts)

    for (const employee of employees) {
      traineesMap.set(employee._id, true)
    }

    trainees = [...traineesMap.keys()]
  }

  if (trainees.length === 0) {
    return []
  }

  const innerTx = control.txFactory.createTxCreateDoc<TrainingRequest>(
    training.class.TrainingRequest,
    trainingObject.space,
    {
      trainees,
      dueDate,
      maxAttempts: documentTraining.maxAttempts,
      owner: doc.owner,
      attempts: 0,
      canceledBy: null,
      canceledOn: null,
      attachedTo: trainingObject._id,
      attachedToClass: trainingObject._class,
      collection: 'requests'
    },
    undefined,
    undefined,
    modifiedBy
  )
  // Force space to make transaction persistent and raise notifications
  innerTx.space = core.space.Tx

  const resTx = control.txFactory.createTxCollectionCUD(
    trainingObject._class,
    trainingObject._id,
    trainingObject.space,
    'requests',
    innerTx,
    undefined,
    modifiedBy
  )
  // Force space to make transaction persistent and raise notifications
  resTx.space = core.space.Tx

  await control.apply(control.ctx, [resTx])

  return []
}

async function getDocsOlderThanDoc (
  doc: Document,
  control: TriggerControl,
  states?: DocumentState[],
  controlledStates?: ControlledDocumentState[]
): Promise<ControlledDocument[]> {
  return await getDocs(
    control,
    doc.seqNumber,
    (another: Document) => doc.major > another.major || (doc.major === another.major && doc.minor > another.minor),
    doc.template,
    states,
    controlledStates
  )
}

function updateTemplate (doc: ControlledDocument, olderEffective: ControlledDocument[], control: TriggerControl): Tx[] {
  if (!control.hierarchy.hasMixin(doc, documents.mixin.DocumentTemplate)) {
    return []
  }

  const templates = olderEffective
    .filter((p) => control.hierarchy.hasMixin(p, documents.mixin.DocumentTemplate))
    .map((p) => control.hierarchy.as<Document, DocumentTemplate>(p, documents.mixin.DocumentTemplate))
    .sort((a, b) => b.sequence - a.sequence)

  if (templates.length > 0) {
    const { sequence, docPrefix } = templates[0]
    return [
      control.txFactory.createTxMixin<Document, DocumentTemplate>(
        doc._id,
        doc._class,
        doc.space,
        documents.mixin.DocumentTemplate,
        { sequence, docPrefix }
      )
    ]
  }

  return []
}

export async function OnDocHasBecomeEffective (
  txes: TxUpdateDoc<ControlledDocument>[],
  control: TriggerControl
): Promise<Tx[]> {
  const result: Tx[] = []
  for (const tx of txes) {
    const doc = (await control.findAll(control.ctx, tx.objectClass, { _id: tx.objectId }, { limit: 1 })).shift()
    if (doc === undefined) {
      continue
    }

    const olderEffective = await getDocsOlderThanDoc(doc, control, [DocumentState.Effective])

    result.push(
      ...archiveDocs(olderEffective, control.txFactory),
      ...updateMeta(doc, control.txFactory),
      ...updateTemplate(doc, olderEffective, control),
      ...(await createDocumentTrainingRequest(doc, control))
    )
  }
  return result
}

export async function OnDocEnteredNonActionableState (
  txes: TxUpdateDoc<ControlledDocument>[],
  control: TriggerControl
): Promise<Tx[]> {
  const result: Tx[] = []
  for (const tx of txes) {
    const requests = await control.findAll(control.ctx, documents.class.DocumentRequest, {
      attachedTo: tx.objectId
    })
    const cancelTxes = requests
      .filter((request) => {
        return request.status === RequestStatus.Active || tx.operations.state === DocumentState.Deleted
      })
      .map((request) =>
        control.txFactory.createTxUpdateDoc<DocumentRequest>(request._class, request.space, request._id, {
          status: RequestStatus.Cancelled
        })
      )
    await control.apply(control.ctx, [
      ...cancelTxes,
      control.txFactory.createTxUpdateDoc<ControlledDocument>(tx.objectClass, tx.objectSpace, tx.objectId, {
        $unset: { controlledState: true }
      })
    ])
  }

  return result
}

export async function OnDocPlannedEffectiveDateChanged (
  txes: TxUpdateDoc<ControlledDocument>[],
  control: TriggerControl
): Promise<Tx[]> {
  const result: Tx[] = []
  for (const tx of txes) {
    if (!('plannedEffectiveDate' in tx.operations)) {
      continue
    }

    const doc = (await control.findAll(control.ctx, tx.objectClass, { _id: tx.objectId }, { limit: 1 })).shift()
    if (doc === undefined) {
      continue
    }

    // make doc effective immediately if required
    if (tx.operations.plannedEffectiveDate === 0 && doc.controlledState === ControlledDocumentState.Approved) {
      // Create with not derived tx factory in order for notifications to work
      const factory = new TxFactory(control.txFactory.account)
      await control.apply(control.ctx, makeDocEffective(doc, factory))
    }
  }

  return result
}

export async function OnDocApprovalRequestApproved (
  txes: TxUpdateDoc<DocumentApprovalRequest>[],
  control: TriggerControl
): Promise<Tx[]> {
  const result: Tx[] = []
  for (const tx of txes) {
    if (tx.attachedTo === undefined || tx.attachedToClass === undefined) continue
    const doc = (
      await control.findAll<ControlledDocument>(control.ctx, tx.attachedToClass, {
        _id: tx.attachedTo as Ref<ControlledDocument>
      })
    )[0]
    if (doc == null || doc.plannedEffectiveDate !== 0) {
      continue
    }

    // Create with not derived tx factory in order for notifications to work
    const factory = new TxFactory(control.txFactory.account)
    await control.apply(control.ctx, makeDocEffective(doc, factory))
    // make doc effective immediately
  }
  return result
}

export async function ControlledDocumentTextPresenter (doc: ControlledDocument): Promise<string> {
  return doc.title
}

export async function ControlledDocumentHTMLPresenter (
  doc: ControlledDocument,
  control: TriggerControl
): Promise<string> {
  const title = await ControlledDocumentTextPresenter(doc)

  const front = control.branding?.front ?? getMetadata(serverCore.metadata.FrontUrl) ?? ''

  const prjdoc = (await control.findAll(control.ctx, documents.class.ProjectDocument, { document: doc._id }))[0]
  if (prjdoc === undefined) {
    return title
  }

  const project = prjdoc.project ?? documents.ids.NoProject

  function getDocumentLinkId (doc: Document): string {
    const slug = slugify(doc.title, { lower: true })
    return `${slug}---${doc._id}`
  }

  let path = `${workbenchId}/${control.workspace.url}/documents/${getDocumentLinkId(doc)}`
  if (project !== documents.ids.NoProject) {
    path += `/${project}`
  }

  const link = concatLink(front, path)
  return `<a href='${link}'>${title}</a>`
}

async function CoAuthorsTypeMatch (
  originTx: TxCUD<ControlledDocument>,
  _doc: Doc,
  person: Ref<Person>,
  socialIds: PersonId[],
  _type: NotificationType,
  control: TriggerControl
): Promise<boolean> {
  if (socialIds.includes(originTx.modifiedBy)) return false
  if (originTx._class === core.class.TxUpdateDoc) {
    const tx = originTx as TxUpdateDoc<ControlledDocument>
    const employees = Array.isArray(tx.operations.coAuthors)
      ? tx.operations.coAuthors ?? []
      : (combineAttributes([tx.operations], 'coAuthors', '$push', '$each') as Ref<Employee>[])

    return employees.some((it) => it === person)
  } else if (originTx._class === core.class.TxCreateDoc) {
    const tx = originTx as TxCreateDoc<ControlledDocument>
    const employees = tx.attributes.coAuthors

    return employees.some((it) => it === person)
  }

  return false
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  trigger: {
    OnDocEnteredNonActionableState,
    OnDocPlannedEffectiveDateChanged,
    OnDocApprovalRequestApproved,
    OnDocHasBecomeEffective
  },
  function: {
    ControlledDocumentTextPresenter,
    ControlledDocumentHTMLPresenter,
    CoAuthorsTypeMatch
  }
})
