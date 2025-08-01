//
// Copyright © 2025 Hardcore Engineering Inc.
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

import cardPlugin, { Card, MasterTag } from '@hcengineering/card'
import contact, { Employee } from '@hcengineering/contact'
import core, {
  ArrOf,
  Association,
  Data,
  Doc,
  generateId,
  getObjectValue,
  Hierarchy,
  matchQuery,
  Ref,
  RefTo,
  Relation,
  Tx,
  TxCreateDoc,
  TxCUD,
  TxProcessor,
  TxRemoveDoc,
  TxUpdateDoc
} from '@hcengineering/core'
import { getEmbeddedLabel, getResource } from '@hcengineering/platform'
import process, {
  ContextId,
  Execution,
  ExecutionContext,
  ExecutionError,
  ExecutionLogAction,
  ExecutionStatus,
  MethodParams,
  parseContext,
  parseError,
  Process,
  ProcessContext,
  processError,
  ProcessError,
  ProcessToDo,
  SelectedContext,
  SelectedContextFunc,
  SelectedExecutonContext,
  SelectedNested,
  SelectedRelation,
  SelectedUserRequest,
  State,
  Step,
  Transition
} from '@hcengineering/process'
import { TriggerControl } from '@hcengineering/server-core'
import serverProcess, { ExecuteResult, MethodImpl } from '@hcengineering/server-process'
import time, { ToDoPriority } from '@hcengineering/time'
import { isError } from './errors'
import {
  Absolute,
  Add,
  All,
  Append,
  Ceil,
  Cut,
  Divide,
  FirstValue,
  FirstWorkingDayAfter,
  Floor,
  Insert,
  LastValue,
  LowerCase,
  Modulo,
  Multiply,
  Offset,
  Power,
  Prepend,
  Random,
  Remove,
  Replace,
  ReplaceAll,
  Round,
  Split,
  Subtract,
  RemoveFirst,
  RemoveLast,
  Trim,
  UpperCase
} from './transform'
import { getAttributeValue, pickTransition } from './utils'

export async function OnProcessToDoClose (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxUpdateDoc) continue
    const updateTx = tx as TxUpdateDoc<ProcessToDo>
    if (!control.hierarchy.isDerived(updateTx.objectClass, process.class.ProcessToDo)) continue
    if (updateTx.operations.doneOn == null) continue
    const todo = (
      await control.findAll(control.ctx, process.class.ProcessToDo, { _id: updateTx.objectId }, { limit: 1 })
    )[0]
    if (todo === undefined) continue
    const execution = (
      await control.findAll(control.ctx, process.class.Execution, { _id: todo.execution }, { limit: 1 })
    )[0]
    if (execution === undefined) continue
    const _process = await control.modelDb.findOne(process.class.Process, { _id: execution.process })
    if (_process === undefined) continue
    const transitions = control.modelDb.findAllSync(process.class.Transition, {
      from: execution.currentState,
      process: _process._id,
      trigger: process.trigger.OnToDoClose
    })
    const transition = await pickTransition(control, execution, transitions, todo)
    if (transition === undefined) continue
    const rollback: Tx[] = [control.txFactory.createTxUpdateDoc(todo._class, todo.space, todo._id, { doneOn: null })]
    res.push(...(await executeTransition(execution, transition, control, rollback)))
  }
  return res
}

async function executeTransition (
  execution: Execution,
  transition: Transition,
  control: TriggerControl,
  rollback: Tx[],
  disableRollback = false
): Promise<Tx[]> {
  let deep = control.contextCache.get(execution._id + 'transition') ?? 1
  deep++
  control.contextCache.set(execution._id + 'transition', deep)
  if (deep > 100) {
    const error = parseError(
      processError(process.error.TooDeepTransitionRecursion, undefined, undefined, true),
      transition._id
    )
    return [control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, { error: [error] })]
  }
  const res: Tx[] = []
  const _process = control.modelDb.findObject(execution.process)
  if (_process === undefined) return res

  const state = control.modelDb.findObject(transition.to)
  if (state === undefined) return res
  const isDone =
    control.modelDb.findAllSync(process.class.Transition, {
      from: transition.to,
      process: transition.process
    }).length === 0
  const errors: ExecutionError[] = []
  if (execution.currentState !== null) {
    rollback.push(
      control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, {
        currentState: execution.currentState,
        status: execution.status
      })
    )
  } else {
    rollback.push(control.txFactory.createTxRemoveDoc(execution._class, execution.space, execution._id))
  }
  for (const action of transition.actions) {
    const actionResult = await executeAction(action, transition._id, execution, control)
    if (isError(actionResult)) {
      errors.push(actionResult)
    } else {
      if (actionResult.rollback !== undefined) {
        rollback.push(...actionResult.rollback)
      }
      res.push(...actionResult.txes)
    }
  }
  if (!disableRollback) {
    execution.rollback.push(rollback)
  }
  if (isDone && execution.parentId !== undefined) {
    const parentWaitTxes = await checkParent(execution, control)
    if (parentWaitTxes !== undefined) {
      res.push(...parentWaitTxes)
    }
  }
  res.push(
    control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, {
      rollback: execution.rollback,
      context: execution.context,
      currentState: state._id,
      status: isDone ? ExecutionStatus.Done : ExecutionStatus.Active
    })
  )
  res.push(
    control.txFactory.createTxCreateDoc(process.class.ExecutionLog, execution.space, {
      execution: execution._id,
      process: execution.process,
      card: execution.card,
      transition: transition._id,
      action: ExecutionLogAction.Transition
    })
  )
  if (errors.length === 0) {
    return res
  } else {
    return [control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, { error: errors })]
  }
}

async function executeAction<T extends Doc> (
  action: Step<T>,
  transition: Ref<Transition>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult> {
  try {
    const method = control.modelDb.findObject(action.methodId)
    if (method === undefined) throw processError(process.error.MethodNotFound, { methodId: action.methodId }, {}, true)
    const impl = control.hierarchy.as(method, serverProcess.mixin.MethodImpl) as MethodImpl<T>
    if (impl === undefined) throw processError(process.error.MethodNotFound, { methodId: action.methodId }, {}, true)
    const params = await fillParams(action.params, execution, control)
    const f = await getResource(impl.func)
    const res = await f(params, execution, control)
    if (!isError(res) && action.context?._id != null && res.context != null) {
      execution.context[action.context._id] = res.context
    }
    return res
  } catch (err) {
    if (err instanceof ProcessError) {
      if (err.shouldLog) {
        control.ctx.error(err.message, { props: err.props })
      }
      return parseError(err, transition)
    } else {
      const errorId = generateId()
      control.ctx.error(err instanceof Error ? err.message : String(err), { errorId })
      return parseError(processError(process.error.InternalServerError, { errorId }), transition)
    }
  }
}

async function fillValue (
  value: any,
  context: SelectedContext,
  control: TriggerControl,
  execution: Execution
): Promise<any> {
  for (const func of context.functions ?? []) {
    const transform = control.modelDb.findObject(func.func)
    if (transform === undefined) throw processError(process.error.MethodNotFound, { methodId: func.func }, {}, true)
    if (!control.hierarchy.hasMixin(transform, serverProcess.mixin.FuncImpl)) {
      throw processError(process.error.MethodNotFound, { methodId: func.func }, {}, true)
    }
    const funcImpl = control.hierarchy.as(transform, serverProcess.mixin.FuncImpl)
    const f = await getResource(funcImpl.func)
    value = await f(value, func.props, control, execution)
  }
  return value
}

async function getNestedValue (
  control: TriggerControl,
  execution: Execution,
  context: SelectedNested
): Promise<any | ExecutionError> {
  const cardValue = await control.findAll(control.ctx, cardPlugin.class.Card, { _id: execution.card }, { limit: 1 })
  if (cardValue.length === 0) throw processError(process.error.ObjectNotFound, { _id: execution.card }, {}, true)
  const attr = control.hierarchy.findAttribute(cardValue[0]._class, context.path)
  if (attr === undefined) throw processError(process.error.AttributeNotExists, { key: context.path })
  const nestedValue = getObjectValue(context.path, cardValue[0])
  if (nestedValue === undefined) throw processError(process.error.EmptyAttributeContextValue, {}, { attr: attr.label })
  const parentType = attr.type._class === core.class.ArrOf ? (attr.type as ArrOf<Doc>).of : attr.type
  const targetClass = parentType._class === core.class.RefTo ? (parentType as RefTo<Doc>).to : parentType._class
  const target = await control.findAll(control.ctx, targetClass, {
    _id: { $in: Array.isArray(nestedValue) ? nestedValue : [nestedValue] }
  })
  if (target.length === 0) throw processError(process.error.RelatedObjectNotFound, {}, { attr: attr.label })
  const nested = control.hierarchy.findAttribute(targetClass, context.key)
  if (context.sourceFunction !== undefined) {
    const transform = control.modelDb.findObject(context.sourceFunction)
    if (transform === undefined) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    if (!control.hierarchy.hasMixin(transform, serverProcess.mixin.FuncImpl)) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    const funcImpl = control.hierarchy.as(transform, serverProcess.mixin.FuncImpl)
    const f = await getResource(funcImpl.func)
    const reduced = await f(target, {}, control, execution)
    const val = getObjectValue(context.key, reduced)
    if (val == null) {
      throw processError(
        process.error.EmptyRelatedObjectValue,
        {},
        { parent: attr.label, attr: nested?.label ?? getEmbeddedLabel(context.key) }
      )
    }
    return val
  }
  const val = getObjectValue(context.key, target[0])
  if (val == null) {
    throw processError(
      process.error.EmptyRelatedObjectValue,
      {},
      { parent: attr.label, attr: nested?.label ?? getEmbeddedLabel(context.key) }
    )
  }
  return val
}

async function getRelationValue (
  control: TriggerControl,
  execution: Execution,
  context: SelectedRelation
): Promise<any> {
  const assoc = control.modelDb.findObject(context.association)
  if (assoc === undefined) throw processError(process.error.RelationNotExists, {})
  const targetClass = context.direction === 'A' ? assoc.classA : assoc.classB
  const q = context.direction === 'A' ? { docB: execution.card } : { docA: execution.card }
  const relations = await control.findAll(control.ctx, core.class.Relation, { association: assoc._id, ...q })
  const name = context.direction === 'A' ? assoc.nameA : assoc.nameB
  if (relations.length === 0) throw processError(process.error.RelatedObjectNotFound, { attr: name })
  const ids = relations.map((it) => {
    return context.direction === 'A' ? it.docA : it.docB
  })
  const target = await control.findAll(control.ctx, targetClass, { _id: { $in: ids } })
  if (target.length === 0) throw processError(process.error.RelatedObjectNotFound, { attr: context.name })
  const attr = context.key !== '' ? control.hierarchy.findAttribute(targetClass, context.key) : undefined
  if (context.sourceFunction !== undefined) {
    const transform = control.modelDb.findObject(context.sourceFunction)
    if (transform === undefined) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    if (!control.hierarchy.hasMixin(transform, serverProcess.mixin.FuncImpl)) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    const funcImpl = control.hierarchy.as(transform, serverProcess.mixin.FuncImpl)
    const f = await getResource(funcImpl.func)
    const reduced = await f(target, {}, control, execution)
    const val = Array.isArray(reduced)
      ? reduced.map((v) => getObjectValue(context.key, v))
      : getObjectValue(context.key, reduced)
    if (val == null) {
      throw processError(
        process.error.EmptyRelatedObjectValue,
        { parent: name },
        { attr: attr?.label ?? getEmbeddedLabel(context.name) }
      )
    }
    return val
  }
  const val =
    Array.isArray(target) && target.length > 1
      ? target.map((v) => getObjectValue(context.key, v))
      : getObjectValue(context.key, target[0])
  if (val == null) {
    throw processError(
      process.error.EmptyRelatedObjectValue,
      { parent: name },
      { attr: attr?.label ?? getEmbeddedLabel(context.name) }
    )
  }
  return val
}

async function fillParams<T extends Doc> (
  params: MethodParams<T>,
  execution: Execution,
  control: TriggerControl
): Promise<MethodParams<T>> {
  const res: MethodParams<T> = {}
  for (const key in params) {
    const value = (params as any)[key]
    const valueResult = await getContextValue(value, control, execution)
    ;(res as any)[key] = valueResult
  }
  return res
}

async function getContextValue (value: any, control: TriggerControl, execution: Execution): Promise<any> {
  const context = parseContext(value)
  if (context !== undefined) {
    let value: any | undefined
    try {
      if (context.type === 'attribute') {
        value = await getAttributeValue(control, execution, context)
      } else if (context.type === 'relation') {
        value = await getRelationValue(control, execution, context)
      } else if (context.type === 'nested') {
        value = await getNestedValue(control, execution, context)
      } else if (context.type === 'userRequest') {
        value = getUserRequestValue(control, execution, context)
      } else if (context.type === 'function') {
        value = await getFunctionValue(control, execution, context)
      } else if (context.type === 'context') {
        value = getExecutionContextValue(control, execution, context)
      }
      return await fillValue(value, context, control, execution)
    } catch (err: any) {
      if (err instanceof ProcessError && context.fallbackValue !== undefined) {
        return await fillValue(context.fallbackValue, context, control, execution)
      }
      throw err
    }
  } else {
    return value
  }
}

async function getFunctionValue (
  control: TriggerControl,
  execution: Execution,
  context: SelectedContextFunc
): Promise<any> {
  const func = control.modelDb.findObject(context.func)
  if (func === undefined) throw processError(process.error.MethodNotFound, { methodId: context.func }, {}, true)
  const impl = control.hierarchy.as(func, serverProcess.mixin.FuncImpl)
  if (impl === undefined) throw processError(process.error.MethodNotFound, { methodId: context.func }, {}, true)
  const f = await getResource(impl.func)
  const res = await f(null, context.props, control, execution)
  if (context.sourceFunction !== undefined) {
    const transform = control.modelDb.findObject(context.sourceFunction)
    if (transform === undefined) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    if (!control.hierarchy.hasMixin(transform, serverProcess.mixin.FuncImpl)) {
      throw processError(process.error.MethodNotFound, { methodId: context.sourceFunction }, {}, true)
    }
    const funcImpl = control.hierarchy.as(transform, serverProcess.mixin.FuncImpl)
    const f = await getResource(funcImpl.func)
    const val = await f(res, {}, control, execution)
    if (val == null) {
      throw processError(process.error.EmptyFunctionResult, {}, { func: func.label })
    }
    return val
  }
  if (res == null) {
    throw processError(process.error.EmptyFunctionResult, {}, { func: func.label })
  }
  return res
}

function getUserRequestValue (control: TriggerControl, execution: Execution, context: SelectedUserRequest): any {
  const userContext = execution.context[context.id]
  if (userContext !== undefined) return userContext
  const attr = control.hierarchy.findAttribute(context._class, context.key)
  throw processError(
    process.error.UserRequestedValueNotProvided,
    {},
    { attr: attr?.label ?? getEmbeddedLabel(context.key) }
  )
}

function getExecutionContextValue (
  control: TriggerControl,
  execution: Execution,
  context: SelectedExecutonContext
): any {
  const userContext = execution.context[context.id]
  if (userContext !== undefined) return userContext
  const _process = control.modelDb.findObject(execution.process)
  if (_process === undefined) return
  const ctx = _process.context[context.id]
  if (ctx === undefined) return
  throw processError(process.error.ContextValueNotProvided, { name: ctx.name })
}

async function initState (execution: Execution, control: TriggerControl): Promise<Tx[]> {
  const _process = control.modelDb.findObject(execution.process)
  if (_process === undefined) return []
  const transition = control.modelDb.findAllSync(process.class.Transition, {
    process: execution.process,
    from: null
  })[0]
  if (transition === undefined) return []
  const errors: ExecutionError[] = []
  const res: Tx[] = []
  const rollback: Tx[] = []
  rollback.push(control.txFactory.createTxRemoveDoc(execution._class, execution.space, execution._id))
  for (const action of transition.actions) {
    const actionResult = await executeAction(action, transition._id, execution, control)
    if (isError(actionResult)) {
      errors.push(actionResult)
    } else {
      if (actionResult.rollback !== undefined) {
        rollback.push(...actionResult.rollback)
      }
      res.push(...actionResult.txes)
    }
  }
  execution.rollback.push(rollback)
  res.push(
    control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, {
      currentState: transition.to,
      rollback: execution.rollback,
      context: execution.context,
      status: ExecutionStatus.Active
    })
  )
  res.push(
    control.txFactory.createTxCreateDoc(process.class.ExecutionLog, execution.space, {
      execution: execution._id,
      process: execution.process,
      card: execution.card,
      transition: transition._id,
      action: ExecutionLogAction.Started
    })
  )
  if (errors.length === 0) {
    return res
  } else {
    return [control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, { error: errors })]
  }
}

async function checkParent (execution: Execution, control: TriggerControl): Promise<Tx[] | undefined> {
  const subProcesses = await control.findAll(control.ctx, process.class.Execution, {
    parentId: execution.parentId,
    status: ExecutionStatus.Active
  })
  const filtered = subProcesses.filter((it) => it._id !== execution._id)
  if (filtered.length !== 0) return
  const parent = (await control.findAll(control.ctx, process.class.Execution, { _id: execution.parentId }))[0]
  if (parent === undefined) return
  const res: Tx[] = []
  const _process = control.modelDb.findObject(parent.process)
  if (_process === undefined) return res
  if (parent.status !== ExecutionStatus.Active) return res
  const transitions = control.modelDb.findAllSync(process.class.Transition, {
    from: parent.currentState,
    process: parent.process,
    trigger: process.trigger.OnSubProcessesDone
  })
  const transition = await pickTransition(control, execution, transitions, execution)
  if (transition === undefined) return res
  res.push(...(await executeTransition(parent, transition, control, [], true)))
  return res
}

export async function OnExecutionTransition (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxUpdateDoc) continue
    const updateTx = tx as TxUpdateDoc<Execution>
    if (!control.hierarchy.isDerived(updateTx.objectClass, process.class.Execution)) continue
    if (updateTx.operations.currentState === undefined) continue
    const execution = (
      await control.findAll(control.ctx, process.class.Execution, { _id: updateTx.objectId }, { limit: 1 })
    )[0]
    const cardUpdateTransitions = control.modelDb.findAllSync(process.class.Transition, {
      from: execution.currentState,
      process: execution.process,
      trigger: process.trigger.OnCardUpdate
    })
    if (cardUpdateTransitions.length > 0) {
      const doc = (await control.findAll(control.ctx, cardPlugin.class.Card, { _id: execution.card }, { limit: 1 }))[0]
      if (doc !== undefined) {
        const transition = await pickTransition(control, execution, cardUpdateTransitions, doc)
        if (transition !== undefined) {
          res.push(...(await executeTransition(execution, transition, control, [])))
          continue
        }
      }
    } else {
      const subProcessesTransitions = control.modelDb.findAllSync(process.class.Transition, {
        from: execution.currentState,
        process: execution.process,
        trigger: process.trigger.OnSubProcessesDone
      })
      if (subProcessesTransitions.length > 0) {
        const subProcesses = await control.findAll(control.ctx, process.class.Execution, {
          parentId: execution._id,
          status: ExecutionStatus.Active
        })
        if (subProcesses.length === 0) {
          const transition = await pickTransition(control, execution, subProcessesTransitions, execution)
          if (transition !== undefined) {
            res.push(...(await executeTransition(execution, transition, control, [])))
            continue
          }
        }
      }
    }
  }
  return res
}

export async function OnExecutionCreate (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxCreateDoc) continue
    const createTx = tx as TxCreateDoc<Execution>
    if (!control.hierarchy.isDerived(createTx.objectClass, process.class.Execution)) continue
    const execution = TxProcessor.createDoc2Doc(createTx)

    res.push(...(await initState(execution, control)))
  }
  return res
}

export async function OnProcessToDoRemove (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxRemoveDoc) continue
    const removeTx = tx as TxRemoveDoc<ProcessToDo>
    if (!control.hierarchy.isDerived(removeTx.objectClass, process.class.ProcessToDo)) continue
    const removedTodo = control.removedMap.get(removeTx.objectId) as ProcessToDo
    if (removedTodo === undefined) continue
    const execution = (await control.findAll(control.ctx, process.class.Execution, { _id: removedTodo.execution }))[0]
    if (execution === undefined) continue
    if (removedTodo.withRollback) {
      const rollback = execution.rollback.pop()
      if (rollback !== undefined) {
        for (const rollbackTx of rollback) {
          res.push(rollbackTx)
        }
        res.push(
          control.txFactory.createTxCreateDoc(process.class.ExecutionLog, execution.space, {
            execution: execution._id,
            process: execution.process,
            card: execution.card,
            action: ExecutionLogAction.Rollback
          })
        )
      }
    } else {
      const transitions = control.modelDb.findAllSync(process.class.Transition, {
        from: execution.currentState,
        process: execution.process,
        trigger: process.trigger.OnToDoRemove
      })
      const transition = await pickTransition(control, execution, transitions, removedTodo)
      if (transition === undefined) continue
      const rollback: Tx[] = [
        control.txFactory.createTxCreateDoc(
          removedTodo._class,
          removedTodo.space,
          {
            ...removedTodo
          },
          removedTodo._id,
          removedTodo.modifiedOn,
          removeTx.modifiedBy
        )
      ]
      res.push(...(await executeTransition(execution, transition, control, rollback)))
    }
  }
  return res
}

export async function CreateToDo (
  params: MethodParams<ProcessToDo>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult | undefined> {
  for (const key in { user: params.user, title: params.title }) {
    const val = (params as any)[key]
    if (isEmpty(val)) {
      throw processError(process.error.RequiredParamsNotProvided, { params: key })
    }
  }
  if (params.user === undefined || params.title === undefined) return
  const res: Tx[] = []
  const rollback: Tx[] = []
  const id = generateId<ProcessToDo>()
  res.push(
    control.txFactory.createTxCreateDoc(
      process.class.ProcessToDo,
      time.space.ToDos,
      {
        attachedTo: execution.card,
        attachedToClass: cardPlugin.class.Card,
        collection: 'todos',
        workslots: 0,
        execution: execution._id,
        title: params.title,
        user: params.user,
        description: params.description ?? '',
        dueDate: params.dueDate,
        priority: params.priority ?? ToDoPriority.NoPriority,
        visibility: 'public',
        rank: '',
        withRollback: params.withRollback ?? false
      },
      id
    )
  )
  return { txes: res, rollback, context: id }
}

export async function CreateCard (
  params: MethodParams<Card>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult | undefined> {
  const { _class, title, ...attrs } = params
  for (const key in { _class, title }) {
    const val = (params as any)[key]
    if (isEmpty(val)) {
      throw processError(process.error.RequiredParamsNotProvided, { params: key })
    }
  }
  const _id = generateId<Card>()
  const data = {
    title,
    ...attrs
  } as any
  const res: Tx[] = [control.txFactory.createTxCreateDoc(_class as Ref<MasterTag>, execution.space, data, _id)]
  const rollback: Tx[] = [control.txFactory.createTxRemoveDoc(_class as Ref<MasterTag>, execution.space, _id)]
  return { txes: res, rollback, context: _id }
}

export async function AddRelation (
  params: MethodParams<Relation>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult | undefined> {
  const _id = generateId<Relation>()
  const association = params.association as Ref<Association>
  if (isEmpty(association)) {
    throw processError(process.error.RequiredParamsNotProvided, { params: 'association' })
  }
  if (isEmpty(params._id)) {
    throw processError(process.error.RequiredParamsNotProvided, { params: '_id' })
  }
  if (isEmpty(params.direction)) {
    throw processError(process.error.RequiredParamsNotProvided, { params: 'direction' })
  }
  const targetId = params._id as Ref<Doc>
  const direction = params.direction as 'A' | 'B'
  const docA = direction === 'A' ? targetId : execution.card
  const docB = direction === 'A' ? execution.card : targetId
  const data: Data<Relation> = {
    association,
    docA,
    docB
  }
  const res: Tx[] = [control.txFactory.createTxCreateDoc(core.class.Relation, core.space.Workspace, data, _id)]
  const rollback: Tx[] = [control.txFactory.createTxRemoveDoc(core.class.Relation, core.space.Workspace, _id)]
  return { txes: res, rollback, context: _id }
}

export async function UpdateCard (
  params: MethodParams<Card>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult | undefined> {
  if (Object.keys(params).length === 0) return
  const target = (await control.findAll(control.ctx, cardPlugin.class.Card, { _id: execution.card }, { limit: 1 }))[0]
  if (target === undefined) return
  const update: Record<string, any> = {}
  const prevValue: Record<string, any> = {}
  for (const key in params) {
    prevValue[key] = (target as any)[key]
    update[key] = (params as any)[key]
  }
  const res: Tx[] = [control.txFactory.createTxUpdateDoc(target._class, target.space, target._id, update)]
  const rollback: Tx[] = [control.txFactory.createTxUpdateDoc(target._class, target.space, target._id, prevValue)]
  return { txes: res, rollback, context: null }
}

export async function RunSubProcess (
  params: MethodParams<Execution>,
  execution: Execution,
  control: TriggerControl
): Promise<ExecuteResult | undefined> {
  if (params._id === undefined) return
  const card = params.card ?? execution.card
  const processId = params._id as Ref<Process>
  const target = control.modelDb.findObject(processId)
  if (target === undefined) return
  const res: Tx[] = []
  const context: Ref<Execution>[] = []
  for (const _card of Array.isArray(card) ? card : [card]) {
    if (target.parallelExecutionForbidden === true) {
      const currentExecution = await control.findAll(control.ctx, process.class.Execution, {
        process: target._id,
        card: _card,
        done: false
      })
      if (currentExecution.length > 0) {
        // todo, show erro after merge another pr
        continue
      }
    }
    const initTransition = control.modelDb.findAllSync(process.class.Transition, { process: target._id, from: null })[0]
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const emptyContext = {} as ExecutionContext
    const id = generateId<Execution>()
    res.push(
      control.txFactory.createTxCreateDoc(
        process.class.Execution,
        core.space.Workspace,
        {
          process: processId,
          currentState: initTransition.to,
          card: _card,
          context: emptyContext,
          status: ExecutionStatus.Active,
          rollback: [],
          parentId: execution._id
        },
        id
      )
    )
    context.push(id)
  }
  return { txes: res, rollback: undefined, context }
}

export async function RoleContext (
  value: null,
  props: Record<string, any>,
  control: TriggerControl,
  execution: Execution
): Promise<Ref<Employee>[]> {
  const targetRole = props.target
  if (targetRole === undefined) return []
  const users = await control.findAll(control.ctx, contact.class.UserRole, { role: targetRole })
  return users.map((it) => it.user)
}

export async function OnExecutionContinue (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxUpdateDoc) continue
    if (tx.space !== core.space.Tx) continue
    const updateTx = tx as TxUpdateDoc<Execution>
    if (!control.hierarchy.isDerived(updateTx.objectClass, process.class.Execution)) continue
    const execution = (
      await control.findAll(control.ctx, process.class.Execution, { _id: updateTx.objectId }, { limit: 1 })
    )[0]
    if (execution === undefined) continue
    const error = execution.error
    if (error == null) continue
    res.push(control.txFactory.createTxUpdateDoc(execution._class, execution.space, execution._id, { error: null }))
    const _process = await control.modelDb.findOne(process.class.Process, { _id: execution.process })
    if (_process === undefined) continue
    const transition = control.modelDb.findObject(error[0].transition)
    if (transition !== undefined) {
      res.push(...(await executeTransition(execution, transition, control, [])))
    }
  }
  return res
}

export async function OnProcessRemove (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxRemoveDoc) continue
    const removeTx = tx as TxRemoveDoc<Process>
    if (!control.hierarchy.isDerived(removeTx.objectClass, process.class.Process)) continue
    const transition = control.modelDb.findAllSync(process.class.Transition, { process: removeTx.objectId })
    for (const tr of transition) {
      res.push(control.txFactory.createTxRemoveDoc(tr._class, tr.space, tr._id))
    }
    const states = control.modelDb.findAllSync(process.class.State, { process: removeTx.objectId })
    for (const st of states) {
      res.push(control.txFactory.createTxRemoveDoc(st._class, st.space, st._id))
    }
  }
  return res
}

export async function OnStateRemove (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (tx._class !== core.class.TxRemoveDoc) continue
    const removeTx = tx as TxRemoveDoc<State>
    if (!control.hierarchy.isDerived(removeTx.objectClass, process.class.State)) continue
    const transitions = control.modelDb.findAllSync(process.class.Transition, { to: removeTx.objectId })
    for (const tr of transitions) {
      res.push(control.txFactory.createTxRemoveDoc(tr._class, tr.space, tr._id))
    }
    const state = control.removedMap.get(removeTx.objectId) as State
    if (state === undefined) continue
    const _process = control.modelDb.findObject(state.process)
    if (_process === undefined) continue
    const syncTx = await syncContext(control, _process)
    if (syncTx !== undefined) {
      res.push(syncTx)
    }
  }
  return res
}

export function CheckToDo (params: Record<string, any>, doc: Doc): boolean {
  if (params._id === undefined) return false
  return doc._id === params._id
}

export function OnCardUpdateCheck (params: Record<string, any>, doc: Doc, hierarchy: Hierarchy): boolean {
  const res = matchQuery([doc], params, doc._class, hierarchy, true)
  return res.length > 0
}

export async function OnTransition (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (!control.hierarchy.isDerived(tx._class, core.class.TxCUD)) continue
    const cudTx = tx as TxCUD<Transition>
    if (!control.hierarchy.isDerived(cudTx.objectClass, process.class.Transition)) continue
    const transition =
      (control.removedMap.get(cudTx.objectId) as Transition) ?? control.modelDb.findObject(cudTx.objectId)
    if (transition === undefined) continue
    const _process = control.modelDb.findObject(transition.process)
    if (_process === undefined) continue
    const syncTx = await syncContext(control, _process)
    if (syncTx !== undefined) {
      res.push(syncTx)
    }
  }
  return res
}

export async function OnCardUpdate (txes: Tx[], control: TriggerControl): Promise<Tx[]> {
  const res: Tx[] = []
  for (const tx of txes) {
    if (!control.hierarchy.isDerived(tx._class, core.class.TxCUD)) continue
    const cudTx = tx as TxCUD<Card>
    if (!control.hierarchy.isDerived(cudTx.objectClass, cardPlugin.class.Card)) continue
    const executions = await control.findAll(control.ctx, process.class.Execution, {
      card: cudTx.objectId,
      status: ExecutionStatus.Active
    })
    if (executions.length === 0) continue
    const card = await control.findAll(control.ctx, cardPlugin.class.Card, { _id: cudTx.objectId }, { limit: 1 })
    if (card.length === 0) continue
    for (const execution of executions) {
      const transitions = control.modelDb.findAllSync(process.class.Transition, {
        from: execution.currentState,
        process: execution.process,
        trigger: process.trigger.OnCardUpdate
      })
      const transition = await pickTransition(control, execution, transitions, card[0])
      if (transition === undefined) continue
      res.push(...(await executeTransition(execution, transition, control, [])))
    }
  }
  return res
}

async function syncContext (control: TriggerControl, _process: Process): Promise<Tx | undefined> {
  const transitions = control.modelDb.findAllSync(process.class.Transition, { process: _process._id })
  const exists = new Set<ContextId>()
  let changed = false
  let index = 1
  for (const transition of transitions) {
    for (const action of transition.actions) {
      if (action.context != null) {
        exists.add(action.context._id)
        const method = control.modelDb.findObject(action.methodId)
        const current = _process.context[action.context._id]
        if (method?.contextClass != null) {
          changed = true
          const ctx: SelectedExecutonContext = {
            type: 'context',
            id: action.context._id,
            key: ''
          }
          _process.context[action.context._id] = {
            name: current?.name ?? '',
            _class: action.context._class ?? method.contextClass,
            action: action._id,
            index: index++,
            producer: transition._id,
            value: ctx
          }
        }
      }
      if (action.result?._id != null) {
        exists.add(action.result._id)
        const context = _process.context[action.result._id]
        changed = true
        const ctx: SelectedExecutonContext = {
          type: 'context',
          id: action.result._id,
          key: ''
        }
        _process.context[action.result._id] = {
          name: context?.name ?? action.result.name,
          isResult: true,
          type: action.result.type,
          _class: action.result.type._class,
          action: action._id,
          index: index++,
          producer: transition._id,
          value: ctx
        }
      }
    }
  }
  const newContext: Record<ContextId, ProcessContext> = {}
  for (const key of Object.keys(_process.context) as ContextId[]) {
    if (exists.has(key)) {
      newContext[key] = _process.context[key]
      continue
    }
    changed = true
  }
  if (changed) {
    return control.txFactory.createTxUpdateDoc(_process._class, _process.space, _process._id, {
      context: newContext
    })
  }
}

function isEmpty (value: any): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  func: {
    RunSubProcess,
    CreateToDo,
    UpdateCard,
    CreateCard,
    AddRelation,
    CheckToDo,
    OnCardUpdateCheck
  },
  transform: {
    FirstValue,
    LastValue,
    Random,
    All,
    UpperCase,
    LowerCase,
    Trim,
    Prepend,
    Append,
    Replace,
    ReplaceAll,
    Split,
    Cut,
    Add,
    Subtract,
    Multiply,
    Divide,
    Modulo,
    Power,
    Round,
    Absolute,
    Ceil,
    Floor,
    Offset,
    FirstWorkingDayAfter,
    RoleContext,
    Insert,
    Remove,
    RemoveFirst,
    RemoveLast
  },
  trigger: {
    OnProcessRemove,
    OnStateRemove,
    OnTransition,
    OnCardUpdate,
    OnExecutionCreate,
    OnExecutionTransition,
    OnProcessToDoClose,
    OnProcessToDoRemove,
    OnExecutionContinue
  }
})
