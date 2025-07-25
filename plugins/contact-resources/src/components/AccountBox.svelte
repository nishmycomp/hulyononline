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
  import { Employee } from '@hcengineering/contact'
  import { notEmpty, PersonId, Ref } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { ButtonKind, ButtonSize, IconSize } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import contact from '../plugin'
  import { employeeByPersonIdStore, primarySocialIdByEmployeeRefStore } from '../utils'
  import UserBox from './UserBox.svelte'

  export let label: IntlString = contact.string.Employee
  export let value: PersonId | null | undefined
  export let include: PersonId[] = []
  export let kind: ButtonKind = 'no-border'
  export let size: ButtonSize = 'small'
  export let avatarSize: IconSize = 'card'
  export let justify: 'left' | 'center' = 'center'
  export let width: string | undefined = undefined
  export let readonly = false
  export let mapToPrimarySocialId = true

  $: docQuery =
    include.length === 0
      ? {}
      : {
          _id: {
            $in: include.map((personId) => $employeeByPersonIdStore.get(personId)?._id).filter(notEmpty)
          }
        }
  $: selectedEmp = value != null ? $employeeByPersonIdStore.get(value)?._id : value
  let employeeToPersonIdMap = new Map<Ref<Employee>, PersonId>()
  $: employeeToPersonIdMap = mapToPrimarySocialId
    ? employeeToPersonIdMap
    : new Map(
      include
        .map((personId) => {
          const employee = $employeeByPersonIdStore.get(personId)
          return employee !== undefined ? ([employee._id, personId] as const) : null
        })
        .filter(notEmpty)
    )

  const dispatch = createEventDispatcher()

  function change (e: CustomEvent<Ref<Employee> | null>): void {
    if (e.detail === null) {
      dispatch('change', null)
    } else {
      let socialString: PersonId | undefined

      if (mapToPrimarySocialId) {
        socialString = $primarySocialIdByEmployeeRefStore.get(e.detail)
      } else {
        socialString = employeeToPersonIdMap.get(e.detail)
        if (socialString === undefined) {
          socialString = $primarySocialIdByEmployeeRefStore.get(e.detail)
          console.warn('PersonId not found in provided social id list, falling back to primary social ID:', e.detail)
        }
      }
      if (socialString === undefined) {
        console.error('Social id not found for person', e.detail)
        return
      }

      dispatch('change', socialString)
    }
  }
</script>

<UserBox
  _class={contact.mixin.Employee}
  {docQuery}
  showNavigate={false}
  {kind}
  {size}
  {avatarSize}
  {justify}
  {width}
  {label}
  {readonly}
  value={selectedEmp}
  on:change={change}
/>
