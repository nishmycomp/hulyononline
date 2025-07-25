<!--
//
// Copyright © 2022 Hardcore Engineering Inc.
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
-->
<script lang="ts">
  import { Class, Doc, Ref } from '@hcengineering/core'
  import { jsonToPmNode, MarkupNode } from '@hcengineering/text'
  import { Editor, Extension, mergeAttributes } from '@tiptap/core'
  import { Plugin, PluginKey } from '@tiptap/pm/state'
  import { DecorationSet } from '@tiptap/pm/view'
  import { onDestroy, onMount } from 'svelte'

  import { getEditorKit } from '../../src/kits/editor-kit'
  import { calculateDecorations } from './diff/decorations'
  import { defaultEditorAttributes } from './editor/editorProps'

  export let content: MarkupNode
  export let comparedVersion: MarkupNode | undefined = undefined
  export let objectClass: Ref<Class<Doc>> | undefined = undefined

  let element: HTMLElement
  let editor: Editor

  let _decoration = DecorationSet.empty
  let oldContent: MarkupNode | undefined

  function updateEditor (editor: Editor, comparedVersion?: MarkupNode): void {
    if (comparedVersion === undefined) {
      return
    }

    const node = jsonToPmNode(comparedVersion, editor.schema)
    const r = calculateDecorations(editor, oldContent, node)
    if (r !== undefined) {
      oldContent = r.oldContent
      _decoration = r.decorations
    }
  }

  const updateDecorations = (): void => {
    if (editor?.schema !== undefined) {
      updateEditor(editor, comparedVersion)
    }
  }

  // TODO: should be implemented as regular plugin
  const DecorationExtension = Extension.create({
    addProseMirrorPlugins () {
      return [
        new Plugin({
          key: new PluginKey('diffs'),
          props: {
            decorations () {
              updateDecorations()
              return _decoration
            }
          }
        })
      ]
    }
  })

  $: if (editor !== undefined && comparedVersion !== undefined) {
    updateEditor(editor, comparedVersion)
  }

  onMount(async () => {
    const kit = await getEditorKit({
      objectClass,
      commentNode: true
    })

    editor = new Editor({
      editorProps: { attributes: mergeAttributes(defaultEditorAttributes, { class: 'flex-grow' }) },
      element,
      content,
      editable: false,
      extensions: [kit, DecorationExtension],
      onTransaction: () => {
        // force re-render so `editor.isActive` works as expected
        editor = editor
      }
    })
  })

  onDestroy(() => {
    if (editor !== undefined) {
      editor.destroy()
    }
  })
</script>

<div class="ref-container">
  <div class="textInput">
    <div class="select-text" style="width: 100%;" bind:this={element} />
  </div>
</div>
