<!--
// Copyright © 2020 Anticrm Platform Contributors.
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
  import contact, { formatName, getCurrentEmployee } from '@hcengineering/contact'
  import { myEmployeeStore } from '@hcengineering/contact-resources'
  import core, { AccountRole, getCurrentAccount, hasAccountRole } from '@hcengineering/core'
  import login, { loginId } from '@hcengineering/login'
  import { createQuery, getCurrentWorkspaceUrl } from '@hcengineering/presentation'
  import setting, { settingId, SettingsCategory } from '@hcengineering/setting'
  import {
    Action,
    closePopup,
    Component,
    deviceOptionsStore as deviceInfo,
    getCurrentResolvedLocation,
    locationToUrl,
    Menu,
    navigate,
    showPopup
  } from '@hcengineering/ui'
  import view from '@hcengineering/view'
  import workbench from '../plugin'
  import { logOut } from '../utils'
  import HelpAndSupport from './HelpAndSupport.svelte'
  import { Analytics } from '@hcengineering/analytics'
  import { allowGuestSignUpStore } from '@hcengineering/view-resources'

  let items: SettingsCategory[] = []

  const account = getCurrentAccount()
  const settingsQuery = createQuery()
  settingsQuery.query(
    setting.class.SettingsCategory,
    {},
    (res) => {
      items = res.filter((p) => hasAccountRole(getCurrentAccount(), p.role))
    },
    { sort: { order: 1 } }
  )

  $: person = $myEmployeeStore

  function selectCategory (sp?: SettingsCategory): void {
    closePopup()
    const loc = getCurrentResolvedLocation()
    loc.fragment = undefined
    loc.query = undefined
    loc.path[2] = settingId
    if (sp) {
      loc.path[3] = sp.name
      loc.path.length = 4
    } else {
      loc.path.length = 3
    }
    navigate(loc)
  }

  function inviteWorkspace (): void {
    showPopup(login.component.InviteLink, {})
  }

  function helpAndSupport (): void {
    showPopup(HelpAndSupport, {}, 'help-center')
  }

  function filterItems (items: SettingsCategory[], keys: string[]): SettingsCategory[] {
    return items.filter(
      (p) => p._id !== setting.ids.Profile && p._id !== setting.ids.Password && keys.includes(p.group ?? '')
    )
  }

  function editProfile (items: SettingsCategory[]): void {
    const profile = items.find((p) => p._id === setting.ids.Profile)
    if (profile === undefined) return
    selectCategory(profile)
  }

  function getURLCategory (sp: SettingsCategory): string {
    const loc = getCurrentResolvedLocation()
    loc.path[2] = settingId
    loc.path[3] = sp.name
    loc.path.length = 4
    return locationToUrl(loc)
  }

  const getMenu = (items: SettingsCategory[], keys: string[]): Action[] => {
    const actions: Action[] = filterItems(items, keys).map((i) => {
      return {
        icon: i.icon,
        label: i.label,
        action: async () => {
          selectCategory(i)
        },
        link: getURLCategory(i),
        inline: true,
        group: i.group
      }
    })
    return actions
  }

  let actions: Action[] = []
  $: {
    actions = []
    if (hasAccountRole(account, AccountRole.DocGuest)) {
      actions.push({
        icon: view.icon.Setting,
        label: setting.string.Settings,
        action: async () => {
          selectCategory()
        }
      })
    }
    actions.push(...getMenu(items, ['main']))
    if (hasAccountRole(account, AccountRole.User)) {
      actions.push({
        icon: setting.icon.InviteWorkspace,
        label: setting.string.InviteWorkspace,
        action: async () => {
          inviteWorkspace()
        },
        group: 'end'
      })
    }

    if (hasAccountRole(account, AccountRole.User)) {
      actions.push({
        icon: setting.icon.Signout,
        label: setting.string.SelectWorkspace,
        action: async () => {
          closePopup()
          const loc = getCurrentResolvedLocation()
          loc.fragment = undefined
          loc.query = undefined
          loc.path[0] = loginId
          loc.path[1] = 'selectWorkspace'
          loc.path.length = 2
          navigate(loc)
        },
        group: 'end'
      })
    }

    actions.push({
      icon: setting.icon.Support,
      label: workbench.string.HelpAndSupport,
      action: async () => {
        helpAndSupport()
      },
      group: 'end'
    })

    if (account.role === AccountRole.ReadOnlyGuest) {
      if ($allowGuestSignUpStore) {
        actions.push({
          icon: setting.icon.InviteWorkspace,
          label: view.string.ReadOnlyJoinWorkspace,
          labelParams: { icon: '' },
          action: async () => {
            navigate({ path: ['login', 'join'], query: { workspace: getCurrentWorkspaceUrl() } })
          },
          group: 'end'
        })
      }
      actions.push({
        icon: setting.icon.InviteWorkspace,
        label: view.string.ReadOnlySignUp,
        labelParams: { icon: '' },
        action: async () => {
          open('https://huly.io/signup')
        },
        group: 'end'
      })
    }

    actions.push({
      icon: setting.icon.Signout,
      label: hasAccountRole(account, AccountRole.DocGuest) ? setting.string.Signout : login.string.LogIn,
      action: async () => {
        await logOut()
        navigate({ path: [loginId] })
        Analytics.handleEvent('workbench.SignOut')
        Analytics.logout()
      },
      group: 'end'
    })
  }
  let menu: Menu
  $: addClass = $deviceInfo.isMobile && $deviceInfo.isPortrait ? 'self-end' : undefined
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<svelte:component this={Menu} bind:this={menu} {actions} {addClass} on:close>
  <svelte:fragment slot="header">
    <div
      class="ap-menuItem hoverable flex-row-center withIcon flex-grow"
      on:mousemove={() => {
        menu.clearFocus()
      }}
      on:click={() => {
        editProfile(items)
      }}
    >
      {#if getCurrentEmployee() === core.employee.System}
        <div class="ml-2 flex-col">
          <div class="overflow-label fs-bold">System</div>
        </div>
      {:else}
        {#if person}
          <Component is={contact.component.Avatar} props={{ person, size: 'medium', name: person.name }} />
        {/if}
        <div class="ml-2 flex-col">
          {#if person}
            <div class="overflow-label fs-bold caption-color">
              {formatName(person.name)}
            </div>
            <!-- TODO: Show current primary social id? -->
            <!-- <div class="overflow-label text-sm content-dark-color">{account.email}</div> -->
          {/if}
        </div>
      {/if}
    </div>
    <div class="ap-menuItem separator" />
  </svelte:fragment>
</svelte:component>
