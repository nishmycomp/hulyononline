<script lang="ts">
  import contact, { Employee, Person } from '@hcengineering/contact'
  import { type Class, type Doc, type Ref, type Space, SortingOrder } from '@hcengineering/core'
  import { MessageBox, createQuery, getClient } from '@hcengineering/presentation'
  import { makeRank } from '@hcengineering/rank'
  import time, { ToDo, ToDoPriority } from '@hcengineering/time'
  import { CheckBox, getEventPositionElement, showPopup } from '@hcengineering/ui'
  import { onDestroy, onMount } from 'svelte'
  import { NodeViewProps } from '../../node-view'
  import NodeViewWrapper from '../../node-view/NodeViewWrapper.svelte'
  import NodeViewContent from '../../node-view/NodeViewContent.svelte'
  import Component from '@hcengineering/ui/src/components/Component.svelte'

  export let node: NodeViewProps['node']
  export let editor: NodeViewProps['editor']
  export let updateAttributes: NodeViewProps['updateAttributes']
  export let getPos: NodeViewProps['getPos']

  export let objectId: Ref<Doc> | undefined = undefined
  export let objectClass: Ref<Class<Doc>> | undefined = undefined
  export let objectSpace: Ref<Space> | undefined = undefined

  const client = getClient()
  const query = createQuery()

  let focused = false

  function handleSelectionUpdate (): void {
    const selection = editor.state.selection
    const pos = selection.$anchor.pos
    const start = getPos()
    const end = node.firstChild != null ? start + node.firstChild.nodeSize + 1 : start + node.nodeSize
    focused = pos >= start && pos < end
  }

  onMount(() => {
    editor.on('selectionUpdate', handleSelectionUpdate)
  })

  onDestroy(() => {
    editor.off('selectionUpdate', handleSelectionUpdate)
  })

  $: todoable = objectId !== undefined && objectClass !== undefined
  $: todoId = node.attrs.todoid as Ref<ToDo>
  $: userId = node.attrs.userid as Ref<Person>
  $: checked = node.attrs.checked ?? false
  $: readonly = !editor.isEditable || (!todoable && todoId != null)

  let todo: ToDo | undefined = undefined
  $: query.query(
    time.class.ToDo,
    {
      _id: todoId
    },
    (res) => {
      ;[todo] = res
      void syncTodo(todo)
    }
  )

  async function syncTodo (todo: ToDo | undefined): Promise<void> {
    if (todo !== undefined && todo.attachedTo === objectId && todo.attachedToClass === objectClass) {
      const todoChecked = todo.doneOn != null
      if (todo._id !== todoId || todo.user !== userId || todoChecked !== checked) {
        updateAttributes({
          todoid: todo._id,
          userid: todo.user,
          checked: todoChecked
        })
      }
    } else {
      if (node.attrs.todoid != null) {
        updateAttributes({
          todoid: null,
          userid: null
        })
      }
    }
  }

  async function markDone (): Promise<void> {
    if (todo !== undefined) {
      await client.update(todo, { doneOn: todo.doneOn == null ? Date.now() : null })
    } else {
      updateAttributes({ checked: node.attrs.checked !== true })
    }
  }

  async function assignTodo (user: Ref<Employee>): Promise<void> {
    if (todo !== undefined && todo.user === user) return
    if (objectId === undefined || objectClass === undefined || objectSpace === undefined) return

    const title = node.textBetween(0, node.content.size, undefined, ' ')

    const ops = client.apply(undefined, 'assign-todo')

    if (todo !== undefined) {
      await ops.remove(todo)
    }

    const doneOn = node.attrs.checked === true ? Date.now() : null

    const latestTodoItem = await ops.findOne(
      time.class.ToDo,
      {
        user,
        doneOn: doneOn === null ? null : { $ne: null }
      },
      {
        sort: { rank: SortingOrder.Ascending }
      }
    )
    const rank = makeRank(undefined, latestTodoItem?.rank)

    const id = await ops.addCollection(time.class.ProjectToDo, time.space.ToDos, objectId, objectClass, 'todos', {
      attachedSpace: objectSpace,
      title,
      description: '',
      user,
      workslots: 0,
      priority: ToDoPriority.NoPriority,
      visibility: 'public',
      doneOn,
      rank
    })

    await ops.commit()

    updateAttributes({
      todoid: id,
      userid: user
    })
  }

  async function unassignTodo (): Promise<void> {
    updateAttributes({
      todoid: null,
      userid: null
    })

    if (todo !== undefined) {
      await client.remove(todo)
    }
  }

  async function assignTodoConfirm (user: Ref<Employee>): Promise<void> {
    showPopup(
      MessageBox,
      {
        label: time.string.ReassignToDo,
        message: time.string.ReassignToDoConfirm,
        action: async () => {
          await assignTodo(user)
        }
      },
      'top'
    )
  }

  async function unassignTodoConfirm (): Promise<void> {
    showPopup(
      MessageBox,
      {
        label: time.string.UnassignToDo,
        message: time.string.UnassignToDoConfirm,
        action: async () => {
          await unassignTodo()
        }
      },
      'top'
    )
  }

  async function changeAssignee (user: Ref<Employee> | undefined): Promise<void> {
    const shouldConfirm = todo !== undefined && todo?.workslots > 0
    if (user !== undefined) {
      shouldConfirm ? await assignTodoConfirm(user) : await assignTodo(user)
    } else {
      shouldConfirm ? await unassignTodoConfirm() : await unassignTodo()
    }
  }

  let hovered = false

  function handleAssigneeEdit (ev: MouseEvent): void {
    ev.preventDefault()
    ev.stopPropagation()

    hovered = true
    showPopup(
      contact.component.AssigneePopup,
      {
        selected: userId
      },
      getEventPositionElement(ev),
      async (result) => {
        if (result !== undefined && result?._id !== userId) {
          await changeAssignee(result?._id)
        }
        hovered = false
        editor.commands.focus()
      }
    )
  }
</script>

<NodeViewWrapper data-drag-handle="" data-type="todoItem">
  <div
    class="todo-item flex-row-top flex-gap-2"
    class:empty={node.textContent.length === 0}
    class:unassigned={userId == null}
    class:hovered
    class:focused
  >
    {#if todoable}
      <div class="flex-center assignee" contenteditable="false">
        <Component
          is={contact.component.EmployeePresenter}
          props={{
            value: userId,
            disabled: readonly,
            avatarSize: 'card',
            shouldShowName: false,
            shouldShowPlaceholder: true,
            onEmployeeEdit: handleAssigneeEdit
          }}
        />
      </div>
    {/if}

    <div class="flex-center todo-check" contenteditable="false">
      <CheckBox {readonly} {checked} on:value={markDone} kind={'positive'} size={'medium'} />
    </div>

    <NodeViewContent style="outline: none;" class="flex-grow" />
  </div>
</NodeViewWrapper>

<style lang="scss">
  .todo-item {
    .assignee {
      z-index: 50;
      width: 1.25rem;
      cursor: pointer;
    }
    .assignee,
    .todo-check {
      height: 1.5em;
      padding-right: 0.125rem;
    }

    &.unassigned {
      & > .assignee {
        opacity: 0;
      }
    }

    &.empty {
      & > .assignee {
        visibility: hidden;
      }
    }

    &.hovered,
    &.focused,
    &:hover {
      & > .assignee {
        opacity: 1;
      }
    }
  }
</style>
