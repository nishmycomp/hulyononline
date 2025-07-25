<script lang="ts">
  import core, { getCurrentAccount } from '@hcengineering/core'
  import { DevicesPreference } from '@hcengineering/love'
  import {
    getSelectedMicId,
    getSelectedSpeakerId,
    updateSelectedMicId,
    updateSelectedSpeakerId
  } from '@hcengineering/media'
  import { translate } from '@hcengineering/platform'
  import { getClient } from '@hcengineering/presentation'
  import { DropdownLabels, DropdownTextItem, Label, Toggle } from '@hcengineering/ui'
  import { isKrispNoiseFilterSupported } from '@livekit/krisp-noise-filter'
  import { Room } from 'livekit-client'
  import love from '../plugin'
  import { myPreferences } from '../stores'
  import { getActive, krispProcessor, lk } from '../utils'

  void Room.getLocalDevices().then(async (devices) => {
    devices.forEach((device) => {
      if (device.deviceId !== 'default') {
        if (device.kind === 'audiooutput') {
          speakers.push({ label: device.label, id: device.deviceId })
        } else if (device.kind === 'audioinput') {
          mics.push({ label: device.label, id: device.deviceId })
        }
      }
    })
    if (speakers.length === 0) {
      speakers.push({ label: await translate(love.string.DefaultDevice, {}), id: 'default' })
    }
    if (mics.length === 0) {
      mics.push({ label: await translate(love.string.DefaultDevice, {}), id: 'default' })
    }
    speakers = speakers
    mics = mics
  })

  let speakers: DropdownTextItem[] = []
  let mics: DropdownTextItem[] = []

  $: activeSpeaker = getActive(speakers, lk.getActiveDevice('audiooutput'), getSelectedSpeakerId())
  $: activeMic = getActive(mics, lk.getActiveDevice('audioinput'), getSelectedMicId())

  const client = getClient()

  async function saveNoiseCancellationPreference (
    myPreferences: DevicesPreference | undefined,
    value: boolean
  ): Promise<void> {
    if (myPreferences !== undefined) {
      await client.update(myPreferences, { noiseCancellation: value })
    } else {
      const acc = getCurrentAccount().uuid
      await client.createDoc(love.class.DevicesPreference, core.space.Workspace, {
        attachedTo: acc,
        noiseCancellation: value,
        camEnabled: true,
        micEnabled: true,
        blurRadius: 0
      })
    }
    await krispProcessor.setEnabled(value)
  }
</script>

<div class="antiPopup p-4 grid">
  <Label label={love.string.Speaker} />
  <DropdownLabels
    selected={activeSpeaker?.id}
    items={speakers}
    enableSearch={false}
    justify={'left'}
    width={'100%'}
    disabled={speakers.length === 0}
    on:selected={async (item) => {
      if (item.detail != null && item.detail !== 'default') {
        await lk.switchActiveDevice('audiooutput', item.detail)
        updateSelectedSpeakerId(item.detail)
        activeSpeaker = speakers.find((p) => p.id === item.detail) ?? speakers[0]
      }
    }}
  />
  <Label label={love.string.Microphone} />
  <DropdownLabels
    items={mics}
    placeholder={love.string.Microphone}
    selected={activeMic?.id}
    enableSearch={false}
    justify={'left'}
    disabled={mics.length === 0}
    width={'100%'}
    on:selected={async (item) => {
      if (item.detail != null && item.detail !== 'default') {
        await lk.switchActiveDevice('audioinput', item.detail)
        updateSelectedMicId(item.detail)
        activeMic = mics.find((p) => p.id === item.detail) ?? mics[0]
      }
    }}
  />
  {#if isKrispNoiseFilterSupported()}
    <Label label={love.string.NoiseCancellation} />
    <Toggle
      on={$myPreferences?.noiseCancellation ?? true}
      on:change={(e) => {
        saveNoiseCancellationPreference($myPreferences, e.detail)
      }}
    />
  {/if}
</div>

<style lang="scss">
  .grid {
    display: grid;
    grid-template-columns: 1fr auto;
    row-gap: 1rem;
    column-gap: 1rem;
    align-items: center;
  }
</style>
