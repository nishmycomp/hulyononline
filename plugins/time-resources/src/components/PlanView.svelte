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
  import { createEventDispatcher, afterUpdate, onDestroy } from 'svelte'
  import calendar, { AccessLevel, Calendar, generateEventId, getPrimaryCalendar } from '@hcengineering/calendar'
  import { getCurrentEmployee } from '@hcengineering/contact'
  import { Ref, getCurrentAccount } from '@hcengineering/core'
  import { getClient } from '@hcengineering/presentation'
  import { TagElement } from '@hcengineering/tags'
  import { Separator, defineSeparators, deviceOptionsStore as deviceInfo } from '@hcengineering/ui'
  import { ToDosMode } from '..'
  import PlanningCalendar from './PlanningCalendar.svelte'
  import ToDosNavigator from './ToDosNavigator.svelte'
  import ToDos from './ToDos.svelte'
  import { findPrimaryCalendar, timeSeparators } from '../utils'
  import { dragging } from '../dragging'
  import time from '../plugin'
  import { Analytics } from '@hcengineering/analytics'
  import { TimeEvents } from '@hcengineering/time'

  const dispatch = createEventDispatcher()

  const defaultDuration = 30 * 60 * 1000
  let mainPanel: HTMLElement
  let replacedPanel: HTMLElement

  let currentDate: Date = new Date()

  $: dragItem = $dragging.item
  $: visibleCalendar = $deviceInfo.docWidth > 800

  const client = getClient()

  async function drop (e: CustomEvent<any>) {
    if (dragItem === null) return
    const doc = dragItem
    const date = e.detail.date.getTime()
    const currentAccount = getCurrentAccount()
    const _calendar = await findPrimaryCalendar()
    const dueDate = date + defaultDuration
    await client.addCollection(time.class.WorkSlot, calendar.space.Calendar, doc._id, doc._class, 'workslots', {
      calendar: _calendar,
      eventId: generateEventId(),
      date,
      dueDate,
      description: doc.description,
      participants: [getCurrentEmployee()],
      title: doc.title,
      allDay: false,
      blockTime: true,
      access: AccessLevel.Owner,
      visibility: doc.visibility === 'public' ? 'public' : 'freeBusy',
      reminders: [],
      user: currentAccount.primarySocialId
    })
    Analytics.handleEvent(TimeEvents.ToDoScheduled, { id: doc._id })
  }

  defineSeparators('time', timeSeparators)

  let mode: ToDosMode = (localStorage.getItem('todos_last_mode') as ToDosMode) ?? 'unplanned'
  let tag: Ref<TagElement> | undefined = (localStorage.getItem('todos_last_tag') as Ref<TagElement>) ?? undefined

  dispatch('change', true)
  afterUpdate(() => {
    $deviceInfo.replacedPanel = replacedPanel ?? mainPanel
  })
  onDestroy(() => ($deviceInfo.replacedPanel = undefined))
</script>

{#if $deviceInfo.navigator.visible}
  <ToDosNavigator bind:mode bind:tag bind:currentDate />
  <Separator name={'time'} float={$deviceInfo.navigator.float} index={0} color={'var(--theme-divider-color)'} />
{/if}
<div
  class="flex-col w-full clear-mins mobile-wrapper"
  class:left-divider={!$deviceInfo.navigator.visible}
  class:right-divider={!visibleCalendar}
  bind:this={mainPanel}
>
  <ToDos {mode} {tag} bind:currentDate />
</div>
{#if visibleCalendar}
  <Separator name={'time'} index={1} color={'transparent'} separatorSize={0} short />
  <PlanningCalendar
    {dragItem}
    bind:element={replacedPanel}
    bind:currentDate
    displayedDaysCount={5}
    on:dragDrop={drop}
  />
{/if}
