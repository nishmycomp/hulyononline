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
  import { AccessLevel, Calendar, Event, generateEventId, getAllEvents } from '@hcengineering/calendar'
  import { getCurrentEmployee } from '@hcengineering/contact'
  import {
    Class,
    Doc,
    DocumentQuery,
    FindOptions,
    Ref,
    SortingOrder,
    Timestamp,
    getCurrentAccount
  } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { createQuery } from '@hcengineering/presentation'
  import {
    AnyComponent,
    MonthCalendar,
    YearCalendar,
    areDatesEqual,
    getWeekStart,
    showPopup,
    AnySvelteComponent,
    deviceOptionsStore as deviceInfo
  } from '@hcengineering/ui'

  import { CalendarMode, DayCalendar, calendarByIdStore, hidePrivateEvents } from '../index'
  import calendar from '../plugin'
  import Day from './Day.svelte'
  import CalendarHeader from './CalendarHeader.svelte'

  export let _class: Ref<Class<Doc>> = calendar.class.Event
  export let query: DocumentQuery<Event> | undefined = undefined
  export let options: FindOptions<Event> | undefined = undefined
  export let createComponent: AnyComponent | undefined = calendar.component.CreateEvent
  export let dragItem: Doc | undefined = undefined
  export let dragEventClass: Ref<Class<Event>> = calendar.class.Event
  export let allowedModes: CalendarMode[] = [
    CalendarMode.Days,
    CalendarMode.Week,
    CalendarMode.Month,
    CalendarMode.Year
  ]
  export let headerComponent: AnySvelteComponent | undefined = undefined

  const me = getCurrentEmployee()
  const acc = getCurrentAccount()
  const myPrimaryId = acc.primarySocialId
  const mySocialStrings = acc.socialIds

  let mode: CalendarMode = allowedModes.includes(CalendarMode.Days) ? CalendarMode.Days : allowedModes[0]

  // Current selected day
  let currentDate: Date = new Date()
  let selectedDate: Date = new Date()

  let dayCalendar: DayCalendar
  let raw: Event[] = []
  let visible: Event[] = []
  let objects: Event[] = []

  function getFrom (date: Date, mode: CalendarMode): Timestamp {
    switch (mode) {
      case CalendarMode.Days: {
        return new Date(date).setHours(0, 0, 0, 0)
      }
      case CalendarMode.Day: {
        return new Date(date).setHours(0, 0, 0, 0)
      }
      case CalendarMode.Week: {
        return getWeekStart(date, $deviceInfo.firstDayOfWeek).getTime()
      }
      case CalendarMode.Month: {
        return new Date(new Date(date).setDate(-7)).setHours(0, 0, 0, 0)
      }
      case CalendarMode.Year: {
        return new Date(new Date(date).setMonth(0, -7)).setHours(0, 0, 0, 0)
      }
    }
  }

  function getTo (date: Date, mode: CalendarMode): Timestamp {
    switch (mode) {
      case CalendarMode.Days: {
        return new Date(date).setDate(date.getDate() + 4)
      }
      case CalendarMode.Day: {
        return new Date(date).setDate(date.getDate() + 1)
      }
      case CalendarMode.Week: {
        const startDay = getWeekStart(date, $deviceInfo.firstDayOfWeek)
        return new Date(startDay.setDate(startDay.getDate() + 7)).getTime()
      }
      case CalendarMode.Month: {
        return new Date(new Date(date).setMonth(date.getMonth() + 1, 14)).setHours(0, 0, 0, 0)
      }
      case CalendarMode.Year: {
        return new Date(new Date(date).setMonth(12, 14)).setHours(0, 0, 0, 0)
      }
    }
  }

  $: from = getFrom(currentDate, mode)
  $: to = getTo(currentDate, mode)

  const calendarsQuery = createQuery()

  let calendars: Calendar[] = []

  calendarsQuery.query(calendar.class.Calendar, { createdBy: { $in: mySocialStrings }, hidden: false }, (res) => {
    calendars = res
  })

  const q = createQuery()

  function update (
    _class: Ref<Class<Event>>,
    query: DocumentQuery<Event> | undefined,
    calendars: Calendar[],
    options?: FindOptions<Event>
  ): void {
    q.query<Event>(
      _class,
      query ?? { calendar: { $in: calendars.map((p) => p._id) } },
      (result) => {
        raw = result
      },
      { sort: { date: SortingOrder.Ascending }, ...options }
    )
  }
  $: update(_class, query, calendars, options)
  $: visible = hidePrivateEvents(raw, $calendarByIdStore)
  $: objects = getAllEvents(visible, from, to)

  function inRange (start: Date, end: Date, startPeriod: Date, period: 'day' | 'hour'): boolean {
    const endPeriod =
      period === 'day'
        ? new Date(startPeriod).setDate(startPeriod.getDate() + 1)
        : new Date(startPeriod).setHours(startPeriod.getHours() + 1)
    if (end.getTime() - 1 <= startPeriod.getTime()) return false
    if (start.getTime() >= endPeriod) return false

    return true
  }

  function findEvents (events: Event[], date: Date, minutes = false): Event[] {
    return events.filter((it) => {
      let d1 = new Date(it.date)
      let d2 = new Date(it.dueDate ?? it.date)
      if (it.allDay) {
        if (minutes) return false
        d1 = new Date(d1.getTime() + new Date().getTimezoneOffset() * 60 * 1000)
        d2 = new Date(d2.getTime() + new Date().getTimezoneOffset() * 60 * 1000)
        return inRange(d1, d2, date, minutes ? 'hour' : 'day')
      }
      return inRange(d1, d2, date, minutes ? 'hour' : 'day')
    })
  }

  function inc (val: number): void {
    if (val === 0) {
      currentDate = new Date()
      dayCalendar.scrollToTime(currentDate)
      return
    }
    switch (mode) {
      case CalendarMode.Days: {
        currentDate.setDate(currentDate.getDate() + val * 3)
        break
      }
      case CalendarMode.Day: {
        currentDate.setDate(currentDate.getDate() + val)
        break
      }
      case CalendarMode.Week: {
        currentDate.setDate(currentDate.getDate() + val * 7)
        break
      }
      case CalendarMode.Month: {
        currentDate.setDate(1)
        currentDate.setMonth(currentDate.getMonth() + val)
        break
      }
      case CalendarMode.Year: {
        currentDate.setFullYear(currentDate.getFullYear() + val)
        break
      }
    }
    currentDate = currentDate
  }
  function getMonthName (date: Date): string {
    return new Intl.DateTimeFormat('default', {
      month: 'long'
    }).format(date)
  }

  function showCreateDialog (date: Date, withTime: boolean) {
    if (createComponent === undefined) {
      return
    }
    showPopup(createComponent, { date, withTime }, 'top')
  }

  function getDdItem (mode: CalendarMode) {
    switch (mode) {
      case CalendarMode.Day:
        return { id: 'day', label: calendar.string.ModeDay, mode: CalendarMode.Day }
      case CalendarMode.Days:
        return { id: 'days', label: calendar.string.DueDays, mode: CalendarMode.Days, params: { days: 3 } }
      case CalendarMode.Week:
        return { id: 'week', label: calendar.string.ModeWeek, mode: CalendarMode.Week }
      case CalendarMode.Month:
        return { id: 'month', label: calendar.string.ModeMonth, mode: CalendarMode.Month }
      case CalendarMode.Year:
        return { id: 'year', label: calendar.string.ModeYear, mode: CalendarMode.Year }
    }
  }

  function getDdItems (allowedModes: CalendarMode[]): void {
    ddItems = []
    for (const mode of allowedModes) {
      ddItems.push(getDdItem(mode))
    }
    ddItems = ddItems
  }

  const dragItemId = 'drag_item' as Ref<Event>

  function dragEnter (e: CustomEvent<any>): void {
    if (dragItem !== undefined) {
      const current = raw.find((p) => p._id === dragItemId)
      if (current !== undefined) {
        current.attachedTo = dragItem._id
        current.attachedToClass = dragItem._class
        current.date = e.detail.date.getTime()
        current.dueDate = new Date(e.detail.date).setMinutes(new Date(e.detail.date).getMinutes() + 30)
      } else {
        const temp: Event = {
          _id: dragItemId,
          allDay: false,
          eventId: generateEventId(),
          title: '',
          description: '',
          access: AccessLevel.Owner,
          attachedTo: dragItem._id,
          attachedToClass: dragItem._class,
          _class: dragEventClass,
          collection: 'events',
          calendar: `${acc.uuid}_calendar` as Ref<Calendar>,
          modifiedBy: myPrimaryId,
          blockTime: true,
          participants: [me],
          modifiedOn: Date.now(),
          date: e.detail.date.getTime(),
          space: calendar.space.Calendar,
          user: myPrimaryId,
          dueDate: new Date(e.detail.date).setMinutes(new Date(e.detail.date).getMinutes() + 30)
        }
        raw.push(temp)
      }
      raw = raw
    }
  }

  $: clear(dragItem)

  function clear (dragItem: Doc | undefined) {
    if (dragItem === undefined) {
      raw = raw.filter((p) => p._id !== dragItemId)
      visible = hidePrivateEvents(raw, $calendarByIdStore)
      objects = getAllEvents(visible, from, to)
    }
  }

  $: getDdItems(allowedModes)

  let ddItems: {
    id: string | number
    label: IntlString
    mode: CalendarMode
    params?: Record<string, any>
  }[] = [
    { id: 'day', label: calendar.string.ModeDay, mode: CalendarMode.Day },
    { id: 'days', label: calendar.string.DueDays, mode: CalendarMode.Days, params: { days: 3 } },
    { id: 'week', label: calendar.string.ModeWeek, mode: CalendarMode.Week },
    { id: 'month', label: calendar.string.ModeMonth, mode: CalendarMode.Month },
    { id: 'year', label: calendar.string.ModeYear, mode: CalendarMode.Year }
  ]

  function handleToday (): void {
    inc(0)
  }

  function handleBack (): void {
    inc(-1)
  }

  function handleForward (): void {
    inc(1)
  }
</script>

{#if headerComponent}
  <svelte:component
    this={headerComponent}
    bind:mode
    {currentDate}
    {ddItems}
    monthName={getMonthName(currentDate)}
    onToday={handleToday}
    onBack={handleBack}
    onForward={handleForward}
    on:close
  />
{:else}
  <CalendarHeader
    bind:mode
    {currentDate}
    {ddItems}
    monthName={getMonthName(currentDate)}
    onToday={handleToday}
    onBack={handleBack}
    onForward={handleForward}
  />
{/if}
{#if mode === CalendarMode.Year}
  <YearCalendar
    cellHeight={'2.5rem'}
    bind:selectedDate
    bind:currentDate
    on:change={(e) => {
      currentDate = e.detail
      if (areDatesEqual(selectedDate, currentDate)) {
        mode = CalendarMode.Month
      }
      selectedDate = e.detail
    }}
  >
    <svelte:fragment slot="cell" let:date let:today let:selected let:wrongMonth>
      <Day events={findEvents(objects, date)} {date} {today} {selected} {wrongMonth} />
    </svelte:fragment>
  </YearCalendar>
{:else if mode === CalendarMode.Month}
  <MonthCalendar cellHeight={'8.5rem'} bind:selectedDate bind:currentDate>
    <svelte:fragment slot="cell" let:date let:today let:selected let:wrongMonth>
      <Day
        events={findEvents(objects, date)}
        {date}
        size={'huge'}
        {today}
        {selected}
        {wrongMonth}
        on:select={(e) => {
          currentDate = e.detail
          if (areDatesEqual(selectedDate, currentDate)) {
            mode = CalendarMode.Day
          }
          selectedDate = e.detail
        }}
        on:create={(e) => {
          showCreateDialog(e.detail, false)
        }}
      />
    </svelte:fragment>
  </MonthCalendar>
{:else if mode === CalendarMode.Week}
  <DayCalendar
    bind:this={dayCalendar}
    events={objects}
    displayedDaysCount={7}
    {dragItemId}
    startFromWeekStart
    bind:selectedDate
    bind:currentDate
    on:create={(e) => {
      showCreateDialog(e.detail.date, e.detail.withTime)
    }}
    on:drop
    on:dragenter={dragEnter}
  />
{:else if mode === CalendarMode.Day || mode === CalendarMode.Days}
  {#key mode}
    <DayCalendar
      bind:this={dayCalendar}
      events={objects}
      {dragItemId}
      displayedDaysCount={mode === CalendarMode.Days ? 3 : 1}
      startFromWeekStart={false}
      bind:selectedDate
      bind:currentDate
      on:create={(e) => {
        showCreateDialog(e.detail.date, e.detail.withTime)
      }}
      on:drop
      on:dragenter={dragEnter}
    />
  {/key}
{/if}
