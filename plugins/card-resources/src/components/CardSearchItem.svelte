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
//
-->
<script lang="ts">
  import { Card } from '@hcengineering/card'
  import { WithLookup } from '@hcengineering/core'
  import CardIcon from './CardIcon.svelte'

  export let value: WithLookup<Card>
</script>

<div class="flex-row-center">
  <div class="flex-center p-1 content-dark-color flex-no-shrink mr-2-5">
    <CardIcon {value} size={'medium'} />
  </div>
  <span class="overflow-label">
    {value.title}
  </span>
</div>
