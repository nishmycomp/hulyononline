//
// Copyright © 2025 Hardcore Engineering Inc.
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

import { mergeAttributes, Node } from '@tiptap/core'

export const EmbedNode = Node.create<any>({
  name: 'embed',

  addOptions () {
    return {}
  },

  inline: false,
  group: 'block',
  atom: false,
  draggable: false,

  addAttributes () {
    return {
      src: {
        default: null
      }
    }
  },

  parseHTML () {
    return [
      {
        priority: 60,
        tag: `figure[data-type="${this.name}"] iframe[src]`
      }
    ]
  },

  renderHTML ({ HTMLAttributes }) {
    return ['figure', { 'data-type': this.name }, ['iframe', mergeAttributes(HTMLAttributes)]]
  }
})
