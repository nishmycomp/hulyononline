<!--
// Copyright © 2023, 2024 Hardcore Engineering Inc.
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
  import { Doc } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { KeyedAttribute } from '@hcengineering/presentation'
  import textEditor, { CollaborationUser, RefAction } from '@hcengineering/text-editor'
  import { AnySvelteComponent, registerFocus } from '@hcengineering/ui'

  import CollaborativeTextEditor from './CollaborativeTextEditor.svelte'
  import { type FileAttachFunction } from './extension/types'

  export let object: Doc
  export let key: KeyedAttribute
  export let readonly = false
  export let refActions: RefAction[] = []

  export let user: CollaborationUser
  export let userComponent: AnySvelteComponent | undefined = undefined

  export let placeholder: IntlString = textEditor.string.EditorPlaceholder
  export let attachFile: FileAttachFunction | undefined = undefined
  export let boundary: HTMLElement | undefined = undefined

  export let focusIndex = -1

  export function isFocused (): boolean {
    return editor?.isFocused() ?? false
  }

  export function removeAttachment (id: string): void {
    return editor?.removeAttachment(id)
  }

  let editor: CollaborativeTextEditor

  // Focusable control with index
  let canBlur = true
  const { idx, focusManager } = registerFocus(focusIndex, {
    focus: () => {
      const editable: boolean = editor?.isEditable() ?? false
      if (editable) {
        editor?.focus()
      }
      return editable
    },
    isFocus: () => editor.isFocused(),
    canBlur: () => {
      const focused: boolean = editor?.isFocused() ?? false
      if (focused) {
        return canBlur
      }
      return true
    }
  })
  const updateFocus = (): void => {
    if (focusIndex !== -1) {
      focusManager?.setFocus(idx)
    }
  }

  const handleFocus = (focused: boolean): void => {
    if (focused) {
      updateFocus()
    }
  }
</script>

<CollaborativeTextEditor
  bind:this={editor}
  {object}
  attribute={key}
  {user}
  {userComponent}
  {refActions}
  {attachFile}
  {placeholder}
  {boundary}
  {readonly}
  withSideMenu={false}
  kitOptions={{
    inlineNote: false,
    hooks: {
      focus: {
        onCanBlur: (value) => {
          canBlur = value
        },
        onFocus: handleFocus
      }
    },
    shortcuts: {
      fileUpload: false
    }
  }}
  on:focus
  on:blur
  on:update
/>
