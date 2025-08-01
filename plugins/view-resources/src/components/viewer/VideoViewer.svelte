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
  import { type Blob, type BlobMetadata, type Ref } from '@hcengineering/core'
  import { getFileUrl, getVideoMeta } from '@hcengineering/presentation'
  import { HlsVideo } from '@hcengineering/hls'
  import { Video } from '@hcengineering/ui'

  export let value: Ref<Blob>
  export let name: string
  export let contentType: string
  export let metadata: BlobMetadata | undefined
  export let fit: boolean = false

  $: aspectRatio =
    metadata?.originalWidth && metadata?.originalHeight
      ? `${metadata.originalWidth} / ${metadata.originalHeight}`
      : '16 / 9'
  $: maxWidth = metadata?.originalWidth ? `min(${metadata.originalWidth}px, 100%)` : undefined
  $: maxHeight = metadata?.originalHeight ? `min(${metadata.originalHeight}px, 80vh)` : undefined
</script>

<div
  class="flex justify-center w-full"
  style:aspect-ratio={fit ? undefined : aspectRatio}
  style:max-width={fit ? '100%' : maxWidth}
  style:max-height={fit ? '100%' : maxHeight}
>
  {#if contentType.toLowerCase().endsWith('x-mpegurl')}
    {@const src = getFileUrl(value, '')}
    <HlsVideo {src} hlsSrc={src} preload />
  {:else}
    {#await getVideoMeta(value, name) then meta}
      {#if meta?.hls?.source !== undefined}
        {@const src = getFileUrl(value, '')}
        <HlsVideo {src} hlsSrc={meta.hls.source} hlsThumbnail={meta.hls.thumbnail} preload={false} />
      {:else}
        {@const src = getFileUrl(value, '')}
        <Video {src} {name} preload />
      {/if}
    {/await}
  {/if}
</div>
