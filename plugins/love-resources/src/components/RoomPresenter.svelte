<!--
// Copyright © 2024 Hardcore Engineering Inc.
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
  import love, { Room } from '@hcengineering/love'
  import { WithLookup } from '@hcengineering/core'
  import { ObjectPresenterType } from '@hcengineering/view'
  import { getEmbeddedLabel } from '@hcengineering/platform'
  import { DocNavLink, ObjectMention } from '@hcengineering/view-resources'
  import { tooltip, Icon } from '@hcengineering/ui'

  import { getRoomName } from '../utils'

  export let value: WithLookup<Room>
  export let inline: boolean = false
  export let disabled: boolean = false
  export let accent: boolean = false
  export let noUnderline: boolean = false
  export let shouldShowAvatar = true
  export let type: ObjectPresenterType = 'link'

  let roomName: string
  $: void getRoomName(value).then((name) => {
    roomName = name
  })
</script>

{#if value}
  {#if inline}
    <ObjectMention object={value} {disabled} />
  {:else if type === 'link'}
    <DocNavLink object={value} {disabled} {accent} {noUnderline}>
      <div class="flex-presenter" use:tooltip={{ label: getEmbeddedLabel(roomName) }}>
        {#if shouldShowAvatar}
          <div class="icon">
            <Icon icon={love.icon.Love} size={'small'} />
          </div>
        {/if}
        <div class="label nowrap flex flex-gap-2" class:no-underline={noUnderline || disabled} class:fs-bold={accent}>
          <span>{roomName}</span>
        </div>
      </div>
    </DocNavLink>
  {:else if type === 'text'}
    <span class="overflow-label" use:tooltip={{ label: getEmbeddedLabel(roomName) }}>
      {roomName}
    </span>
  {/if}
{/if}
