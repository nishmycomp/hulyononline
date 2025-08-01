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
  import { MasterTag, Tag } from '@hcengineering/card'
  import { AnyAttribute, Class, Doc, Ref } from '@hcengineering/core'
  import { Context, parseContext, Process, SelectedContext } from '@hcengineering/process'
  import {
    AnySvelteComponent,
    Button,
    eventToHTMLElement,
    IconAdd,
    IconClose,
    Label,
    showPopup,
    tooltip
  } from '@hcengineering/ui'
  import { AttributeCategory } from '@hcengineering/view'
  import { createEventDispatcher } from 'svelte'
  import ContextSelectorPopup from './attributeEditors/ContextSelectorPopup.svelte'
  import ContextValue from './attributeEditors/ContextValue.svelte'

  export let process: Process
  export let masterTag: Ref<MasterTag | Tag>
  export let value: any
  export let context: Context
  export let presenterClass: {
    attrClass: Ref<Class<Doc>>
    category: AttributeCategory
  }
  export let attribute: AnyAttribute
  export let editor: AnySvelteComponent | undefined
  export let allowRemove: boolean = false
  export let forbidValue: boolean = false
  export let allowArray: boolean = false

  const dispatch = createEventDispatcher()

  $: contextValue = parseContext(value)

  function onChange (value: any | undefined): void {
    dispatch('change', value)
  }

  function selectContext (e: MouseEvent): void {
    showPopup(
      ContextSelectorPopup,
      {
        process,
        masterTag,
        context,
        attribute,
        forbidValue,
        onSelect
      },
      eventToHTMLElement(e)
    )
  }

  function onSelect (res: SelectedContext | null): void {
    value = res === null ? undefined : '$' + JSON.stringify(res)
    dispatch('change', value)
  }
</script>

<span
  class="labelOnPanel"
  use:tooltip={{
    props: { label: attribute.label }
  }}
>
  <Label label={attribute.label} />
</span>
<div class="text-input">
  {#if contextValue}
    <ContextValue
      {process}
      {masterTag}
      {contextValue}
      {context}
      {attribute}
      {allowArray}
      category={presenterClass.category}
      attrClass={presenterClass.attrClass}
      {forbidValue}
      on:update={(e) => {
        onSelect(e.detail)
      }}
    />
  {:else}
    <div class="w-full">
      {#if !forbidValue && editor}
        <svelte:component
          this={editor}
          label={attribute?.label}
          placeholder={attribute?.label}
          kind={'ghost'}
          size={'large'}
          width={'100%'}
          justify={'left'}
          type={attribute?.type}
          showNavigate={false}
          {value}
          {onChange}
          {focus}
        />
      {/if}
    </div>
  {/if}
  <div class="button flex-row-center">
    <Button
      icon={IconAdd}
      kind="ghost"
      on:click={(e) => {
        selectContext(e)
      }}
    />
    {#if allowRemove}
      <Button
        icon={IconClose}
        kind="ghost"
        on:click={() => {
          dispatch('remove', { key: attribute.name })
        }}
      />
    {/if}
  </div>
</div>

<style lang="scss">
  .text-input {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    min-height: 2.5rem;
    border: 1px solid var(--theme-refinput-border);
    border-radius: 0.375rem;
    max-width: 100%;
    width: 100%;

    .button {
      flex-shrink: 0;
    }
  }
</style>
