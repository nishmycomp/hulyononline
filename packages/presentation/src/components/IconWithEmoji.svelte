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
  import { Ref, Blob } from '@hcengineering/core'
  import { IconSize, fromCodePoint } from '@hcengineering/ui'
  import { getBlobRef } from '../preview'

  export let icon: number | number[] | Ref<Blob>
  export let size: IconSize

  let value: string | undefined = parseIcon(icon)

  function parseIcon (icon: number | number[] | Ref<Blob>): string | undefined {
    if (typeof icon === 'object' && '__ref' in icon) {
      return undefined
    }
    try {
      return Array.isArray(icon) ? fromCodePoint(...icon) : fromCodePoint(icon as number)
    } catch (err) {}
    return undefined
  }

  function asRef (value: number | number[] | Ref<Blob>): Ref<Blob> {
    return value as Ref<Blob>
  }

  $: value = parseIcon(icon)
</script>

<div class="emoji-{size} flex-row-center emoji">
  {#if value !== undefined}
    {value}
  {:else}
    {#await getBlobRef(asRef(icon)) then iconBlob}
      <img src={iconBlob.src} srcset={iconBlob.srcset} alt="icon" />
    {/await}
  {/if}
</div>

<style lang="scss">
  .emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    color: black;

    img {
      margin: 0;
    }
  }
  .emoji-inline {
    width: 1em;
    height: 1em;
    font-size: 1rem;
  }
  .emoji-x-small {
    width: 0.75rem;
    height: 0.75rem;
    font-size: 0.75rem;
  }
  .emoji-small {
    width: 1rem;
    height: 1rem;
    font-size: 1rem;
  }
  .emoji-medium {
    width: 1.25rem;
    height: 1.25rem;
    font-size: 1.25rem;
  }
  .emoji-large {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 1.5rem;
  }
  .emoji-full {
    width: inherit;
    height: inherit;
  }
  .emoji-x-small,
  .emoji-small,
  .emoji-medium,
  .emoji-large {
    flex-shrink: 0;
  }
</style>
