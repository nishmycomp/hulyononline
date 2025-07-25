<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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
  import type { IntlString } from '@hcengineering/platform'
  import { createEventDispatcher } from 'svelte'
  import {
    Button,
    Label,
    IconClose,
    IconMaximize,
    IconMinimize,
    resizeObserver,
    tooltip,
    deviceOptionsStore as deviceInfo,
    checkAdaptiveMatching
  } from '..'
  import ui from '../plugin'

  export let label: IntlString | undefined = undefined
  export let isFullSize: boolean = false
  export let padding: string = '1rem'

  const dispatch = createEventDispatcher()

  export function maximize (): void {
    toggleFullSize = true
  }

  let fullSize: boolean = false
  let toggleFullSize: boolean = fullSize
  $: needFullSize = checkAdaptiveMatching($deviceInfo.size, 'md')
  $: if ((needFullSize && !fullSize) || (!needFullSize && (fullSize || toggleFullSize))) {
    fullSize = toggleFullSize ? true : needFullSize
    dispatch('fullsize', fullSize)
  }
</script>

<form
  class="antiDialog"
  class:fullsize={fullSize}
  on:submit|preventDefault={() => {}}
  use:resizeObserver={() => {
    dispatch('changeContent')
  }}
>
  <div class="flex-between header">
    <div class="flex-row-center gap-1-5">
      <Button icon={IconClose} kind={'ghost'} size={'medium'} on:click={() => dispatch('close')} />
      {#if label}
        <span class="title" use:tooltip={{ label }}><Label {label} /></span>
      {/if}
      {#if $$slots.title}<slot name="title" />{/if}
    </div>
    <div class="flex-row-center flex-no-shrink gap-1-5">
      {#if $$slots.utils}
        <slot name="utils" />
      {/if}
      {#if $$slots.utils && isFullSize && !needFullSize}
        <div class="buttons-divider" />
      {/if}
      {#if isFullSize && !needFullSize}
        <Button
          focusIndex={100010}
          icon={fullSize ? IconMinimize : IconMaximize}
          kind={'ghost'}
          size={'medium'}
          selected={fullSize}
          id={'btnDialogFullScreen'}
          showTooltip={{ label: fullSize ? ui.string.NormalSize : ui.string.FullSize }}
          noFocus
          on:click={() => (toggleFullSize = !toggleFullSize)}
        />
      {/if}
    </div>
  </div>
  <div class="content" class:rounded={!($$slots.footerLeft || $$slots.footerRight)} style:padding>
    <slot />
  </div>
  {#if $$slots.footerLeft || $$slots.footerRight}
    <div class="footer">
      {#if $$slots.footerLeft}
        <div class="flex-row-center gap-2">
          <slot name="footerLeft" />
        </div>
      {:else}<div />{/if}
      {#if $$slots.footerRight}
        <div class="flex-row-center gap-2">
          <slot name="footerRight" />
        </div>
      {:else}<div />{/if}
    </div>
  {/if}
</form>
