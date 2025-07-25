<script lang="ts">
  import core, { RateLimiter, concatLink, metricsAggregate, platformNow, type Metrics } from '@hcengineering/core'
  import login from '@hcengineering/login'
  import { getEmbeddedLabel, getMetadata } from '@hcengineering/platform'
  import presentation, { getClient, isAdminUser, uiContext } from '@hcengineering/presentation'
  import { Button, EditBox, IconArrowLeft, IconArrowRight, fetchMetadataLocalStorage, ticker } from '@hcengineering/ui'
  import MetricsInfo from './statistics/MetricsInfo.svelte'

  const _endpoint: string = fetchMetadataLocalStorage(login.metadata.LoginEndpoint) ?? ''
  const token: string = getMetadata(presentation.metadata.Token) ?? ''

  let endpoint = _endpoint.replace(/^ws/g, 'http')
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.substring(0, endpoint.length - 1)
  }
  let warningTimeout = 15

  let commandsToSend = 1000
  let commandsToSendParallel = 1

  let running = false

  let maxTime = 0

  let avgTime = 0

  let active = 0

  let opss = 0

  let dataSize = 0

  let responseSize = 0

  let profiling = false

  async function fetchStats (time: number): Promise<void> {
    await fetch(endpoint + '/api/v1/profiling', {
      method: 'GET',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      }
    })
      .then(async (json) => {
        data = await json.json()
        profiling = data?.profiling ?? false
      })
      .catch((err) => {
        console.error(err, time)
      })
  }
  let data: any

  $: void fetchStats($ticker)

  function genData (dataSize: number): string {
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < dataSize; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
  }

  async function doBenchmark (): Promise<void> {
    avgTime = 0
    maxTime = 0
    let count = commandsToSend
    avgTime = 0
    opss = 0
    const rate = new RateLimiter(commandsToSendParallel)
    const client = getClient()

    const doOp = async (): Promise<void> => {
      const st = platformNow()
      active++
      await client.createDoc(core.class.BenchmarkDoc, core.space.Configuration, {
        source: genData(dataSize),
        request: {
          documents: 1,
          size: responseSize
        }
      })
      active--
      const ed = platformNow()

      if (ed - st > maxTime) {
        maxTime = ed - st
      }
      if (avgTime !== 0) {
        avgTime += ed - st
      } else {
        avgTime = ed - st
      }
      opss++
      count--
    }
    // eslint-disable-next-line no-unmodified-loop-condition
    while (count > 0 && running) {
      if (commandsToSendParallel > 0) {
        await rate.add(async () => {
          await doOp()
        })
      } else {
        await doOp()
      }
    }
    await rate.waitProcessing()
    running = false
  }

  async function downloadProfile (): Promise<void> {
    const link = document.createElement('a')
    link.style.display = 'none'
    link.setAttribute('target', '_blank')
    const json = await (
      await fetch(endpoint + `/api/v1/manage?token=${token}&operation=profile-stop`, {
        method: 'PUT'
      })
    ).json()
    link.setAttribute(
      'href',
      'data:application/json;charset=utf-8,%EF%BB%BF' + encodeURIComponent(JSON.stringify(json))
    )
    link.setAttribute('download', `profile-${Date.now()}.cpuprofile`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    await fetchStats(0)
  }

  let metrics: Metrics | undefined

  function update (tick: number): void {
    metrics = metricsAggregate(uiContext.metrics)
  }

  $: update($ticker)

  let maintenanceMessage = 'A new version is planned to be installed in'
</script>

{#if isAdminUser()}
  <div class="flex flex-col">
    <div class="flex-row-center p-1">
      <div class="p-3">1.</div>
      <div class="flex p-1 flex-row-center">
        <div class="flex-row-center flex-grow">
          <EditBox bind:value={maintenanceMessage}></EditBox>
        </div>
        <Button
          icon={IconArrowRight}
          label={getEmbeddedLabel('Set maintenance warning')}
          on:click={() => {
            const endpoint = getMetadata(login.metadata.AccountsUrl) ?? ''
            if (endpoint !== '') {
              void fetch(
                concatLink(endpoint, `/api/v1/manage?token=${token}&operation=maintenance&timeout=${warningTimeout}`),
                {
                  method: 'PUT',
                  body: JSON.stringify({ message: maintenanceMessage }),
                  headers: {
                    'Content-Type': 'application/json;charset=utf-8'
                  }
                }
              )
            }
          }}
        />
      </div>
      <div class="flex-col p-1">
        <div class="flex-row-center p-1">
          <EditBox kind={'underline'} format={'number'} bind:value={warningTimeout} /> min
        </div>
      </div>
      <Button
        icon={IconArrowLeft}
        label={getEmbeddedLabel('Clear warning')}
        on:click={() => {
          const endpoint = getMetadata(login.metadata.AccountsUrl) ?? ''
          if (endpoint !== '') {
            void fetch(concatLink(endpoint, `/api/v1/manage?token=${token}&operation=maintenance&timeout=-1`), {
              method: 'PUT'
            })
          }
        }}
      />
    </div>
    <div class="flex-col p-1">
      <div class="flex-row-center p-1">
        Command benchmark {Math.round((avgTime / opss) * 100) / 100}
        {Math.round(maxTime * 100) / 100} - {active}
      </div>
      <div class="flex-row-center p-1">
        <div class="flex-row-center p-1">
          <EditBox kind={'underline'} format={'number'} bind:value={commandsToSend} /> total
        </div>
        <div class="flex-row-center p-1">
          <EditBox kind={'underline'} format={'number'} bind:value={commandsToSendParallel} /> parallel
        </div>
        <div class="flex-row-center p-1">
          <EditBox kind={'underline'} format={'number'} bind:value={dataSize} /> dsize
        </div>
        <div class="flex-row-center p-1">
          <EditBox kind={'underline'} format={'number'} bind:value={responseSize} /> rsize
        </div>
        <Button
          label={getEmbeddedLabel('Benchmark')}
          on:click={() => {
            running = !running
            void doBenchmark()
          }}
        />
      </div>
    </div>

    <div class="flex-row-center p-1">
      <div class="p-3">2.</div>
      <Button
        icon={IconArrowRight}
        label={getEmbeddedLabel('Reboot workspace')}
        on:click={() => {
          void fetch(endpoint + `/api/v1/manage?token=${token}&operation=force-close`, {
            method: 'PUT'
          })
        }}
      />
    </div>
    <div class="flex-row-center p-1">
      <div class="p-3">3.</div>
      {#if !profiling}
        <Button
          label={getEmbeddedLabel('Profile server')}
          on:click={() => {
            void fetch(endpoint + `/api/v1/manage?token=${token}&operation=profile-start`, {
              method: 'PUT'
            })
            void fetchStats(0)
          }}
        />
      {:else}
        <Button label={getEmbeddedLabel('Profile Stop')} on:click={downloadProfile} />
      {/if}
    </div>
  </div>
{/if}

{#if metrics}
  <MetricsInfo {metrics} sortOrder={'avg'} />
{/if}

<style lang="scss">
  .greyed {
    color: rgba(black, 0.5);
  }
</style>
