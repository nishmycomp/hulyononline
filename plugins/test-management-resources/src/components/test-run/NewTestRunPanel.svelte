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
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'

  import { Analytics } from '@hcengineering/analytics'
  import { AttachmentStyledBox } from '@hcengineering/attachment-resources'
  import { ActionContext, createMarkup, createQuery, getClient } from '@hcengineering/presentation'
  import core, { Data, Ref, getCurrentAccount, generateId, makeCollabId, WithLookup } from '@hcengineering/core'
  import testManagement, {
    TestProject,
    TestRun,
    TestCase,
    TestResult,
    TestRunStatus,
    TestManagementEvents,
    TestPlan,
    TestPlanItem
  } from '@hcengineering/test-management'
  import { Panel } from '@hcengineering/panel'
  import { EditBox, ModernButton, Label, navigate } from '@hcengineering/ui'
  import { EmptyMarkup, isEmptyMarkup } from '@hcengineering/text'
  import { IntlString } from '@hcengineering/platform'
  import { Attachment } from '@hcengineering/attachment'

  import { selectedTestCases, selectedTestPlan, resetStore } from './store/testRunStore'
  import NewTestRunAside from './NewTestRunAside.svelte'
  import TestCaseSelector from '../test-case/TestCaseSelector.svelte'
  import { getTestRunsLink, getProjectFromLocation } from '../../navigation'

  const space: Ref<TestProject> = getProjectFromLocation()
  let testCases: TestCase[] = $selectedTestCases ?? []
  const testPlan: Ref<TestPlan> | undefined = $selectedTestPlan
  let testPlanItems: WithLookup<TestPlanItem>[] | undefined = undefined

  if (testPlan !== undefined) {
    const docQuery = createQuery()
    docQuery.query(
      testManagement.class.TestPlanItem,
      { attachedTo: testPlan },
      (res: WithLookup<TestPlanItem>[]) => {
        testPlanItems = res
        testCases = testPlanItems
          .filter((item) => item?.$lookup?.testCase !== undefined)
          .map((item): TestCase => {
            const testCase = item?.$lookup?.testCase as TestCase
            if (item.assignee !== undefined) {
              testCase.assignee = item.assignee
            }
            return testCase
          })
      },
      {
        lookup: {
          testCase: testManagement.class.TestCase
        }
      }
    )
  }

  const id: Ref<TestRun> = generateId()
  const me = getCurrentAccount()

  const object: Data<TestRun> = {
    name: '' as IntlString,
    description: null,
    dueDate: undefined
  }
  const newDoc: TestRun = {
    ...object,
    _id: id,
    space,
    modifiedOn: 0,
    modifiedBy: me.primarySocialId,
    _class: testManagement.class.TestPlan
  }

  const dispatch = createEventDispatcher()
  const client = getClient()

  let description = EmptyMarkup
  let attachments: Map<Ref<Attachment>, Attachment> = new Map<Ref<Attachment>, Attachment>()

  async function onSave (): Promise<void> {
    try {
      const applyOp = client.apply()
      await applyOp.createDoc(testManagement.class.TestRun, space, object, id)
      const testCasesArray = testCases instanceof Array ? testCases : [testCases]
      const createPromises = testCasesArray.map(async (testCase) => {
        const descriptionRef = isEmptyMarkup(description)
          ? null
          : await createMarkup(makeCollabId(testManagement.class.TestRun, id, 'description'), description)

        const testResultId: Ref<TestResult> = generateId()
        const testResultData: Data<TestResult> = {
          attachedTo: id,
          attachedToClass: testManagement.class.TestRun,
          name: testCase.name,
          testCase: testCase._id,
          testSuite: testCase.attachedTo,
          collection: 'results',
          description: descriptionRef,
          status: TestRunStatus.Untested
        }

        return await applyOp.addCollection(
          testManagement.class.TestResult,
          space,
          id,
          testManagement.class.TestRun,
          'results',
          testResultData,
          testResultId
        )
      })
      await Promise.all(createPromises)
      const opResult = await applyOp.commit()
      if (!opResult.result) {
        throw new Error('Failed to create test run')
      } else {
        Analytics.handleEvent(TestManagementEvents.TestRunCreated, { id })
        dispatch('close')
        navigate(getTestRunsLink(space, id))
      }
    } catch (err: any) {
      console.error(err)
      Analytics.handleError(err)
    }
  }

  let descriptionBox: AttachmentStyledBox
  onMount(() => dispatch('open', { ignoreKeys: [] }))
  onDestroy(resetStore)
</script>

{#if object}
  <ActionContext context={{ mode: 'editor' }} />
  <Panel
    object={newDoc}
    isHeader={false}
    isAside={true}
    isSub={false}
    adaptive={'disabled'}
    withoutActivity={true}
    on:open
    on:close={() => dispatch('close')}
  >
    <svelte:fragment slot="title">
      <Label label={testManagement.string.CreateTestRun} />
    </svelte:fragment>
    <EditBox
      bind:value={object.name}
      placeholder={testManagement.string.TestRunNamePlaceholder}
      kind={'large-style'}
      autoFocus
    />

    <AttachmentStyledBox
      bind:this={descriptionBox}
      objectId={id}
      _class={testManagement.class.TestRun}
      {space}
      alwaysEdit
      showButtons={false}
      bind:content={description}
      placeholder={core.string.Description}
      kind="indented"
      isScrollable={false}
      kitOptions={{ reference: true }}
      enableAttachments={false}
      on:attachments={(ev) => {
        if (ev.detail.size > 0) attachments = ev.detail.values
        else if (ev.detail.size === 0 && ev.detail.values != null) {
          attachments.clear()
          attachments = attachments
        }
      }}
    />

    <div class="space-divider" />
    <div class="flex flex-between">
      <div id="test-cases-selector">
        <TestCaseSelector bind:objects={testCases} />
      </div>
      <ModernButton
        label={testManagement.string.Save}
        size="medium"
        kind={'primary'}
        disabled={object?.name.trim().length === 0 || testCases?.length === 0}
        on:click={onSave}
      />
    </div>

    <svelte:fragment slot="aside">
      <NewTestRunAside bind:dueDate={object.dueDate} />
    </svelte:fragment>
  </Panel>
{/if}
