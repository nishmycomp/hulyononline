//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2024 Hardcore Engineering Inc.
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
//

import { type Attachment } from '@hcengineering/attachment'
import {
  type BlobMetadata,
  type Blob,
  type Class,
  type TxOperations as Client,
  type Data,
  type Doc,
  type Ref,
  type Space,
  type WithLookup,
  type BlobType
} from '@hcengineering/core'
import { getResource, setPlatformStatus, unknownError } from '@hcengineering/platform'
import {
  type FileOrBlob,
  getClient,
  getFileMetadata,
  getPreviewAlignment,
  uploadFile
} from '@hcengineering/presentation'
import { closeTooltip, showPopup, type PopupResult } from '@hcengineering/ui'
import workbench, { type WidgetTab } from '@hcengineering/workbench'
import view from '@hcengineering/view'

import attachment from './plugin'
import AttachmentPreviewPopup from './components/AttachmentPreviewPopup.svelte'

export async function createAttachments (
  client: Client,
  list: FileList,
  attachTo: { objectClass: Ref<Class<Doc>>, space: Ref<Space>, objectId: Ref<Doc> },
  attachmentClass: Ref<Class<Attachment>> = attachment.class.Attachment,
  extraData: Partial<Data<Attachment>> = {}
): Promise<void> {
  try {
    for (let index = 0; index < list.length; index++) {
      const file = list.item(index)
      if (file !== null) {
        const uuid = await uploadFile(file)
        await createAttachment(client, uuid, file.name, file, attachTo, attachmentClass, extraData)
      }
    }
  } catch (err: any) {
    await setPlatformStatus(unknownError(err))
  }
}

export async function createAttachment (
  client: Client,
  uuid: Ref<Blob>,
  name: string,
  file: FileOrBlob,
  attachTo: { objectClass: Ref<Class<Doc>>, space: Ref<Space>, objectId: Ref<Doc> },
  attachmentClass: Ref<Class<Attachment>> = attachment.class.Attachment,
  extraData: Partial<Data<Attachment>> = {}
): Promise<void> {
  const { objectClass, objectId, space } = attachTo
  try {
    const metadata = await getFileMetadata(file, uuid)

    await client.addCollection(attachmentClass, space, objectId, objectClass, 'attachments', {
      ...extraData,
      name,
      file: uuid,
      type: file.type,
      size: file.size,
      lastModified: file instanceof File ? file.lastModified : Date.now(),
      metadata
    })
  } catch (err: any) {
    await setPlatformStatus(unknownError(err))
  }
}

export function getType (
  type: string
): 'image' | 'text' | 'json' | 'video' | 'audio' | 'pdf' | 'link-preview' | 'other' {
  if (type.startsWith('image/')) {
    return 'image'
  }
  if (type.startsWith('audio/')) {
    return 'audio'
  }
  if (type.startsWith('video/')) {
    return 'video'
  }
  if (type.includes('application/pdf')) {
    return 'pdf'
  }
  if (type.includes('application/json')) {
    return 'json'
  }
  if (type.startsWith('text/')) {
    return 'text'
  }
  if (type.includes('application/link-preview')) {
    return 'link-preview'
  }
  return 'other'
}

export async function openAttachmentInSidebar (value: Attachment | BlobType): Promise<void> {
  closeTooltip()
  await openFilePreviewInSidebar(value.file, value.name, value.type, value.metadata)
}

export async function openFilePreviewInSidebar (
  file: Ref<Blob>,
  name: string,
  contentType: string,
  metadata?: BlobMetadata
): Promise<void> {
  const client = getClient()
  const widget = client.getModel().findAllSync(workbench.class.Widget, { _id: attachment.ids.PreviewWidget })[0]
  const createFn = await getResource(workbench.function.CreateWidgetTab)
  let icon = attachment.icon.Attachment

  if (contentType.startsWith('image/')) {
    icon = view.icon.Image
  } else if (contentType.startsWith('video/')) {
    icon = view.icon.Video
  } else if (contentType.startsWith('audio/')) {
    icon = view.icon.Audio
  } else {
    icon = view.icon.File
  }

  const tab: WidgetTab = {
    id: file,
    icon,
    name,
    data: { file, name, contentType, metadata }
  }
  await createFn(widget, tab, true)
}

export function isAttachment (value: Attachment | BlobType): value is WithLookup<Attachment> {
  return (value as Attachment)._id !== undefined
}

export function showAttachmentPreviewPopup (
  value: WithLookup<Attachment> | BlobType,
  fullSize: boolean = true
): PopupResult {
  closeTooltip()
  return showPopup(AttachmentPreviewPopup, { value, fullSize }, getPreviewAlignment(value.type ?? ''))
}

interface ImageDimensions {
  width: number
  height: number
  fit: 'cover' | 'contain'
}

export function getImageDimensions (
  size: { width: number, height: number },
  maxRem: { maxWidth: number, minWidth: number, maxHeight: number, minHeight: number }
): ImageDimensions {
  const originalWidth = size.width
  const originalHeight = size.height
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const maxWidthPx = maxRem.maxWidth * fontSize
  const minWidthPx = maxRem.minWidth * fontSize
  const maxHeightPx = maxRem.maxHeight * fontSize
  const minHeightPx = maxRem.minHeight * fontSize

  const ratio = originalHeight / originalWidth

  let width = Math.min(originalWidth, maxWidthPx)
  let height = Math.ceil(width * ratio)

  const fit = width < minWidthPx || height < minHeightPx ? 'cover' : 'contain'

  if (height > maxHeightPx) {
    width = maxHeightPx / ratio
    height = maxHeightPx
  } else if (height < minHeightPx) {
    height = minHeightPx
  }

  return { width: Math.round(width), height: Math.round(height), fit }
}
