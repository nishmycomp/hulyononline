<!--
// Copyright © 2022, 2025 Hardcore Engineering Inc.
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
  import { Attachment, AttachmentMetadata } from '@hcengineering/attachment'
  import {
    Blob as PlatformBlob,
    BlobMetadata,
    Class,
    Doc,
    IdMap,
    Markup,
    PersonId,
    RateLimiter,
    Ref,
    Space,
    generateId,
    toIdMap
  } from '@hcengineering/core'
  import { Asset, IntlString, getResource, setPlatformStatus, unknownError } from '@hcengineering/platform'
  import {
    DraftController,
    canDisplayLinkPreview,
    createQuery,
    deleteFile,
    draftsStore,
    fetchLinkPreviewDetails,
    getClient,
    getFileMetadata,
    isLinkPreviewEnabled,
    uploadFile,
    LinkPreviewAttachmentMetadata
  } from '@hcengineering/presentation'
  import { EmptyMarkup } from '@hcengineering/text'
  import textEditor, { type RefAction } from '@hcengineering/text-editor'
  import { AttachIcon, ReferenceInput } from '@hcengineering/text-editor-resources'
  import { Loading, type AnySvelteComponent } from '@hcengineering/ui'
  import {
    type FileUploadCallbackParams,
    type UploadHandlerDefinition,
    getUploadHandlers
  } from '@hcengineering/uploader'
  import { createEventDispatcher, onDestroy, tick } from 'svelte'
  import attachment from '../plugin'
  import AttachmentPresenter from './AttachmentPresenter.svelte'

  export let objectId: Ref<Doc>
  export let space: Ref<Space>
  export let _class: Ref<Class<Doc>>
  export let docClass: Ref<Class<Doc>> | undefined = undefined
  export let content: Markup = EmptyMarkup
  export let iconSend: Asset | AnySvelteComponent | undefined = undefined
  export let labelSend: IntlString | undefined = undefined
  export let showSend = true
  export let showActions = true
  export let shouldSaveDraft: boolean = false
  export let attachments: IdMap<Attachment> = new Map()
  export let loading = false
  export let focusIndex: number = -1
  export let autofocus = false
  export function submit (): void {
    refInput.submit()
  }
  export let placeholder: IntlString | undefined = undefined
  export let extraActions: RefAction[] = []
  export let boundary: HTMLElement | undefined = undefined
  export let skipAttachmentsPreload = false

  let refInput: ReferenceInput

  let inputFile: HTMLInputElement
  let saved = false
  const dispatch = createEventDispatcher()

  const client = getClient()
  const query = createQuery()

  $: draftKey = `${objectId}_attachments`
  $: draftController = new DraftController<Record<Ref<Attachment>, Attachment>>(draftKey)

  let draftAttachments: Record<Ref<Attachment>, Attachment> | undefined = undefined
  let originalAttachments: Set<Ref<Attachment>> = new Set<Ref<Attachment>>()
  const newAttachments: Set<Ref<Attachment>> = new Set<Ref<Attachment>>()
  const removedAttachments: Set<Attachment> = new Set<Attachment>()
  const maxLinkPreviewCount = 3
  const urlSet = new Set<string>()

  let progress = false

  let refContainer: HTMLElement

  const existingAttachmentsQuery = createQuery()
  let existingAttachments: Ref<Attachment>[] = []

  $: if (Array.from(attachments.keys()).length > 0) {
    existingAttachmentsQuery.query(
      attachment.class.Attachment,
      {
        space,
        attachedTo: objectId,
        attachedToClass: _class,
        _id: { $in: Array.from(attachments.keys()) }
      },
      (res) => {
        existingAttachments = res.map((p) => {
          if (p.type === 'application/link-preview') {
            urlSet.add(getUrlKey(p.name))
          }
          return p._id
        })
      }
    )
  } else {
    existingAttachments = []
    existingAttachmentsQuery.unsubscribe()
  }

  function isValidUrl (s: string): boolean {
    let url: URL
    try {
      url = new URL(s)
    } catch {
      return false
    }
    return url.protocol.startsWith('http')
  }

  function getUrlKey (s: string): string {
    return s
  }

  $: objectId && updateAttachments(objectId)

  async function updateAttachments (objectId: Ref<Doc>): Promise<void> {
    draftAttachments = $draftsStore[draftKey]
    if (draftAttachments && shouldSaveDraft) {
      attachments = new Map()
      newAttachments.clear()
      Object.entries(draftAttachments).map((file) => {
        return attachments.set(file[0] as Ref<Attachment>, file[1])
      })
      Object.entries(draftAttachments).map((file) => {
        return newAttachments.add(file[0] as Ref<Attachment>)
      })
      originalAttachments.clear()
      removedAttachments.clear()
      urlSet.clear()
      query.unsubscribe()
    } else if (!skipAttachmentsPreload) {
      query.query(
        attachment.class.Attachment,
        {
          attachedTo: objectId
        },
        (res) => {
          originalAttachments = new Set(res.map((p) => p._id))
          attachments = toIdMap(res)
        }
      )
    } else {
      attachments = new Map()
      newAttachments.clear()
      originalAttachments.clear()
      removedAttachments.clear()
      urlSet.clear()
      query.unsubscribe()
    }
  }

  function saveDraft (): void {
    if (shouldSaveDraft) {
      draftAttachments = Object.fromEntries(attachments)
      draftController.save(draftAttachments)
    }
  }

  async function createAttachment (file: File, meta?: AttachmentMetadata): Promise<void> {
    try {
      const uuid = await uploadFile(file)
      const metadata = meta ?? (await getFileMetadata(file, uuid))
      await _createAttachment(uuid, file.name, file, metadata)
    } catch (err: any) {
      void setPlatformStatus(unknownError(err))
    }
  }

  async function _createAttachment (
    file: Ref<PlatformBlob>,
    name: string,
    blob: File | Blob,
    metadata?: BlobMetadata
  ): Promise<void> {
    try {
      const _id: Ref<Attachment> = generateId()

      attachments.set(_id, {
        _id,
        _class: attachment.class.Attachment,
        collection: 'attachments',
        modifiedOn: 0,
        modifiedBy: '' as PersonId,
        space,
        attachedTo: objectId,
        attachedToClass: _class,
        name,
        file,
        type: blob.type,
        size: blob.size,
        lastModified: blob instanceof File ? blob.lastModified : Date.now(),
        metadata
      })
      newAttachments.add(_id)
      attachments = attachments
      saved = false
      saveDraft()
      dispatch('update', { message: content, attachments: attachments.size })
    } catch (err: any) {
      void setPlatformStatus(unknownError(err))
    }
  }

  async function saveAttachment (doc: Attachment): Promise<void> {
    if (!existingAttachments.includes(doc._id)) {
      await client.addCollection(attachment.class.Attachment, space, objectId, _class, 'attachments', doc, doc._id)
      newAttachments.delete(doc._id)
    }
  }

  async function fileSelected (): Promise<void> {
    progress = true
    await tick()
    const list = inputFile.files
    if (list === null || list.length === 0) return
    const limiter = new RateLimiter(10)
    for (let index = 0; index < list.length; index++) {
      const file = list.item(index)
      if (file !== null) {
        await limiter.add(() => createAttachment(file))
      }
    }
    await limiter.waitProcessing()
    inputFile.value = ''
    progress = false
  }

  async function fileDrop (e: DragEvent): Promise<void> {
    const list = e.dataTransfer?.files
    const limiter = new RateLimiter(10)

    if (list === undefined || list.length === 0) return
    progress = true
    for (let index = 0; index < list.length; index++) {
      const file = list.item(index)
      if (file !== null) {
        await limiter.add(() => createAttachment(file))
      }
    }
    await limiter.waitProcessing()
    progress = false
  }

  async function removeAttachment (attachment: Attachment): Promise<void> {
    removedAttachments.add(attachment)
    attachments.delete(attachment._id)
    attachments = attachments
    saveDraft()
    dispatch('update', { message: content, attachments: attachments.size })
  }

  async function deleteAttachment (attachment: Attachment): Promise<void> {
    if (attachment.type === 'application/link-preview') {
      urlSet.delete(getUrlKey(attachment.name))
    }
    if (originalAttachments.has(attachment._id)) {
      await client.removeCollection(
        attachment._class,
        attachment.space,
        attachment._id,
        attachment.attachedTo,
        attachment.attachedToClass,
        'attachments'
      )
    } else {
      await deleteFile(attachment.file)
    }
  }

  onDestroy(() => {
    if (!saved && !shouldSaveDraft) {
      newAttachments.forEach((p) => {
        const attachment = attachments.get(p)
        if (attachment !== undefined) {
          void deleteAttachment(attachment)
        }
      })
    }
  })

  export function removeDraft (removeFiles: boolean): void {
    draftController.remove()
    if (removeFiles) {
      newAttachments.forEach((p) => {
        const attachment = attachments.get(p)
        if (attachment !== undefined) {
          void deleteFile(attachment.file)
        }
      })
    }
  }

  export async function createAttachments (): Promise<void> {
    if (saved) {
      return
    }
    saved = true
    const limiter = new RateLimiter(10)
    newAttachments.forEach((p) => {
      const attachment = attachments.get(p)
      if (attachment !== undefined) {
        void limiter.add(() => saveAttachment(attachment))
      }
    })
    removedAttachments.forEach((p) => {
      void limiter.add(() => deleteAttachment(p))
    })
    await limiter.waitProcessing()
    newAttachments.clear()
    urlSet.clear()
    removedAttachments.clear()
    saveDraft()
  }

  async function onMessage (event: CustomEvent): Promise<void> {
    loading = true
    await createAttachments()
    loading = false
    dispatch('message', { message: event.detail, attachments: attachments.size })
  }

  function updateLinkPreview (): void {
    const hrefs = refContainer.getElementsByTagName('a')
    const newUrls: string[] = []
    for (let i = 0; i < hrefs.length; i++) {
      if (hrefs[i].target !== '_blank' || !isValidUrl(hrefs[i].href) || hrefs[i].rel === '') {
        continue
      }
      const key = getUrlKey(hrefs[i].href)
      if (urlSet.has(key)) {
        continue
      }
      urlSet.add(key)
      newUrls.push(hrefs[i].href)
    }
    if (newUrls.length > 0) {
      void loadLinks(newUrls)
    }
  }

  function onUpdate (event: CustomEvent): void {
    if (isLinkPreviewEnabled() && !loading && urlSet.size < maxLinkPreviewCount) {
      updateLinkPreview()
    }
    dispatch('update', { message: event.detail, attachments: attachments.size })
  }

  async function loadLinks (urls: string[]): Promise<void> {
    progress = true
    for (const url of urls) {
      try {
        const meta = await fetchLinkPreviewDetails(url)
        if (canDisplayLinkPreview(meta) && meta.url !== undefined) {
          const blob = new Blob([JSON.stringify(meta)])
          const file = new File([blob], meta.url, { type: 'application/link-preview' })
          const metadata: LinkPreviewAttachmentMetadata = {
            title: meta.title,
            image: meta.image,
            description: meta.description,
            imageWidth: meta.imageWidth,
            imageHeight: meta.imageHeight
          }
          await createAttachment(file, metadata)
        }
      } catch (err: any) {
        void setPlatformStatus(unknownError(err))
      }
    }
    progress = false
  }

  async function loadFiles (evt: ClipboardEvent): Promise<void> {
    progress = true
    const files = (evt.clipboardData?.files ?? []) as File[]

    for (const file of files) {
      await createAttachment(file)
    }

    progress = false
  }

  function pasteAction (_: any, evt: ClipboardEvent): boolean {
    let target: HTMLElement | null = evt.target as HTMLElement
    let allowed = false

    while (target != null) {
      target = target.parentElement
      if (target === refContainer) {
        allowed = true
      }
    }
    if (!allowed) {
      return false
    }
    const hasFiles = Array.from(evt.clipboardData?.items ?? []).some((i) => i.kind === 'file')

    if (hasFiles) {
      void loadFiles(evt)
      return true
    }

    return false
  }

  async function onFileUploaded ({ uuid, name, file, metadata }: FileUploadCallbackParams): Promise<void> {
    try {
      await _createAttachment(uuid, name, file, metadata)
    } catch (err: any) {
      void setPlatformStatus(unknownError(err))
    }
  }

  async function uploadWith (uploader: UploadHandlerDefinition): Promise<void> {
    const upload = await getResource(uploader.handler)
    await upload({ onFileUploaded })
  }

  let uploadActions: RefAction[] = []
  $: void getUploadHandlers({ category: 'media' }).then((handlers) => {
    let index = 1000
    const actions: RefAction[] = []
    for (const handler of handlers) {
      actions.push({
        order: handler.order ?? index++,
        label: handler.label,
        icon: handler.icon,
        action: () => {
          void uploadWith(handler)
        }
      })
    }
    uploadActions = actions
  })
</script>

<div class="flex-col no-print" bind:this={refContainer}>
  <input
    bind:this={inputFile}
    disabled={inputFile == null}
    multiple
    type="file"
    name="file"
    id="file"
    style="display: none"
    on:change={fileSelected}
  />
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="flex-col"
    on:dragover|preventDefault={() => {}}
    on:dragleave={() => {}}
    on:drop|preventDefault|stopPropagation={fileDrop}
  >
    <ReferenceInput
      {focusIndex}
      bind:this={refInput}
      bind:content
      {iconSend}
      {labelSend}
      {showSend}
      {showActions}
      autofocus={autofocus ? 'end' : false}
      loading={loading || progress}
      {boundary}
      {docClass}
      extraActions={[
        ...extraActions,
        {
          label: textEditor.string.Attach,
          icon: AttachIcon,
          action: () => {
            dispatch('focus')
            inputFile.click()
          },
          order: 1001
        },
        ...uploadActions
      ]}
      showHeader={attachments.size > 0 || progress}
      haveAttachment={attachments.size > 0}
      on:focus
      on:blur
      on:message={onMessage}
      on:update={onUpdate}
      onPaste={pasteAction}
      {placeholder}
      kitOptions={{
        file: false,
        image: false
      }}
    >
      <div slot="header">
        {#if attachments.size > 0 || progress}
          <div class="flex-row-center list scroll-divider-color">
            {#if progress}
              <div class="flex p-3">
                <Loading />
              </div>
            {/if}
            {#each Array.from(attachments.values()) as attachment}
              <div class="item flex">
                <AttachmentPresenter
                  value={attachment}
                  removable
                  on:remove={(result) => {
                    if (result !== undefined) void removeAttachment(attachment)
                  }}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </ReferenceInput>
  </div>
</div>

<style lang="scss">
  .list {
    padding: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;

    .item + .item {
      padding-left: 1rem;
      border-left: 1px solid var(--theme-divider-color);
    }
  }
</style>
