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
  import { AccountBox } from '@hcengineering/contact-resources'
  import { notEmpty, type PersonId } from '@hcengineering/core'
  import { Integration } from '@hcengineering/setting'
  import { ButtonKind, ButtonSize } from '@hcengineering/ui'

  export let integrations: Integration[]
  export let selected: Integration | undefined
  export let kind: ButtonKind = 'link'
  export let size: ButtonSize = 'small'

  $: ids = Array.from(new Set(integrations.map((p) => p.createdBy))).filter(notEmpty)

  function change (e: CustomEvent<PersonId | null>): void {
    if (e.detail === null) {
      selected = undefined
    } else {
      selected = integrations.find((p) => p.createdBy === e.detail)
      if (selected === undefined) {
        console.warn('Integration not found for selected person', e.detail)
      }
    }
  }
</script>

<AccountBox value={selected?.createdBy} {kind} {size} include={ids} on:change={change} mapToPrimarySocialId={false} />
