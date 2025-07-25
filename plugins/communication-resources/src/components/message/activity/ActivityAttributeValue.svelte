<!--
// Copyright © 2025 Hardcore Engineering Inc.
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
  import { Icon, IconComponent } from '@hcengineering/ui'
  import { ObjectPresenter } from '@hcengineering/view-resources'
  import { getClient } from '@hcengineering/presentation'
  import { AttributeModel } from '@hcengineering/view'
  import { ActivityAttributeUpdate } from '@hcengineering/communication-types'

  import { getAttributeValues } from '../../../activity'

  type Values = ActivityAttributeUpdate['set' | 'added' | 'removed']

  export let model: AttributeModel
  export let values: Values
  export let icon: IconComponent

  const client = getClient()

  let attributeValues: any[] = []

  $: void getAttributeValues(client, values, model._class).then((result) => {
    attributeValues = result
  })
</script>

<span class="flex-center flex-gap-1 no-word-wrap">
  <span class="icon mr-1">
    <Icon {icon} size="small" />
  </span>

  <slot name="text" />

  {#each attributeValues as value}
    <span class="bold overflow-label clear-mins">
      {#if value != null && typeof value === 'object'}
        <ObjectPresenter {value} shouldShowAvatar={false} accent props={{ withShowMore: false }} />
      {:else}
        <svelte:component
          this={model.presenter}
          {value}
          shouldShowAvatar={false}
          accent
          kind="list-header"
          oneLine
          withShowMore={false}
        />
      {/if}
    </span>
  {/each}
</span>

<style lang="scss">
  .icon {
    display: flex;
    align-items: center;
    color: var(--global-secondary-TextColor);
    fill: var(--global-secondary-TextColor);
  }

  .bold {
    font-weight: 500;
  }
</style>
