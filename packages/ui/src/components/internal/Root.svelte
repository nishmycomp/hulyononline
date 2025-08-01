<script lang="ts">
  import platform, { OK, PlatformEvent, Severity, Status, addEventListener, getMetadata } from '@hcengineering/platform'
  import { onDestroy, onMount } from 'svelte'
  import type { AnyComponent, WidthType } from '../../types'
  import { deviceSizes, deviceWidths } from '../../types'
  // import { applicationShortcutKey } from '../../utils'
  import { Theme, themeStore } from '@hcengineering/theme'
  import {
    IconArrowLeft,
    IconArrowRight,
    checkMobile,
    deviceOptionsStore as deviceInfo,
    checkAdaptiveMatching,
    getLocalWeekStart
  } from '../../'
  import { desktopPlatform, getCurrentLocation, location, locationStorageKeyId, navigate } from '../../location'
  import uiPlugin from '../../plugin'
  import Component from '../Component.svelte'
  import Label from '../Label.svelte'
  import StatusComponent from '../Status.svelte'
  import Clock from './Clock.svelte'
  import RootBarExtension from './RootBarExtension.svelte'
  import Settings from './Settings.svelte'
  import { isAppFocusedStore } from '../../stores'

  let application: AnyComponent | undefined

  function updateAppFocused (isFocused: boolean): void {
    const isFocusedCurrent = $isAppFocusedStore
    const isFocusedNew = isFocused && !document.hidden && document.hasFocus()
    if (isFocusedCurrent !== isFocusedNew) {
      isAppFocusedStore.set(isFocusedNew)
    }
  }
  function visibilityChangeHandler (): void {
    updateAppFocused(!document.hidden)
  }
  function handleWindowFocus (): void {
    updateAppFocused(true)
  }
  function handleWindowBlur (): void {
    updateAppFocused(false)
  }

  onMount(() => {
    document.addEventListener('visibilitychange', visibilityChangeHandler)
    window.addEventListener('wheel', handleWindowFocus)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('blur', handleWindowBlur)
  })

  onDestroy(() => {
    document.removeEventListener('visibilitychange', visibilityChangeHandler)
    window.removeEventListener('wheel', handleWindowFocus)
    window.removeEventListener('focus', handleWindowFocus)
    window.removeEventListener('blur', handleWindowBlur)
  })

  onDestroy(
    location.subscribe((loc) => {
      const routes = getMetadata(uiPlugin.metadata.Routes) ?? new Map()
      const component = loc.path[0]

      application = routes.get(component)
      if (application === undefined && Array.from(routes.values()).includes(component as AnyComponent)) {
        // if component id is used
        application = component as AnyComponent
      }

      if (application === undefined) {
        let last = loc.path[1] !== undefined ? localStorage.getItem(`${locationStorageKeyId}_${loc.path[1]}`) : null
        if (last === null) {
          last = localStorage.getItem(locationStorageKeyId)
        }
        let useDefault = true
        if (last !== null) {
          const storedLoc = JSON.parse(last)
          const key = storedLoc.path?.[0]
          if (Array.from(routes.values()).includes(key) || Array.from(routes.keys()).includes(key)) {
            useDefault = false
            navigate(storedLoc)
          }
        }
        if (useDefault) {
          application = getMetadata(uiPlugin.metadata.DefaultApplication)
          if (application !== undefined) {
            const loc = getCurrentLocation()
            loc.path = [application]
            navigate(loc)
          }
        }
      }
    })
  )

  let status = OK
  let readonlyAccount = false
  let systemAccount = false
  let maintenanceTime = -1
  let maintenanceMessage: string | undefined

  addEventListener(PlatformEvent, async (_event, _status: Status) => {
    if (_status.code === platform.status.MaintenanceWarning) {
      maintenanceTime = _status.params.time
      maintenanceMessage = _status.params.message
    } else {
      if (_status.code === platform.status.RegularAccount) {
        readonlyAccount = false
        _status = OK
      }
      if (readonlyAccount) return
      if (_status.code === platform.status.ReadOnlyAccount) {
        readonlyAccount = true
      }
      if (_status.code === platform.status.SystemAccount) {
        systemAccount = true
        return
      }
      status = _status
    }
  })

  let docWidth: number = window.innerWidth
  let docHeight: number = window.innerHeight

  let isMobile: boolean
  const alwaysMobile: boolean = false
  $: isMobile = alwaysMobile || checkMobile()
  let isPortrait: boolean
  $: isPortrait = docWidth <= docHeight

  $: $deviceInfo.docWidth = docWidth
  $: $deviceInfo.docHeight = docHeight
  $: $deviceInfo.isPortrait = isPortrait
  $: $deviceInfo.isMobile = isMobile
  $: $deviceInfo.minWidth = docWidth <= 480
  $: $deviceInfo.twoRows = docWidth <= 680
  $: $deviceInfo.language = $themeStore.language
  $: $deviceInfo.fontSize = $themeStore.fontSize

  $: document.documentElement.style.setProperty('--app-height', `${docHeight}px`)

  let doubleTouchStartTimestamp = 0
  document.addEventListener('touchstart', (event) => {
    const now = +new Date()
    if (doubleTouchStartTimestamp + 500 > now) {
      event.preventDefault()
    }
    doubleTouchStartTimestamp = now
  })
  document.addEventListener('dblclick', (event) => {
    event.preventDefault()
  })

  let remove: any = null
  const sizes: Record<WidthType, boolean> = { xs: false, sm: false, md: false, lg: false, xl: false, xxl: false }
  const css: Record<WidthType, string> = { xs: '', sm: '', md: '', lg: '', xl: '', xxl: '' }
  deviceSizes.forEach((ds, i) => {
    if (i === 0) css[ds] = `(max-width: ${deviceWidths[i]}px)`
    else if (i === deviceSizes.length - 1) css[ds] = `(min-width: ${deviceWidths[i - 1]}.01px)`
    else css[ds] = `(min-width: ${deviceWidths[i - 1]}.01px) and (max-width: ${deviceWidths[i]}px)`
  })
  const getSize = (width: number): WidthType => {
    return deviceSizes[
      deviceWidths.findIndex((it) => (it === -1 ? deviceWidths[deviceWidths.length - 2] < width : it > width))
    ]
  }
  const updateDeviceSize = () => {
    if (remove !== null) remove()
    const size = getSize(docWidth)
    const mqString = css[size]
    const media = matchMedia(mqString)

    deviceWidths.forEach((_, i) => (sizes[deviceSizes[i]] = false))
    deviceWidths.forEach((dw, i) => {
      sizes[deviceSizes[i]] =
        dw === -1 ? deviceWidths[deviceWidths.length - 2] < docWidth : docWidth > dw || size === deviceSizes[i]
    })
    $deviceInfo.size = size
    $deviceInfo.sizes = sizes
    media.addEventListener('change', updateDeviceSize)
    remove = () => {
      media.removeEventListener('change', updateDeviceSize)
    }
  }
  updateDeviceSize()

  $: secondRow = checkAdaptiveMatching($deviceInfo.size, 'xs')
  $: appsMini =
    $deviceInfo.isMobile &&
    (($deviceInfo.isPortrait && $deviceInfo.docWidth <= 480) ||
      (!$deviceInfo.isPortrait && $deviceInfo.docHeight <= 480))

  const weekInfoFirstDay: number = getLocalWeekStart()
  const savedFirstDayOfWeek = localStorage.getItem('firstDayOfWeek') ?? 'system'
  $deviceInfo.firstDayOfWeek =
    parseInt(savedFirstDayOfWeek === 'system' ? weekInfoFirstDay.toString() : savedFirstDayOfWeek, 10) ??
    weekInfoFirstDay
</script>

<svelte:window
  bind:innerWidth={docWidth}
  bind:innerHeight={docHeight}
  on:dragover|preventDefault
  on:drop|preventDefault
/>

<Theme>
  <div id="ui-root" class:mobile-theme={isMobile}>
    <div class="antiStatusBar">
      <div class="flex-row-center h-full content-color gap-3 px-4">
        {#if desktopPlatform}
          <div class="history-box flex-row-center gap-3">
            <button
              id="statusbar-back"
              class="antiButton ghost jf-center bs-none no-focus resetIconSize statusButton square"
              style:color={'var(--theme-dark-color)'}
              on:click={() => {
                history.back()
              }}
            >
              <IconArrowLeft size={'small'} />
            </button>
            <button
              id="statusbar-forward"
              class="antiButton ghost jf-center bs-none no-focus resetIconSize statusButton square"
              style:color={'var(--theme-dark-color)'}
              on:click={() => {
                history.forward()
              }}
            >
              <IconArrowRight size={'small'} />
            </button>
          </div>
        {/if}
        {#if !secondRow}
          <div
            class="flex-row-center left-items flex-gap-1"
            class:ml-14={appsMini}
            style:-webkit-app-region={'no-drag'}
          >
            <RootBarExtension position="left" />
          </div>
        {/if}
        <div
          class="flex-row-center justify-center status-info"
          style:margin-left={(isPortrait && docWidth <= 480) || (!isPortrait && docHeight <= 480) ? '1.5rem' : '0'}
        >
          {#if maintenanceTime > 0}
            <div class="flex-grow flex-center flex-row-center" class:maintenanceScheduled={maintenanceTime > 0}>
              {#if maintenanceMessage !== undefined && maintenanceMessage.trim() !== ''}
                {maintenanceMessage}
              {:else}
                <Label label={platform.status.MaintenanceWarning} />
              {/if}
              <Label label={platform.status.MaintenanceWarningTime} params={{ time: maintenanceTime }} />
            </div>
          {:else if status.severity !== Severity.OK}
            <StatusComponent {status} />
          {/if}
          {#if systemAccount}
            <div class="flex-row-center maintenanceScheduled">
              <Label label={platform.status.SystemAccount} />
            </div>
          {/if}
        </div>
        <div class="flex-row-reverse flex-gap-0-5" style:-webkit-app-region={'no-drag'}>
          <Settings />
          <Clock />
          <div class="flex-row-center flex-gap-0-5">
            {#if !secondRow}
              <RootBarExtension position="right" />
            {/if}
          </div>
        </div>
      </div>
      {#if secondRow}
        <div class="flex-between h-full content-color gap-3 px-2 second-row" style:-webkit-app-region={'no-drag'}>
          <div class="flex-row-center flex-gap-0-5">
            <RootBarExtension position="left" />
          </div>
          <div class="flex-row-center flex-gap-0-5">
            <RootBarExtension position="right" />
          </div>
        </div>
      {/if}
    </div>
    <div class="app">
      {#if application}
        <Component is={application} props={{}} />
      {:else}
        <div class="error">
          Application not found: {application}
        </div>
      {/if}
    </div>
  </div>
</Theme>

<style lang="scss">
  #ui-root {
    position: relative;
    display: flex;
    flex-direction: column;
    // height: 100vh;
    height: calc(100% - var(--huly-top-indent, 0rem));
    height: calc(100dvh - var(--huly-top-indent, 0rem));
    // height: var(--app-height);

    .antiStatusBar {
      -webkit-app-region: drag;
      min-width: 0;
      min-height: var(--status-bar-height);
      height: var(--status-bar-height);
      // min-width: 600px;
      font-size: 0.75rem;
      line-height: 150%;
      background-color: var(--theme-statusbar-color);
      z-index: 1;

      .history-box {
        -webkit-app-region: no-drag;
        margin-left: var(--huly-history-box-left-indent, 4.625rem);
      }
      .maintenanceScheduled {
        padding: 0 0.5rem;
        width: fit-content;
        height: 1.25rem;
        max-width: 22rem;
        color: var(--tooltip-bg-color);
        background-color: var(--highlight-red);
        border-radius: 0.625rem;
      }

      .status-info {
        flex-grow: 1;
        text-align: center;
      }
      .logo-status {
        font-weight: 500;
        font-size: 14px;
        color: var(--theme-content-color);
      }

      .second-row {
        display: none;
      }

      @media print {
        display: none;
      }
    }

    .app {
      display: flex;
      height: calc(100% - var(--status-bar-height));

      .error {
        margin-top: 45vh;
        text-align: center;
      }

      @media print {
        flex-direction: column;
      }
    }
  }

  .left-items {
    overflow-x: auto;
  }

  @media (max-width: 480px) {
    #ui-root:has(.workbench-container) .antiStatusBar {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 2px 0;
      width: 100%;

      .second-row {
        display: flex;
      }
    }
  }
</style>
