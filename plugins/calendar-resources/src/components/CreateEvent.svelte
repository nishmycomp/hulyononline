<!--
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
-->
<script lang="ts">
  import {
    AccessLevel,
    Calendar,
    Event,
    ReccuringEvent,
    RecurringRule,
    Visibility,
    generateEventId
  } from '@hcengineering/calendar'
  import { getCurrentEmployee, Person } from '@hcengineering/contact'
  import core, { Class, Doc, Markup, Ref, Space, generateId, getCurrentAccount } from '@hcengineering/core'
  import presentation, {
    createQuery,
    DocCreateExtComponent,
    DocCreateExtensionManager,
    getClient
  } from '@hcengineering/presentation'
  import { EmptyMarkup } from '@hcengineering/text'
  import { StyledTextBox } from '@hcengineering/text-editor-resources'
  import {
    Button,
    EditBox,
    FocusHandler,
    Icon,
    IconClose,
    createFocusManager,
    getUserTimezone,
    showPopup,
    Scroller
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import calendar from '../plugin'
  import { saveUTC } from '../utils'
  import CalendarSelector from './CalendarSelector.svelte'
  import EventParticipants from './EventParticipants.svelte'
  import EventReminders from './EventReminders.svelte'
  import EventTimeEditor from './EventTimeEditor.svelte'
  import EventTimeExtraButton from './EventTimeExtraButton.svelte'
  import LocationEditor from './LocationEditor.svelte'
  import ReccurancePopup from './ReccurancePopup.svelte'
  import VisibilityEditor from './VisibilityEditor.svelte'

  const acc = getCurrentAccount()
  const currentUser = getCurrentEmployee()
  const myPrimaryId = acc.primarySocialId

  export let attachedTo: Ref<Doc> = calendar.ids.NoAttached
  export let attachedToClass: Ref<Class<Doc>> = calendar.class.Event
  export let title: string = ''
  export let date: Date | undefined = undefined
  export let withTime = false
  export let participants: Ref<Person>[] = [currentUser]

  const now = new Date()
  const defaultDuration = 60 * 60 * 1000
  const allDayDuration = 24 * 60 * 60 * 1000 - 1

  const docCreateManager = DocCreateExtensionManager.create(calendar.class.Event)

  let startDate =
    date === undefined ? now.getTime() : withTime ? date.getTime() : date.setHours(now.getHours(), now.getMinutes())
  const duration = defaultDuration
  let dueDate = startDate + duration
  let allDay = false
  let location = ''
  let timeZone: string = getUserTimezone()

  let reminders = [30 * 60 * 1000]

  let description: Markup = EmptyMarkup
  let visibility: Visibility = 'private'
  let _calendar: Ref<Calendar> | undefined = undefined

  const spaceQ = createQuery()
  let space: Space | undefined = undefined
  spaceQ.query(core.class.Space, { _id: calendar.space.Calendar }, (res) => {
    space = res[0]
  })

  let rules: RecurringRule[] = []

  let externalParticipants: string[] = []

  const dispatch = createEventDispatcher()
  const client = getClient()

  export function canClose (): boolean {
    return title !== undefined && title.trim().length === 0 && participants.length === 0
  }

  async function saveEvent () {
    let date: number | undefined
    if (startDate != null) date = startDate
    if (date === undefined) return
    if (_calendar === undefined) return
    if (title === '') return
    const user = myPrimaryId
    const _id = generateId<Event>()
    if (rules.length > 0) {
      await client.addCollection(
        calendar.class.ReccuringEvent,
        calendar.space.Calendar,
        attachedTo,
        attachedToClass,
        'events',
        {
          calendar: _calendar,
          eventId: generateEventId(),
          date: allDay ? saveUTC(date) : date,
          dueDate: allDay ? saveUTC(dueDate) : dueDate,
          externalParticipants,
          rdate: [],
          exdate: [],
          rules,
          reminders,
          description,
          participants,
          visibility,
          title,
          location,
          blockTime: !allDay,
          allDay,
          access: AccessLevel.Owner,
          originalStartTime: allDay ? saveUTC(date) : date,
          timeZone,
          user
        },
        _id as Ref<ReccuringEvent>
      )
    } else {
      await client.addCollection(
        calendar.class.Event,
        calendar.space.Calendar,
        attachedTo,
        attachedToClass,
        'events',
        {
          calendar: _calendar,
          eventId: generateEventId(),
          date: allDay ? saveUTC(date) : date,
          dueDate: allDay ? saveUTC(dueDate) : dueDate,
          externalParticipants,
          description,
          visibility,
          participants,
          reminders,
          title,
          location,
          blockTime: !allDay,
          allDay,
          timeZone,
          access: AccessLevel.Owner,
          user
        },
        _id
      )
    }
    if (space !== undefined) {
      await docCreateManager.commit(client, _id, space, {}, 'post')
    }
    dispatch('close')
  }

  async function allDayChangeHandler () {
    if (allDay) {
      startDate = new Date(startDate).setHours(0, 0, 0, 0)
      if (dueDate - startDate < allDayDuration) dueDate = allDayDuration + startDate
      else dueDate = new Date(dueDate).setHours(23, 59, 59, 999)
    } else {
      dueDate = startDate + defaultDuration
    }
  }

  function setRecurrance () {
    showPopup(ReccurancePopup, { rules, startDate }, undefined, (res) => {
      if (res) {
        rules = res
      }
    })
  }

  const manager = createFocusManager()
</script>

<FocusHandler {manager} />

<div class="eventPopup-container">
  <div class="header flex-between">
    <EditBox
      bind:value={title}
      placeholder={calendar.string.EventTitlePlaceholder}
      kind={'ghost-large'}
      fullSize
      focusable
      autoFocus
      focusIndex={10001}
    />
    <div class="flex-row-center gap-1 flex-no-shrink ml-3">
      <Button
        id="card-close"
        focusIndex={10003}
        icon={IconClose}
        kind={'ghost'}
        size={'small'}
        on:click={() => {
          dispatch('close')
        }}
      />
    </div>
  </div>
  <Scroller thinScrollBars>
    <div class="block first flex-no-shrink">
      <EventTimeEditor {allDay} bind:startDate bind:dueDate {timeZone} focusIndex={10004} />
      <EventTimeExtraButton
        bind:allDay
        bind:timeZone
        bind:rules
        on:repeat={setRecurrance}
        on:allday={allDayChangeHandler}
      />
    </div>
    <div class="block rightCropPadding">
      <LocationEditor focusIndex={10010} bind:value={location} />
      <EventParticipants focusIndex={10011} bind:participants bind:externalParticipants />
    </div>
    <div class="block">
      <DocCreateExtComponent manager={docCreateManager} kind={'body'} />
    </div>
    <div class="block description">
      <div class="top-icon">
        <Icon icon={calendar.icon.Description} size={'small'} />
      </div>
      <StyledTextBox
        alwaysEdit={true}
        isScrollable={false}
        kind={'indented'}
        showButtons={false}
        focusIndex={10100}
        placeholder={calendar.string.Description}
        bind:content={description}
      />
    </div>
    <div class="block rightCropPadding">
      <CalendarSelector bind:value={_calendar} focusIndex={10101} />
      <div class="flex-row-center flex-gap-1">
        <Icon icon={calendar.icon.Hidden} size={'small'} />
        <VisibilityEditor bind:value={visibility} kind="inline" size="medium" focusIndex={10102} withoutIcon />
      </div>
      <EventReminders bind:reminders focusIndex={10103} />
    </div>
  </Scroller>
  <div class="antiDivider noMargin" />
  <div class="flex-between p-5 flex-no-shrink">
    <div />
    <Button
      kind="primary"
      label={presentation.string.Create}
      focusIndex={10104}
      on:click={saveEvent}
      disabled={title === ''}
    />
  </div>
</div>

<style lang="scss">
  .eventPopup-container {
    display: flex;
    flex-direction: column;
    max-width: 25rem;
    min-width: 25rem;
    min-height: 0;
    background: var(--theme-popup-color);
    border-radius: 1rem;
    box-shadow: var(--theme-popup-shadow);

    .header {
      flex-shrink: 0;
      padding: 0.75rem 0.75rem 0.5rem;
    }

    .block {
      display: flex;
      flex-shrink: 0;
      min-width: 0;
      min-height: 0;

      &:not(:last-child) {
        border-bottom: 1px solid var(--theme-divider-color);
      }
      &:not(.description) {
        flex-direction: column;
      }
      &.first {
        padding-top: 0;
      }
      &:not(.rightCropPadding) {
        padding: 0.75rem 1rem;
      }
      &.rightCropPadding {
        padding: 0.75rem 1rem 0.75rem 1.25rem;
      }
      &.description {
        padding: 0 1.25rem;
      }
    }
    .top-icon {
      flex-shrink: 0;
      margin-top: 1.375rem;
      margin-right: 0.125rem;
    }
  }
</style>
