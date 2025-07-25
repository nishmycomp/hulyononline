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
  import { Contact, Employee, getCurrentEmployee, getName, Person } from '@hcengineering/contact'
  import { AccountUuid, notEmpty, Ref } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { getClient } from '@hcengineering/presentation'
  import { ButtonKind, ButtonSize } from '@hcengineering/ui'
  import { onDestroy } from 'svelte'
  import contact from '../plugin'
  import { employeeByIdStore, employeeRefByAccountUuidStore } from '../utils'
  import UserBoxList from './UserBoxList.svelte'

  export let label: IntlString
  export let value: AccountUuid | AccountUuid[] | undefined
  export let onChange: ((refs: AccountUuid[]) => void | Promise<void>) | undefined
  export let readonly = false
  export let kind: ButtonKind = 'link'
  export let size: ButtonSize = 'large'
  export let width: string | undefined = undefined
  export let includeItems: Ref<Person>[] = []
  export let excludeItems: Ref<Person>[] = []
  export let emptyLabel: IntlString | undefined = undefined
  export let allowGuests: boolean = false
  export let attributeKey: string | undefined = undefined

  $: accounts = typeof value === 'string' ? [value] : value ?? []

  let timer: any = null
  const client = getClient()
  let update: (() => Promise<void>) | undefined

  $: accountsByPersonRef = new Map(
    accounts
      .map((uuid) => {
        const empRef = $employeeRefByAccountUuidStore.get(uuid)

        if (empRef === undefined) {
          console.error('Employee not found by account id', uuid)
          return null
        }

        const employee = $employeeByIdStore.get(empRef)

        if (employee?.active !== true) {
          return null
        }

        return [empRef, uuid] as const
      })
      .filter(notEmpty)
  )

  function onUpdate (evt: CustomEvent<Ref<Employee>[]>): void {
    if (timer !== null) {
      clearTimeout(timer)
    }
    update = async () => {
      const newPersons = evt.detail
      const newAccounts: AccountUuid[] = []

      for (const person of newPersons) {
        const acc = accountsByPersonRef.get(person)
        if (acc !== undefined) {
          newAccounts.push(acc)
        } else {
          const employee = $employeeByIdStore.get(person)
          if (employee?.personUuid == null) continue

          newAccounts.push(employee.personUuid)
        }
      }

      void onChange?.(newAccounts)
      if (timer !== null) {
        clearTimeout(timer)
      }
      timer = null
      update = undefined
    }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    timer = setTimeout(() => update?.(), 500)
  }

  onDestroy(() => {
    void update?.()
  })

  $: employees = accounts.map((p) => $employeeRefByAccountUuidStore.get(p)).filter(notEmpty)
  $: docQuery =
    excludeItems.length === 0 && includeItems.length === 0
      ? {}
      : {
          _id: {
            ...(includeItems.length > 0
              ? {
                  $in: includeItems
                }
              : {}),
            ...(excludeItems.length > 0
              ? {
                  $nin: excludeItems
                }
              : {})
          }
        }

  const hierarchy = client.getHierarchy()
  const me = getCurrentEmployee()

  function sort (a: Contact, b: Contact): number {
    if (me === a._id) {
      return -1
    }
    if (me === b._id) {
      return 1
    }
    const aIncludes = employees.includes(a._id as Ref<Employee>)
    const bIncludes = employees.includes(b._id as Ref<Employee>)
    if (aIncludes && !bIncludes) {
      return -1
    }
    if (!aIncludes && bIncludes) {
      return 1
    }
    const aName = getName(hierarchy, a)
    const bName = getName(hierarchy, b)
    return aName.localeCompare(bName)
  }
</script>

<UserBoxList
  _class={contact.mixin.Employee}
  items={employees}
  {label}
  {emptyLabel}
  {readonly}
  {docQuery}
  on:update={onUpdate}
  {size}
  {sort}
  justify={'left'}
  width={width ?? 'min-content'}
  {kind}
  create={allowGuests ? { component: contact.component.CreateGuest, label: contact.string.AddGuest } : undefined}
/>
