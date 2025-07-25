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
  import { getClient } from '@hcengineering/presentation'
  import { type Card } from '@hcengineering/card'
  import { type ActivityMessage } from '@hcengineering/communication-types'
  import view from '@hcengineering/view'
  import { DocNavLink } from '@hcengineering/view-resources'
  import { Icon, Label } from '@hcengineering/ui'

  import communication from './../../../plugin'

  export let message: ActivityMessage
  export let card: Card

  const client = getClient()
  const hierarchy = client.getHierarchy()

  $: clazz = hierarchy.getClass(card._class)
  $: objectPanel = hierarchy.classHierarchyMixin(card._class, view.mixin.ObjectPanel)
  $: action = message.extra.action
</script>

<span class="container flex-gap-1 overflow-label">
  {#if clazz.icon}
    <span class="icon mr-1">
      <Icon icon={clazz.icon} size="small" />
    </span>
  {/if}

  {#if action === 'create'}
    <Label label={communication.string.New} />
  {:else if action === 'remove'}
    <Label label={communication.string.Removed} />
  {/if}
  <span class="lower">
    <Label label={clazz.label} />:
  </span>
  <DocNavLink
    object={card}
    disabled={action === 'remove'}
    accent={true}
    component={objectPanel?.component ?? view.component.EditDoc}
    shrink={1}
  >
    {card.title}
  </DocNavLink>
</span>

<style lang="scss">
  .icon {
    display: flex;
    align-items: center;
    color: var(--global-secondary-TextColor);
    fill: var(--global-secondary-TextColor);
  }

  .container {
    display: flex;
    align-items: center;
  }
</style>
