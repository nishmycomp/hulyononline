<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  /* eslint-disable @typescript-eslint/no-unused-vars */
  import contact, { Channel, Contact, getName } from '@hcengineering/contact'
  import { Ref, SocialIdType, getCurrentAccount } from '@hcengineering/core'
  import { Message, SharedMessage } from '@hcengineering/gmail'
  import { InboxNotificationsClientImpl } from '@hcengineering/notification-resources'
  import { getResource } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import setting, { Integration } from '@hcengineering/setting'
  import templates, { TemplateDataProvider } from '@hcengineering/templates'
  import { Button, Dialog, eventToHTMLElement, Icon, Label, showPopup } from '@hcengineering/ui'
  import { createEventDispatcher, onDestroy } from 'svelte'
  import gmail from '../plugin'
  import { convertMessage } from '../utils'
  import Chats from './Chats.svelte'
  import Connect from './Connect.svelte'
  import FullMessage from './FullMessage.svelte'
  import IntegrationSelector from './IntegrationSelector.svelte'
  import NewMessage from './NewMessage.svelte'

  export let channel: Channel | undefined
  // export let embedded = false
  export let message: Message | undefined = undefined
  export let messageId: Ref<Message> | undefined = undefined

  const client = getClient()
  const inboxClient = InboxNotificationsClientImpl.getClient()

  const messageQuery = createQuery()

  let object: Contact
  let gmailMessage: Message | undefined = message
  let currentMessage: SharedMessage | undefined = undefined

  let newMessage: boolean = false
  let allIntegrations: Integration[] = []
  let integrations: Integration[] = []
  let selectedIntegration: Integration | undefined = undefined

  channel && inboxClient.forceReadDoc(channel)

  const dispatch = createEventDispatcher()

  const query = createQuery()
  $: channel &&
    query.query(channel.attachedToClass, { _id: channel.attachedTo }, (result) => {
      object = result[0] as Contact
    })

  $: if (message === undefined && messageId !== undefined) {
    messageQuery.query(gmail.class.Message, { _id: messageId }, (result) => {
      gmailMessage = result[0] as Message
    })
  } else {
    gmailMessage = message
  }

  function back () {
    if (newMessage) {
      return (newMessage = false)
    }
    return (currentMessage = undefined)
  }

  async function selectHandler (e: CustomEvent): Promise<void> {
    currentMessage = e.detail
  }

  const settingsQuery = createQuery()

  let templateProvider: TemplateDataProvider | undefined

  getResource(templates.function.GetTemplateDataProvider).then((p) => {
    templateProvider = p()
  })

  onDestroy(() => {
    templateProvider?.destroy()
  })

  $: templateProvider && selectedIntegration && templateProvider.set(setting.class.Integration, selectedIntegration)

  settingsQuery.query(
    setting.class.Integration,
    {
      type: gmail.integrationType.Gmail,
      disabled: false
    },
    (res) => {
      allIntegrations = res.filter((p) => !p.disabled && p.value !== '')
      const account = getCurrentAccount()
      const emailSocialIds = account.fullSocialIds
        .filter((s) => s.type === SocialIdType.EMAIL && s.value !== '')
        .map((s) => s._id)
      const isAvailable = (p: Integration): boolean => {
        const isOwner = p.createdBy !== undefined && emailSocialIds.includes(p.createdBy)
        const shared = p.shared?.includes(account.uuid) ?? false
        return isOwner || shared
      }
      integrations = allIntegrations.filter(isAvailable)
      selectedIntegration =
        integrations.find((p) => p.createdBy !== undefined && emailSocialIds.includes(p.createdBy)) ?? integrations[0]
    }
  )

  $: gmailMessage &&
    channel &&
    object &&
    convertMessage(object, channel, gmailMessage).then((p) => (currentMessage = p))
</script>

{#if channel && object}
  <Dialog
    isFullSize
    padding={'0'}
    on:fullsize
    on:close={() => {
      dispatch('close')
    }}
  >
    <svelte:fragment slot="title">
      <div class="antiTitle icon-wrapper ml-2">
        <div class="wrapped-icon"><Icon icon={contact.icon.Email} size={'small'} /></div>
        <div class="title-wrapper">
          <span class="wrapped-title">Email</span>
          <span class="wrapped-subtitle">
            {getName(client.getHierarchy(), object)}
          </span>
        </div>
      </div>
    </svelte:fragment>

    <svelte:fragment slot="utils">
      {#if integrations.length === 0}
        <Button
          label={gmail.string.Connect}
          kind={'primary'}
          size={'medium'}
          on:click={(e) => {
            showPopup(Connect, {}, eventToHTMLElement(e))
          }}
        />
      {:else}
        <span class="content-darker-color text-sm mr-1-5"><Label label={gmail.string.From} /></span>
        <IntegrationSelector bind:selected={selectedIntegration} {integrations} size={'medium'} kind={'ghost'} />
      {/if}
    </svelte:fragment>

    {#if newMessage && selectedIntegration}
      <NewMessage {object} {channel} {currentMessage} {selectedIntegration} on:close={back} />
    {:else if currentMessage}
      <FullMessage {currentMessage} bind:newMessage on:close={back} />
    {:else}
      <Chats {object} {channel} bind:newMessage enabled={integrations.length > 0} on:select={selectHandler} />
    {/if}
  </Dialog>
{/if}
