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
  import { Card, MasterTag } from '@hcengineering/card'
  import { getClient } from '@hcengineering/presentation'
  import setting, { settingId } from '@hcengineering/setting'
  import {
    Button,
    Chevron,
    ExpandCollapse,
    getCurrentResolvedLocation,
    IconAdd,
    Label,
    navigate,
    showPopup
  } from '@hcengineering/ui'
  import CardAttributes from './CardAttributes.svelte'
  import { AccountRole, getCurrentAccount, hasAccountRole } from '@hcengineering/core'
  import CardIcon from './CardIcon.svelte'

  export let value: Card
  export let readonly: boolean = false
  export let ignoreKeys: string[]
  export let fourRows: boolean = true

  const client = getClient()
  const hierarchy = client.getHierarchy()
  $: clazz = hierarchy.getClass(value._class) as MasterTag
  $: label = clazz.label

  let isCollapsed = false

  export function collapse (): void {
    isCollapsed = true
  }

  export function expand (): void {
    isCollapsed = false
  }
</script>

<div class="header flex flex-gap-2">
  <div class="label flex flex-gap-2" on:click={isCollapsed ? expand : collapse}>
    <CardIcon {value} size="large" buttonSize={'x-large'} editable={!readonly} />
    <Label {label} />
    <Chevron expanded={!isCollapsed} outline fill={'var(--content-color)'} />
  </div>
  {#if hasAccountRole(getCurrentAccount(), AccountRole.Maintainer)}
    <div class="btns">
      <Button
        icon={IconAdd}
        kind={'link'}
        size={'medium'}
        showTooltip={{ label: setting.string.AddAttribute }}
        on:click={(ev) => {
          showPopup(setting.component.CreateAttributePopup, { _class: value._class, isCard: true }, 'top')
        }}
      />
      <Button
        icon={setting.icon.Setting}
        kind={'link'}
        size={'medium'}
        showTooltip={{ label: setting.string.Setting }}
        on:click={(ev) => {
          ev.stopPropagation()
          const loc = getCurrentResolvedLocation()
          loc.path[2] = settingId
          loc.path[3] = 'types'
          loc.path[4] = value._class
          loc.path.length = 5
          loc.fragment = undefined
          navigate(loc)
        }}
      />
    </div>
  {/if}
</div>
<ExpandCollapse isExpanded={!isCollapsed}>
  <CardAttributes object={value} _class={value._class} {readonly} {ignoreKeys} {fourRows} />
</ExpandCollapse>

<style lang="scss">
  .label {
    font-size: 1.25rem;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
    color: var(--theme-caption-color);
  }

  .header {
    width: fit-content;
    align-items: center;
    margin-top: 1.5rem;
    margin-bottom: 1.5rem;

    &:hover {
      .btns {
        visibility: visible;
      }
    }

    .btns {
      display: flex;
      align-items: center;
      visibility: hidden;
    }
  }
</style>
