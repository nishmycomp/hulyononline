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
  import { type SpaceType, type SpaceTypeDescriptor } from '@hcengineering/core'

  import ClassAttributes from '../../ClassAttributes.svelte'

  export let type: SpaceType | undefined
  export let descriptor: SpaceTypeDescriptor | undefined
  export let disabled: boolean = true
</script>

{#if type !== undefined && descriptor !== undefined}
  <ClassAttributes _class={type.targetClass} {disabled} showHierarchy />
{/if}
