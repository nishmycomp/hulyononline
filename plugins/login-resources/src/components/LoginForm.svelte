<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022 Hardcore Engineering Inc.
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
  import { type IntlString, Severity, Status } from '@hcengineering/platform'
  import { signupStore } from '@hcengineering/analytics-providers'
  import { onMount } from 'svelte'

  import { type BottomAction, doLoginAsGuest, doLoginNavigate, LoginMethods } from '../index'
  import LoginPasswordForm from './LoginPasswordForm.svelte'
  import LoginOtpForm from './LoginOtpForm.svelte'
  import BottomActionComponent from './BottomAction.svelte'
  import login from '../plugin'
  import { LoginInfo } from '@hcengineering/account-client'

  export let navigateUrl: string | undefined = undefined
  export let signUpDisabled = false
  export let useOTP = true
  export let email: string | undefined = undefined
  export let caption: IntlString | undefined = undefined
  export let subtitle: string | undefined = undefined
  export let onLogin: ((loginInfo: LoginInfo | null, status: Status) => void | Promise<void>) | undefined = undefined

  let method: LoginMethods = useOTP ? LoginMethods.Otp : LoginMethods.Password

  onMount(() => {
    signupStore.setSignUpFlow(false)
  })

  function changeMethod (event: CustomEvent<LoginMethods>): void {
    method = event.detail
  }

  const loginWithPasswordAction: BottomAction = {
    i18n: login.string.LoginWithPassword,
    func: () => {
      method = LoginMethods.Password
    }
  }

  const loginWithCodeAction: BottomAction = {
    i18n: login.string.LoginWithCode,
    func: () => {
      method = LoginMethods.Otp
    }
  }

  async function guestLogin (): Promise<void> {
    let status = new Status(Severity.INFO, login.status.ConnectingToServer, {})
    const [loginStatus, result] = await doLoginAsGuest()
    status = loginStatus

    if (onLogin !== undefined) {
      void onLogin(result, status)
    } else {
      await doLoginNavigate(
        result,
        (st) => {
          status = st
        },
        navigateUrl
      )
    }
  }

  const loginAsGuest: BottomAction = {
    i18n: login.string.LoginAsGuest,
    func: () => {
      void guestLogin()
    }
  }
</script>

{#if method === LoginMethods.Otp}
  <LoginOtpForm {navigateUrl} {signUpDisabled} {email} {caption} {subtitle} {onLogin} on:change={changeMethod} />
{:else}
  <LoginPasswordForm {navigateUrl} {signUpDisabled} {email} {caption} {subtitle} {onLogin} on:change={changeMethod} />
{/if}
<div class="actions">
  <BottomActionComponent action={method === LoginMethods.Otp ? loginWithPasswordAction : loginWithCodeAction} />
  <div class="login-as-guest">
    <BottomActionComponent action={loginAsGuest} />
  </div>
</div>

<style lang="scss">
  .actions {
    margin-left: 5rem;
  }
  .login-as-guest {
    margin-top: 1rem;
  }
</style>
