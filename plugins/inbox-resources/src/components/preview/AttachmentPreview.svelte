<!-- Copyright © 2025 Hardcore Engineering Inc. -->
<!-- -->
<!-- Licensed under the Eclipse Public License, Version 2.0 (the "License"); -->
<!-- you may not use this file except in compliance with the License. You may -->
<!-- obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0 -->
<!-- -->
<!-- Unless required by applicable law or agreed to in writing, software -->
<!-- distributed under the License is distributed on an "AS IS" BASIS, -->
<!-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. -->
<!-- -->
<!-- See the License for the specific language governing permissions and -->
<!-- limitations under the License. -->

<script lang="ts">
  import { Message } from '@hcengineering/communication-types'
  import { Icon, Label, tooltip } from '@hcengineering/ui'
  import communication from '@hcengineering/communication'
  import { isBlobAttachment } from '@hcengineering/communication-shared'

  import AttachmentsTooltip from './AttachmentsTooltip.svelte'

  export let message: Message

  $: blobs = message.attachments.filter(isBlobAttachment) ?? []
  $: showFiles = blobs.length > 0
</script>

{#if showFiles}
  {#if message.content.trim().length > 0}
    <span class="attachments" use:tooltip={{ component: AttachmentsTooltip, props: { attachments: blobs } }}>
      {blobs.length}
      <Icon icon={communication.icon.File} size="small" />
    </span>
  {:else}
    <span class="attachments-text font-normal overflow-label">
      <Label label={communication.string.Files} />:
      <span class="ml-1 overflow-label" use:tooltip={{ component: AttachmentsTooltip, props: { attachments: blobs } }}>
        {blobs.map((it) => it.params.fileName).join(', ')}
      </span>
    </span>
  {/if}
{/if}

<style lang="scss">
  .attachments {
    margin-left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--global-secondary-TextColor);

    &:hover {
      cursor: pointer;
      color: var(--global-primary-TextColor);
    }
  }
  .attachments-text {
    display: flex;
    gap: 0.25rem;
    white-space: nowrap;
    min-width: 0;
    max-width: 100%;
  }
</style>
