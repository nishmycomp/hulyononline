//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
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
//

import { type IntlString } from '@hcengineering/platform'
import InviteLink from './components/InviteLink.svelte'
import LoginApp from './components/LoginApp.svelte'
import LoginOtpForm from './components/LoginOtpForm.svelte'
import {
  changePassword,
  fetchWorkspace,
  getInviteLink,
  getPerson,
  selectWorkspace,
  exchangeGuestToken,
  getWorkspaces,
  sendInvite,
  leaveWorkspace,
  resendInvite
} from './utils'

import { type Pages, pages } from '@hcengineering/login'
export { pages, type Pages }
/*!
 * Anticrm Platform™ Login Plugin
 * © 2020, 2021 Anticrm Platform Contributors.
 * © 2021 Hardcore Engineering Inc. All Rights Reserved.
 * Licensed under the Eclipse Public License, Version 2.0
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default async () => ({
  component: {
    LoginApp,
    LoginOtpForm,
    InviteLink
  },
  function: {
    LeaveWorkspace: leaveWorkspace,
    ChangePassword: changePassword,
    SelectWorkspace: selectWorkspace,
    ExchangeGuestToken: exchangeGuestToken,
    FetchWorkspace: fetchWorkspace,
    GetPerson: getPerson,
    GetWorkspaces: getWorkspaces,
    SendInvite: sendInvite,
    ResendInvite: resendInvite,
    GetInviteLink: getInviteLink
  }
})

export enum OtpLoginSteps {
  Email = 'email',
  Otp = 'otp'
}

export enum LoginMethods {
  Password = 'password',
  Otp = 'otp'
}

export interface BottomAction {
  i18n: IntlString
  page?: Pages
  func: () => void
  caption?: IntlString
}

export * from './utils'
