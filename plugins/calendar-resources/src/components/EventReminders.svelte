<!--
// Copyright © 2023 Hardcore Engineering Inc.
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
  import { Button, eventToHTMLElement, Icon, Scroller, IconMoreV, showPopup, Label } from '@hcengineering/ui'
  import calendar from '../plugin'
  import ReminderPopup from './ReminderPopup.svelte'
  import EventReminderItem from './EventReminderItem.svelte'

  export let reminders: number[]
  export let disabled: boolean = false
  export let focusIndex = -1

  const maxReminders: number = 4
  let shown: boolean = false

  function addReminder (e: MouseEvent) {
    showPopup(ReminderPopup, { value: 0 }, eventToHTMLElement(e), (event) => {
      if (event) reminders = [...reminders, event]
    })
  }

  function edit (e: MouseEvent, value: number, index: number) {
    showPopup(ReminderPopup, { value }, eventToHTMLElement(e), (event) => {
      if (event) {
        reminders = [...reminders.slice(0, index), event, ...reminders.slice(index + 1)]
      }
    })
  }

  function remove (index: number) {
    reminders = [...reminders.slice(0, index), ...reminders.slice(index + 1)]
  }
</script>

{#if !disabled}
  <div class="flex-row-center gap-1" class:pb-0-5={reminders.length}>
    <Icon icon={calendar.icon.Notifications} size="small" />
    <Button
      label={reminders.length > 0 ? calendar.string.AddReminder : calendar.string.Reminders}
      {disabled}
      justify={'left'}
      flex="1"
      padding="0.5rem"
      kind={'ghost'}
      {focusIndex}
      on:click={(e) => {
        addReminder(e)
      }}
    />
  </div>
{/if}
{#if reminders.length}
  <Scroller padding={'.125rem 0 0 1.25rem'} shrink>
    {#if disabled}
      <div style="position:absolute; left:0; top:0.625rem">
        <Icon icon={calendar.icon.Participants} size="small" />
      </div>
    {/if}
    {#if reminders.length > maxReminders && !shown}
      {#each reminders.slice(0, maxReminders - 2) as reminder, i}
        <EventReminderItem
          {reminder}
          {disabled}
          on:edit={(event) => {
            if (event.detail) edit(event.detail, reminder, i)
          }}
          on:remove={() => {
            remove(i)
          }}
        />
      {/each}
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <div class="antiOption cursor-pointer step-tb25" tabindex={0}>
        <Button
          icon={IconMoreV}
          kind={'ghost'}
          size={'x-small'}
          padding={'0 .5rem'}
          {disabled}
          focusIndex={-1}
          on:click={() => (shown = true)}
        />
        <span class="overflow-label flex-grow ml-2">
          <Label label={calendar.string.SeeAllNumberReminders} params={{ value: reminders.length }} />
        </span>
      </div>
      <EventReminderItem
        {disabled}
        reminder={reminders[reminders.length - 1]}
        on:edit={(event) => {
          if (event.detail) edit(event.detail, reminders[reminders.length - 1], reminders.length - 1)
        }}
        on:remove={() => {
          remove(reminders.length - 1)
        }}
      />
    {:else}
      {#each reminders as reminder, i}
        <EventReminderItem
          {reminder}
          {disabled}
          on:edit={(event) => {
            if (event.detail) edit(event.detail, reminder, i)
          }}
          on:remove={() => {
            remove(i)
          }}
        />
      {/each}
    {/if}
    <div class="antiVSpacer x0-5" />
  </Scroller>
{/if}
