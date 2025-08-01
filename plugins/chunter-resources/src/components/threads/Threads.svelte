<!--
// Copyright © 2023 Hardcore Engineering Inc.
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
  import activity, { ActivityMessage } from '@hcengineering/activity'
  import { ActivityMessagePresenter } from '@hcengineering/activity-resources'
  import attachment from '@hcengineering/attachment'
  import core, { Collaborator, getCurrentAccount, Ref, SortingOrder } from '@hcengineering/core'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { Lazy, Loading, Scroller } from '@hcengineering/ui'

  import { openMessageFromSpecial } from '../../navigation'
  import chunter from '../../plugin'
  import BlankView from '../BlankView.svelte'
  import Header from '../Header.svelte'
  import LoadingHistory from '../LoadingHistory.svelte'

  const threadsQuery = createQuery()
  const client = getClient()
  const h = client.getHierarchy()

  let threads: ActivityMessage[] = []
  let isLoading = true

  let divScroll: HTMLElement | undefined | null = undefined

  let limit = 100
  let hasNextPage = true

  let collabs: Collaborator[] = []

  const query = createQuery()
  query.query(
    core.class.Collaborator,
    {
      collaborator: getCurrentAccount().uuid,
      attachedToClass: { $in: h.getDescendants(activity.class.ActivityMessage) }
    },
    (res) => {
      collabs = res
    }
  )

  $: threadsQuery.query(
    activity.class.ActivityMessage,
    {
      replies: { $gte: 1 },
      _id: { $in: collabs.map((c) => c.attachedTo as Ref<ActivityMessage>) }
    },
    (res) => {
      if (res.length <= limit) {
        hasNextPage = false
      } else {
        res.pop()
      }
      threads = res
      isLoading = false
    },
    {
      sort: { modifiedOn: SortingOrder.Descending },
      lookup: {
        _id: {
          attachments: attachment.class.Attachment,
          reactions: activity.class.Reaction
        }
      },
      limit: limit + 1
    }
  )

  function handleScroll (): void {
    if (divScroll != null && hasNextPage && threads.length === limit) {
      const isAtBottom = divScroll.scrollTop + divScroll.clientHeight >= divScroll.scrollHeight - 400
      if (isAtBottom) {
        limit += 100
      }
    }
  }
</script>

<Header icon={chunter.icon.Thread} intlLabel={chunter.string.Threads} titleKind={'breadcrumbs'} />

<Scroller bind:divScroll padding="0.75rem 0.5rem" noStretch={threads.length > 0} onScroll={handleScroll}>
  {#if isLoading}
    <Loading />
  {:else if threads.length === 0}
    <BlankView icon={chunter.icon.Thread} header={chunter.string.NoThreadsYet} />
  {:else}
    {#each threads as thread}
      <div class="container">
        <Lazy>
          <ActivityMessagePresenter
            value={thread}
            onClick={() => openMessageFromSpecial(thread)}
            withShowMore={false}
          />
        </Lazy>
      </div>
    {/each}
    {#if hasNextPage}
      <LoadingHistory isLoading={threads.length < limit} />
    {/if}
  {/if}
</Scroller>

<style lang="scss">
  .container {
    display: flex;
    flex-direction: column;
    min-height: 3.75rem;
  }
</style>
