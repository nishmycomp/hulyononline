<script lang="ts">
  //
  // © 2025 Hardcore Engineering, Inc. All Rights Reserved.
  // Licensed under the Eclipse Public License v2.0 (SPDX: EPL-2.0).
  //
  import { createEventDispatcher } from 'svelte'
  import emojiPlugin, { ExtendedEmoji, Emoji } from '@hcengineering/emoji'
  import { getEmojiByHexcode, getEmojiSkins } from '../utils'
  import EmojiButton from './EmojiButton.svelte'
  import { getSkinTone, unicodeEmojiStore } from '../store'
  import { Label, IconDelete, closeTooltip, ButtonBase } from '@hcengineering/ui'
  import SkinToneTooltip from './SkinToneTooltip.svelte'

  export let emoji: ExtendedEmoji
  export let remove: boolean = false
  export let skinTone: number = getSkinTone()

  const dispatch = createEventDispatcher()
  closeTooltip()

  const skins = getEmojiSkins(emoji)
  const haveSkins = Array.isArray(skins)
  const combinedEmoji = haveSkins && (skins?.length ?? 0) > 5

  const clickRemove = (): void => {
    dispatch('close', 'remove')
  }
  const getEmojiParts = (): ExtendedEmoji[] => {
    const def = $unicodeEmojiStore[168]
    const temp = skins?.find((skin) => Array.isArray(skin.tone) && skin.tone.length > 1)?.hexcode.split('-200D-')
    if (temp === undefined || temp.length < 2) return [def, def]
    const firstEmoji = getEmojiByHexcode(temp[0].slice(0, -6)) ?? def
    const secondEmoji = getEmojiByHexcode(temp[temp.length - 1].slice(0, -6)) ?? def
    return [firstEmoji, secondEmoji]
  }
  const emojiParts = getEmojiParts()
  const combinedTones: number[] = [skinTone, skinTone]

  const updateSkinTone = (result: CustomEvent<{ detail: number }>, index: number): void => {
    const res = result.detail
    if (typeof res === 'number') {
      combinedTones[index] = res
      const nextIndex = index === 1 ? 0 : 1
      if (res === 0 && combinedTones[nextIndex] !== 0) combinedTones[nextIndex] = 0
      else if (res !== 0 && combinedTones[nextIndex] === 0) combinedTones[nextIndex] = res
    }
  }

  const getEmojiByTone = (e: ExtendedEmoji, [a, b]: number[]): Emoji.Emoji | undefined => {
    const equal = a === b
    const noTone = a === 0
    return equal && noTone
      ? (e as Emoji.Emoji)
      : getEmojiSkins(e)?.find((skin) =>
        equal ? skin.tone === a : Array.isArray(skin.tone) && skin.tone[0] === a && skin.tone[1] === b
      )
  }
  const getEmojiStringByTone = (e: ExtendedEmoji, [a, b]: number[]): string | undefined => {
    return getEmojiByTone(e, [a, b])?.emoji
  }
</script>

<div class="hulyPopup-container noPadding autoWidth">
  {#if haveSkins}
    {#if combinedEmoji && emojiParts?.length === 2}
      <div class="hulyPopup-row disabled skins-row">
        {#each new Array(2) as _, index}
          <EmojiButton
            emoji={emojiParts[index]}
            skinTone={combinedTones[index]}
            preview
            showTooltip={{
              component: SkinToneTooltip,
              props: { emoji: emojiParts[index], selected: combinedTones[index] },
              onUpdate: (result) => {
                updateSkinTone(result, index)
              }
            }}
          />
          {#if index === 0}
            <ButtonBase
              type={'type-button-icon'}
              kind={'tertiary'}
              size={'large'}
              on:click={() => {
                dispatch('close', getEmojiByTone(emoji, combinedTones))
              }}
            >
              <span style:font-size={'2.5rem'}>{getEmojiStringByTone(emoji, combinedTones)}</span>
            </ButtonBase>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="hulyPopup-row disabled skins-row">
        {#each new Array((skins?.length ?? 5) + 1) as _, skin}
          <EmojiButton {emoji} skinTone={skin} preview on:select={(result) => dispatch('close', result.detail)} />
        {/each}
      </div>
    {/if}
  {/if}
  {#if remove}
    {#if haveSkins}<div class="hulyPopup-divider" />{/if}
    <div class="hulyPopup-group">
      <button class="hulyPopup-row" on:click={clickRemove}>
        <div class="hulyPopup-row__icon red-color"><IconDelete size={'small'} /></div>
        <span class="hulyPopup-row__label red-color"><Label label={emojiPlugin.string.Remove} /></span>
      </button>
    </div>
  {/if}
</div>

<style lang="scss">
  .skins-row {
    align-items: center;
  }
</style>
