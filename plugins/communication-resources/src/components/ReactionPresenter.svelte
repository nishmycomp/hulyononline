<!-- Copyright © 2025 Hardcore Engineering Inc. -->
<!-- -->
<!-- Licensed under the Eclipse Public License, Version 2.0 (the "License"); -->
<!-- you may not use this file except in compliance with the License. You may -->
<!-- obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0 -->
<!-- -->
<!-- Unless required by applicable law or agreed to in writing, software -->
<!-- distributed under the License is distributed on an "AS IS" BASIS, -->
<!-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. -->
<!-- -->
<!-- See the License for the specific language governing permissions and -->
<!-- limitations under the License. -->

<script lang="ts">
  import { Icon, IconComponent, IconSize, tooltip } from '@hcengineering/ui'
  import { PersonId } from '@hcengineering/core'
  import { EmojiPresenter } from '@hcengineering/emoji-resources'

  import ReactionsTooltip from './ReactionsTooltip.svelte'

  export let icon: IconComponent | undefined = undefined
  export let iconSize: IconSize | undefined = undefined
  export let emoji: string = ''
  export let count: number | undefined = undefined
  export let selected: boolean = false
  export let active: boolean = false
  export let socialIds: PersonId[] = []
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="reaction"
  class:selected
  class:active
  on:click
  use:tooltip={(count ?? 0) > 0 ? { component: ReactionsTooltip, props: { socialIds } } : undefined}
>
  <div class="reaction__emoji" class:foreground={icon != null}>
    {#if icon}
      <Icon {icon} size={iconSize ?? 'small'} />
    {:else}
      <EmojiPresenter {emoji} />
    {/if}
  </div>
  {#if count !== undefined}
    <div class="reaction__count">{count}</div>
  {/if}
</div>

<style lang="scss">
  .reaction {
    display: flex;
    height: 1.75rem;
    padding: 0.375rem;
    align-items: center;
    gap: 0.25rem;
    border-radius: 0.5rem;
    background: var(--selector-BackgroundColor);
    cursor: pointer;

    &:hover,
    &.active {
      background: var(--global-ui-hover-BackgroundColor);
    }

    &.selected {
      background: var(--global-accent-BackgroundColor);
    }
  }

  .reaction__emoji {
    color: var(--global-primary-TextColor);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1rem;
  }

  .reaction__count {
    color: var(--global-primary-TextColor);
    font-size: 0.75rem;
    font-weight: 500;
  }
</style>
