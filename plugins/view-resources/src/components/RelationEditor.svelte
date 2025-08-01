<script lang="ts">
  import core, { Association, Doc, WithLookup } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { Button, IconAdd, Label, Scroller, Section, showPopup } from '@hcengineering/ui'
  import { showMenu } from '../actions'
  import { Viewlet, ViewletPreference } from '@hcengineering/view'
  import DocTable from './DocTable.svelte'
  import ObjectBoxPopup from './ObjectBoxPopup.svelte'
  import view from '../plugin'

  export let object: Doc
  export let docs: Doc[]
  export let label: IntlString
  export let association: Association
  export let readonly: boolean = false
  export let direction: 'A' | 'B'
  export let emptyKind: 'create' | 'placeholder' = 'create'

  const client = getClient()

  $: _class = direction === 'B' ? association.classB : association.classA

  function add (): void {
    showPopup(
      ObjectBoxPopup,
      {
        _class,
        docQuery: { _id: { $nin: docs.map((p) => p._id) } },
        docProps: {
          shouldShowAvatar: true
        }
      },
      'top',
      async (result) => {
        if (result != null) {
          const client = getClient()
          await client.createDoc(core.class.Relation, core.space.Workspace, {
            docA: direction === 'B' ? object._id : result._id,
            docB: direction === 'B' ? result._id : object._id,
            association: association._id
          })
        }
      }
    )
  }

  let viewlet: WithLookup<Viewlet> | undefined
  let preference: ViewletPreference | undefined = undefined

  const query = createQuery()

  $: query.query(
    view.class.Viewlet,
    {
      attachTo: client.getHierarchy().getBaseClass(_class)
    },
    (res) => {
      viewlet = res[0]
    },
    {
      lookup: {
        descriptor: view.class.ViewletDescriptor
      }
    }
  )

  const preferenceQuery = createQuery()

  $: if (viewlet != null) {
    preferenceQuery.query(
      view.class.ViewletPreference,
      {
        space: core.space.Workspace,
        attachedTo: viewlet._id
      },
      (res) => {
        preference = res[0]
      },
      { limit: 1 }
    )
  } else {
    preferenceQuery.unsubscribe()
    preference = undefined
  }

  $: selectedConfig = preference?.config ?? viewlet?.config
  $: config = selectedConfig?.filter((p) =>
    typeof p === 'string'
      ? !p.includes('$lookup') && !p.startsWith('@')
      : !p.key.includes('$lookup') && !p.key.startsWith('@')
  )

  async function onContextMenu (ev: MouseEvent, doc: Doc): Promise<void> {
    const q =
      direction === 'B'
        ? { docA: object._id, docB: doc._id, association: association._id }
        : { docA: doc._id, docB: object._id, association: association._id }
    const relation = await client.findOne(core.class.Relation, q)
    if (relation !== undefined) {
      showMenu(ev, { object: relation, includedActions: [view.action.RemoveRelation] })
    }
  }

  function isAllowedToCreate (association: Association, docs: Doc[], direction: 'A' | 'B'): boolean {
    if (docs.length === 0 || association.type === 'N:N') return true
    if (association.type === '1:1') return false
    return direction === 'B'
  }

  $: allowToCreate = isAllowedToCreate(association, docs, direction)

  $: classLabel = client.getHierarchy().getClass(_class).label
</script>

<Section {label}>
  <svelte:fragment slot="header">
    <div class="buttons-group xsmall-gap">
      {#if classLabel}
        <Label label={classLabel} />
      {/if}
      {#if !readonly && allowToCreate}
        <Button id={core.string.AddRelation} icon={IconAdd} kind={'ghost'} on:click={add} />
      {/if}
    </div>
  </svelte:fragment>

  <svelte:fragment slot="content">
    {#if docs?.length > 0 && config != null}
      <Scroller horizontal>
        <DocTable objects={docs} {_class} {config} {onContextMenu} />
      </Scroller>
    {:else if !readonly}
      <div
        class="antiSection-empty clear-mins mt-3"
        class:solid={emptyKind === 'create'}
        class:noBorder={emptyKind === 'placeholder'}
      >
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        {#if emptyKind === 'create'}
          <span class="over-underline content-color" on:click={add}>
            <Label label={core.string.AddRelation} />
          </span>
        {:else}
          <span class=" content-color">
            <Label label={view.string.NoRelations} />
          </span>
        {/if}
      </div>
    {/if}
  </svelte:fragment>
</Section>
