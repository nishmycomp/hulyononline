<!--
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
-->
<script lang="ts">
  import { Label } from '@hcengineering/ui'
  import { Context, SelectedRelation } from '@hcengineering/process'

  export let contextValue: SelectedRelation
  export let context: Context

  $: relation = context.relations[contextValue.name]
  $: attr = contextValue.key !== '_id' && relation?.attributes?.find((p) => p.name === contextValue.key)
</script>

{#if contextValue.key === '_id'}
  {relation.name}
{:else if relation !== undefined && attr}
  {relation.name}
  <span class="attr">
    <Label label={attr.label} />
  </span>
{/if}

<style lang="scss">
  .attr {
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    background-color: var(--theme-navpanel-color);
  }
</style>
