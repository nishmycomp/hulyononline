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
  import core, { AnyAttribute } from '@hcengineering/core'
  import { Context, parseContext, Process, SelectedContext } from '@hcengineering/process'
  import {
    AnyComponent,
    Button,
    Component,
    DropdownIntlItem,
    DropdownLabelsIntl,
    eventToHTMLElement,
    IconAdd,
    IconClose,
    showPopup
  } from '@hcengineering/ui'
  import view from '@hcengineering/view-resources/src/plugin'
  import { createEventDispatcher } from 'svelte'
  import ContextSelectorPopup from '../attributeEditors/ContextSelectorPopup.svelte'
  import ContextValue from '../attributeEditors/ContextValue.svelte'

  export let readonly: boolean
  export let value: any
  export let process: Process
  export let context: Context
  export let attribute: AnyAttribute
  export let baseEditor: AnyComponent | undefined

  const modes: DropdownIntlItem[] = [
    { id: 'equals', label: view.string.FilterIsEither },
    { id: 'notEquals', label: view.string.FilterIsNot }
  ]

  let mode = value == null || typeof value === 'boolean' ? 'equals' : 'notEquals'

  const dispatch = createEventDispatcher()

  let contextValue: SelectedContext | undefined = undefined
  let val: any = undefined

  function selectContext (e: MouseEvent): void {
    showPopup(
      ContextSelectorPopup,
      {
        process,
        masterTag: process.masterTag,
        context,
        attribute,
        onSelect
      },
      eventToHTMLElement(e)
    )
  }

  $: parseValue(value)

  function parseValue (value: any) {
    if (typeof value === 'boolean' || value == null) {
      mode = 'equals'
      val = value
    } else {
      mode = 'notEquals'
      if (value?.$ne !== undefined) {
        val = value.$ne
      } else {
        val = undefined
      }
    }
    contextValue = parseContext(val)
  }

  function onSelect (res: SelectedContext | null): void {
    val = res === null ? undefined : '$' + JSON.stringify(res)
    buildResult()
  }

  function onChange (value: any | undefined): void {
    val = value
    buildResult()
  }

  function buildResult () {
    if (val === undefined) {
      dispatch('change', null)
      return
    }

    let result: any
    if (mode === 'equals') {
      result = val
    } else {
      result = { $ne: val }
    }

    dispatch('change', result)
  }
</script>

<div class="flex-row-center flex-gap-4">
  <DropdownLabelsIntl
    items={modes}
    selected={mode}
    disabled={readonly}
    minW0={false}
    kind={'no-border'}
    width={'100%'}
    on:selected={(e) => {
      mode = e.detail
      buildResult()
    }}
  />

  <div class="text-input" class:context={contextValue}>
    {#if contextValue}
      <ContextValue
        {process}
        masterTag={process.masterTag}
        {contextValue}
        {context}
        {attribute}
        category={'attribute'}
        attrClass={core.class.TypeBoolean}
        on:update={(e) => {
          onSelect(e.detail)
        }}
      />
    {:else}
      <div class="w-full">
        {#if baseEditor}
          <Component
            is={baseEditor}
            props={{
              label: attribute?.label,
              placeholder: attribute?.label,
              kind: 'ghost',
              size: 'large',
              width: '100%',
              justify: 'left',
              readonly,
              type: attribute?.type,
              value: val,
              onChange,
              focus
            }}
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
      <Button
        icon={IconClose}
        kind="ghost"
        on:click={() => {
          dispatch('delete')
        }}
      />
    </div>
  </div>
</div>

<style lang="scss">
  .text-input {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--theme-refinput-border);
    border-radius: 0.375rem;
    max-width: 100%;
    width: 100%;

    .button {
      flex-shrink: 0;
    }

    &.context {
      background: #3575de33;
      padding-left: 0.75rem;
      border-color: var(--primary-button-default);
    }
  }
</style>
