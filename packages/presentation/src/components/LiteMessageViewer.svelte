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
  import { MarkupNode, markupToJSON } from '@hcengineering/text'
  import { Markup } from '@hcengineering/core'
  import LiteNode from './markup/lite/LiteNode.svelte'

  export let message: Markup | MarkupNode

  $: node = typeof message === 'string' ? markupToJSON(message) : message
</script>

<div class="text-markup-view">
  <LiteNode {node} />
</div>
