<!--
// Copyright © 2023 Hardcore Engineering Inc.
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
  import { getClient } from '@hcengineering/presentation'
  import { Ref, Space, matchQuery, Doc } from '@hcengineering/core'
  import notification, {
    ActivityInboxNotification,
    ActivityNotificationViewlet,
    DisplayActivityInboxNotification
  } from '@hcengineering/notification'
  import {
    ActivityMessagePreview,
    combineActivityMessages,
    sortActivityMessages
  } from '@hcengineering/activity-resources'
  import activity, { ActivityMessage, DisplayActivityMessage, DocUpdateMessage } from '@hcengineering/activity'
  import { Action, Component } from '@hcengineering/ui'
  import { getActions } from '@hcengineering/view-resources'
  import { getResource } from '@hcengineering/platform'

  export let object: Doc | undefined
  export let value: DisplayActivityInboxNotification
  export let viewlets: ActivityNotificationViewlet[] = []
  export let space: Ref<Space> | undefined = undefined

  const client = getClient()

  let viewlet: ActivityNotificationViewlet | undefined = undefined
  let displayMessage: DisplayActivityMessage | undefined = undefined
  let actions: Action[] = []

  $: void updateDisplayMessage(value.combinedMessages)

  async function updateDisplayMessage (messages: ActivityMessage[]): Promise<void> {
    const combinedMessages = await combineActivityMessages(sortActivityMessages(messages))

    displayMessage = combinedMessages[0]
  }

  $: void getAllActions(value).then((res) => {
    actions = res
  })

  $: updateViewlet(viewlets, displayMessage)

  function matchViewlet (viewlet: ActivityNotificationViewlet, message: DisplayActivityMessage): boolean {
    const hierarchy = client.getHierarchy()
    const matched = matchQuery([message], viewlet.messageMatch, message._class, hierarchy, true)[0]
    if (matched !== undefined) return true

    if (hierarchy.isDerived(message._class, activity.class.DocUpdateMessage)) {
      const dum = message as DocUpdateMessage
      const dumUpdated: DocUpdateMessage = {
        ...dum,
        objectClass: hierarchy.getParentClass(dum.objectClass)
      }
      const matched = matchQuery([dumUpdated], viewlet.messageMatch, message._class, hierarchy, true)[0]
      return matched !== undefined
    }

    return false
  }

  function updateViewlet (viewlets: ActivityNotificationViewlet[], message?: DisplayActivityMessage): void {
    if (viewlets.length === 0 || message === undefined) {
      viewlet = undefined
      return
    }

    for (const v of viewlets) {
      const matched = matchViewlet(v, message)
      if (matched) {
        viewlet = v
        return
      }
    }

    viewlet = undefined
  }

  async function getAllActions (value: ActivityInboxNotification): Promise<Action[]> {
    const notificationActions = await getActions(client, value, notification.class.InboxNotification)

    const result: Action[] = []

    for (const action of notificationActions) {
      const actionImpl = await getResource(action.action)
      result.push({
        ...action,
        action: (event?: any) => actionImpl(value, event, action.actionProps)
      })
    }

    return result
  }
</script>

{#if displayMessage !== undefined}
  {#if viewlet}
    <Component
      is={viewlet.presenter}
      props={{
        message: displayMessage,
        notification: value,
        actions
      }}
      on:click
    />
  {:else}
    <ActivityMessagePreview value={displayMessage} {actions} {space} doc={object} on:click />
  {/if}
{/if}
