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
  import { type Blob, type Ref, type BlobMetadata } from '@hcengineering/core'
  import { DrawingBoard, getBlobRef, imageSizeToRatio } from '@hcengineering/presentation'
  import { Loading } from '@hcengineering/ui'

  export let value: Ref<Blob>
  export let name: string
  export let metadata: BlobMetadata | undefined
  export let fit: boolean = false

  export let drawingAvailable: boolean
  export let drawingEditable: boolean
  export let drawings: any
  export let createDrawing: (data: any) => Promise<any>

  export let setLoading: ((loading: boolean) => void) | undefined = undefined

  $: originalWidth = metadata?.originalWidth
  $: originalHeight = metadata?.originalHeight
  $: pixelRatio = metadata?.pixelRatio ?? 1

  $: imageWidth = originalWidth != null ? imageSizeToRatio(originalWidth, pixelRatio) : undefined
  $: imageHeight = originalHeight != null ? imageSizeToRatio(originalHeight, pixelRatio) : undefined

  $: width = imageWidth != null ? `min(${imageWidth}px, 100%)` : '100%'
  $: height = imageHeight != null ? `min(${imageHeight}px, ${fit ? '100%' : '80vh'})` : '100%'

  let loading = true
  function _setLoading (newState: boolean): void {
    loading = newState
    setLoading?.(loading)
  }

  $: if (value !== undefined) _setLoading(true)
</script>

{#await getBlobRef(value, name) then blobRef}
  {#if loading}
    <div class="flex-center w-full h-full clear-mins">
      <Loading />
    </div>
  {/if}
  <DrawingBoard
    {imageWidth}
    {imageHeight}
    {drawings}
    {createDrawing}
    active={drawingAvailable && !loading}
    readonly={drawingAvailable && !drawingEditable}
    class="flex-center clear-mins w-full h-full"
    style={`max-width:${width};max-height:${height}`}
  >
    <img
      on:load={() => {
        _setLoading(false)
      }}
      class="object-contain mx-auto"
      style:max-width={width}
      style:max-height={height}
      src={blobRef.src}
      srcset={blobRef.srcset}
      alt={name}
      style:height={loading ? '0' : ''}
    />
  </DrawingBoard>
{/await}
