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
  import { Asset } from '@hcengineering/platform'
  import { ComponentType } from 'svelte'

  import { AnySvelteComponent, Icon, IconProps } from '../..'

  export let icon: Asset | AnySvelteComponent | ComponentType
  export let iconProps: Record<string, any> = {}
  export let pressed: boolean = false

  export let id: string | undefined = undefined
  export let element: HTMLElement | undefined = undefined
</script>

<button
  {id}
  bind:this={element}
  class="antiButton ghost jf-center bs-none no-focus resetIconSize statusButton square"
  class:pressed
  style:color={'var(--theme-dark-color)'}
  on:click
>
  <Icon {icon} {iconProps} size={'small'} />
</button>
