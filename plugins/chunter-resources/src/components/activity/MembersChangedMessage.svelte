<!--
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
-->

<script lang="ts">
  import { DocAttributeUpdates, DocUpdateMessage } from '@hcengineering/activity'
  import { Employee, Person } from '@hcengineering/contact'
  import { AccountUuid, notEmpty, PersonId } from '@hcengineering/core'
  import { PersonPresenter, employeeByAccountStore, employeeByPersonIdStore } from '@hcengineering/contact-resources'
  import { ChunterSpace } from '@hcengineering/chunter'
  import { Label } from '@hcengineering/ui'
  import view from '@hcengineering/view'

  import chunter from '../../plugin'
  import ChannelIcon from '../ChannelIcon.svelte'

  export let message: DocUpdateMessage
  export let value: DocAttributeUpdates
  export let object: ChunterSpace | undefined

  let addedPersons: Person[] = []
  let removedPersons: Person[] = []

  $: addedPersons = getPersons(value.added.length > 0 ? value.added : value.set, $employeeByAccountStore)
  $: removedPersons = getPersons(value.removed, $employeeByAccountStore)

  function getPersons (
    accounts: DocAttributeUpdates['removed' | 'added' | 'set'],
    employeeByAccountStore: Map<AccountUuid, Employee>
  ): Person[] {
    const accs = new Set(accounts) as Set<AccountUuid>

    return Array.from(accs)
      .map((acc) => employeeByAccountStore.get(acc))
      .filter(notEmpty)
  }

  $: creatorPerson = $employeeByPersonIdStore.get(message.createdBy as PersonId)

  $: isJoined =
    creatorPerson !== undefined &&
    removedPersons.length === 0 &&
    addedPersons.length === 1 &&
    addedPersons[0]._id === creatorPerson._id
  $: isLeave =
    creatorPerson !== undefined &&
    removedPersons.length === 1 &&
    addedPersons.length === 0 &&
    removedPersons[0]._id === creatorPerson._id
  $: differentActions = addedPersons.length > 0 && removedPersons.length > 0
</script>

<span class="text overflow-label">
  {#if addedPersons.length > 0}
    <span class="inline-flex flex-gap-1">
      {#if isJoined}
        <span class="lower">
          <Label label={chunter.string.Joined} />
        </span>
        <span class="inline-flex"><ChannelIcon value={object} size="x-small" /> {object?.name}</span>
      {:else}
        <Label label={chunter.string.Added} />
        {#each addedPersons as person, index}
          <PersonPresenter value={person} shouldShowAvatar={false} colorInherit overflowLabel={false} />
          {#if index < addedPersons.length - 1}
            <span class="separator"> , </span>
          {/if}
        {/each}
      {/if}
    </span>
  {/if}
  {#if differentActions}
    <Label label={view.string.And} />
  {/if}

  {#if removedPersons.length > 0}
    <span class="inline-flex flex-gap-1">
      {#if isLeave}
        <span class="lower">
          <Label label={chunter.string.Left} />
        </span>
        <span class="inline-flex"><ChannelIcon value={object} size="x-small" /> {object?.name}</span>
      {:else}
        <span class:lower={differentActions}>
          <Label label={chunter.string.Removed} />
        </span>
        {#each removedPersons as person, index}
          <PersonPresenter value={person} shouldShowAvatar={false} colorInherit overflowLabel={false} />
          {#if index < removedPersons.length - 1}
            <span class="separator"> , </span>
          {/if}
        {/each}
      {/if}
    </span>
  {/if}
</span>

<style lang="scss">
  .inline-flex {
    display: inline-flex;
    align-items: center;
  }

  .text {
    color: var(--global-secondary-TextColor);
  }

  .separator {
    margin-left: -0.25rem;
  }
</style>
