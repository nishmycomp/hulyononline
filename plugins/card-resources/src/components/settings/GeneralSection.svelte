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
  import { MasterTag } from '@hcengineering/card'
  import { getEmbeddedLabel, translateCB } from '@hcengineering/platform'
  import { IconWithEmoji, getClient } from '@hcengineering/presentation'
  import {
    ButtonIcon,
    type ColorDefinition,
    eventToHTMLElement,
    getCurrentLocation,
    getPlatformColorDef,
    IconDelete,
    ModernEditbox,
    navigate,
    showPopup,
    themeStore
  } from '@hcengineering/ui'
  import { ColorsPopup, IconPicker } from '@hcengineering/view-resources'
  import setting from '@hcengineering/setting'
  import card from '../../plugin'
  import { deleteMasterTag } from '../../utils'
  import view from '@hcengineering/view'

  export let masterTag: MasterTag

  let name: string = ''

  $: translateCB(masterTag.label, {}, $themeStore.language, (p) => {
    name = p
  })

  const client = getClient()

  async function attributeUpdated<T extends keyof MasterTag> (field: T, value: MasterTag[T]): Promise<void> {
    if (masterTag === undefined || masterTag[field] === value) {
      return
    }

    await client.update(masterTag, { [field]: value })
  }

  async function handleDelete (): Promise<void> {
    await deleteMasterTag(masterTag, () => {
      const loc = getCurrentLocation()
      if (masterTag.extends !== card.class.Card && masterTag.extends !== undefined) {
        loc.path[4] = masterTag.extends
      } else {
        loc.path.length = 3
      }
      navigate(loc)
    })
  }

  function setIcon (): void {
    showPopup(
      IconPicker,
      { icon: masterTag.icon, color: masterTag.color, showEmoji: true, showColor: false },
      'top',
      async (res) => {
        if (res !== undefined) {
          await client.update(masterTag, { icon: res.icon, color: res.color })
          masterTag.icon = res.icon
          masterTag.color = res.color
        }
      }
    )
  }

  const h = client.getHierarchy()
  $: isEditable = h.hasMixin(masterTag, setting.mixin.Editable) && h.as(masterTag, setting.mixin.Editable).value

  const showColorPopup = (evt: MouseEvent): void => {
    showPopup(
      ColorsPopup,
      { selected: getPlatformColorDef(masterTag.background ?? 0, $themeStore.dark).name },
      eventToHTMLElement(evt),
      async (col) => {
        if (col != null) {
          masterTag.background = col
          await client.update(masterTag, { background: col })
        }
      }
    )
  }

  function getTagStyle (color: ColorDefinition): string {
    return `
    background: ${color.color + '33'};
    border: 1px solid ${color.color + '66'};
    color: ${color.title ?? 'var(--theme-caption-color)'};
  `
  }
</script>

<div class="hulyComponent-content__column-group">
  <div class="hulyComponent-content__header items-center">
    <div class="flex items-center flex-grow">
      <ButtonIcon
        icon={masterTag.icon === view.ids.IconWithEmoji ? IconWithEmoji : masterTag.icon ?? card.icon.MasterTag}
        iconProps={masterTag.icon === view.ids.IconWithEmoji ? { icon: masterTag.color, size: 'large' } : {}}
        size={'large'}
        iconSize={'large'}
        kind={'tertiary'}
        on:click={setIcon}
      />
      <ModernEditbox
        kind="ghost"
        size="large"
        label={masterTag.label}
        value={name}
        on:blur={(evt) => {
          if (evt.detail === undefined || evt.detail.trim().length === 0) {
            return
          }
          if (name !== evt.detail) {
            const emb = getEmbeddedLabel(evt.detail)
            void attributeUpdated('label', emb)
          }
        }}
      />
      <div
        class="background-selector"
        style={getTagStyle(getPlatformColorDef(masterTag.background ?? 0, $themeStore.dark))}
        on:click={showColorPopup}
      />
    </div>
    {#if isEditable}
      <ButtonIcon icon={IconDelete} size={'large'} kind={'tertiary'} on:click={handleDelete} />
    {/if}
  </div>
</div>

<style lang="scss">
  .background-selector {
    margin-left: auto;
    margin-right: 0.5rem;
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
  }
</style>
