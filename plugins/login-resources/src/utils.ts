//
// Copyright © 2022 Hardcore Engineering Inc.
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

import type {
  AccountClient,
  LoginInfo,
  OtpInfo,
  RegionInfo,
  WorkspaceLoginInfo,
  WorkspaceInviteInfo,
  ProviderInfo
} from '@hcengineering/account-client'
import { getClient as getAccountClientRaw } from '@hcengineering/account-client'
import { Analytics } from '@hcengineering/analytics'
import {
  AccountRole,
  concatLink,
  type AccountUuid,
  type Person,
  type WorkspaceInfoWithStatus,
  type WorkspaceUserOperation
} from '@hcengineering/core'
import { loginId } from '@hcengineering/login'
import platform, {
  OK,
  PlatformError,
  Severity,
  Status,
  getMetadata,
  setMetadata,
  translate,
  unknownError,
  unknownStatus
} from '@hcengineering/platform'
import presentation from '@hcengineering/presentation'
import {
  getCurrentLocation,
  isSameSegments,
  locationStorageKeyId,
  locationToUrl,
  navigate,
  setMetadataLocalStorage,
  type Location
} from '@hcengineering/ui'
import { logIn, workbenchId } from '@hcengineering/workbench'

import { LoginEvents } from './analytics'
import { type Pages } from './index'
import login from './plugin'

/**
 * Constructs an account client.
 * @param token - The token to use for authentication. If not provided, the token from the metadata will be used. If null, no token will be used.
 */
export function getAccountClient (
  token: string | undefined | null = getMetadata(presentation.metadata.Token)
): AccountClient {
  // TODO: make clients cache?
  const accountsUrl = getMetadata(login.metadata.AccountsUrl)

  return getAccountClientRaw(accountsUrl, token !== null ? token : undefined)
}

/**
 * Perform a login operation to required workspace with user credentials.
 */
export async function doLogin (email: string, password: string): Promise<[Status, LoginInfo | null]> {
  try {
    const accountClient = getAccountClient(null)

    const loginInfo = await accountClient.login(email, password)

    Analytics.handleEvent(LoginEvents.LoginPassword, { email, ok: true })

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent(LoginEvents.LoginPassword, { email, ok: false })
      await handleStatusError('Login error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent(LoginEvents.LoginPassword, { email, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function doLoginAsGuest (): Promise<[Status, LoginInfo | null]> {
  try {
    Analytics.handleEvent(LoginEvents.LoginGuestStarted)
    const accountClient = getAccountClient(null)

    const loginInfo = await accountClient.loginAsGuest()

    Analytics.handleEvent(LoginEvents.LoginGuestCompleted)

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent(LoginEvents.LoginGuestError)
      await handleStatusError('Login error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent(LoginEvents.LoginGuestError)
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function signUp (
  email: string,
  password: string,
  first: string,
  last: string
): Promise<[Status, LoginInfo | null]> {
  try {
    const otpInfo = await getAccountClient(null).signUp(email, password, first, last)

    Analytics.handleEvent(LoginEvents.SignUpEmail, { email, ok: true })

    return [OK, otpInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent(LoginEvents.SignUpEmail, { email, ok: false })
      await handleStatusError('Sign up error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent(LoginEvents.SignUpEmail, { email, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function signUpOtp (email: string, first: string, last: string): Promise<[Status, OtpInfo | null]> {
  try {
    const otpInfo = await getAccountClient(null).signUpOtp(email, first, last)

    Analytics.handleEvent('signUpOtp', { email, ok: true })

    return [OK, otpInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Sign up error', err.status)

      return [err.status, null]
    } else {
      return [unknownError(err), null]
    }
  }
}

export async function createWorkspace (
  workspaceName: string,
  region?: string
): Promise<[Status, WorkspaceLoginInfo | null]> {
  const token = getMetadata(presentation.metadata.Token)
  if (token == null) {
    const loc = getCurrentLocation()
    loc.path[1] = 'login'
    loc.path.length = 2
    navigate(loc)

    return [unknownStatus('Please login'), null]
  }

  try {
    const workspaceLoginInfo = await getAccountClient(token).createWorkspace(workspaceName, region)

    Analytics.handleEvent(LoginEvents.CreateWorkspace, { name: workspaceName, ok: true })

    return [OK, workspaceLoginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent(LoginEvents.CreateWorkspace, { name: workspaceName, ok: false })
      await handleStatusError('Create workspace error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent(LoginEvents.CreateWorkspace, { name: workspaceName, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

function getLastVisitDays (it: Pick<WorkspaceInfoWithStatus, 'lastVisit'>): number {
  return Math.floor((Date.now() - (it.lastVisit ?? 0)) / (1000 * 3600 * 24))
}

function getWorkspaceSize (it: Pick<WorkspaceInfoWithStatus, 'backupInfo'>): number {
  let sz = 0
  sz += it.backupInfo?.dataSize ?? 0
  sz += it.backupInfo?.blobsSize ?? 0
  sz += it.backupInfo?.backupSize ?? 0
  return sz
}

export async function getWorkspaces (): Promise<WorkspaceInfoWithStatus[]> {
  const token = getMetadata(presentation.metadata.Token)
  if (token == null) {
    const loc = getCurrentLocation()
    loc.path[1] = 'login'
    loc.path.length = 2
    navigate(loc)
    return []
  }

  let workspaces: WorkspaceInfoWithStatus[]

  try {
    workspaces = await getAccountClient(token).getUserWorkspaces()
  } catch (err: any) {
    workspaces = []
  }

  workspaces.sort((a, b) => {
    const adays = getLastVisitDays(a)
    const bdays = getLastVisitDays(b)

    if (adays === bdays) {
      return getWorkspaceSize(b) - getWorkspaceSize(a)
    }
    return adays - bdays
  })

  return workspaces
}

export async function performWorkspaceOperation (
  workspace: string | string[],
  operation: WorkspaceUserOperation,
  ...params: any[]
): Promise<boolean> {
  const token = getMetadata(presentation.metadata.Token)
  if (token === undefined) {
    const loc = getCurrentLocation()
    loc.path[1] = 'login'
    loc.path.length = 2
    navigate(loc)
    return true
  }

  try {
    return (await getAccountClient(token).performWorkspaceOperation(workspace, operation, ...params)) ?? false
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Perform workspace operation error', err.status)
      throw err
    } else {
      Analytics.handleError(err)
      return false
    }
  }
}

export async function getAllWorkspaces (): Promise<WorkspaceInfoWithStatus[]> {
  const token = getMetadata(presentation.metadata.Token)
  if (token === undefined) {
    const loc = getCurrentLocation()
    loc.path[1] = 'login'
    loc.path.length = 2
    navigate(loc)
    return []
  }

  let workspaces: WorkspaceInfoWithStatus[]

  try {
    workspaces = await getAccountClient(token).listWorkspaces()
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Get workspaces error', err.status)
    } else {
      Analytics.handleError(err)
    }
    workspaces = []
  }

  workspaces.sort((a, b) => {
    const adays = getLastVisitDays(a)
    const bdays = getLastVisitDays(b)
    if (adays === bdays) {
      return getWorkspaceSize(b) - getWorkspaceSize(a)
    }
    return adays - bdays
  })

  return workspaces
}

export async function isReadOnlyGuestAccount (loginInfo: LoginInfo | null): Promise<boolean> {
  if (loginInfo === null) return true
  return await getAccountClient(loginInfo.token).isReadOnlyGuest()
}

export async function getAccount (doNavigate: boolean = true): Promise<LoginInfo | null> {
  const token = getMetadata(presentation.metadata.Token)
  if (token == null) {
    if (doNavigate) {
      const loc = getCurrentLocation()
      loc.path[1] = 'login'
      loc.path.length = 2
      navigate(loc)
    }
  }

  try {
    // even if "token" is null here it still might be supplied from the cookie
    return await getAccountClient(token).getLoginInfoByToken()
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Get account error', err.status)

      if (err.status.code === platform.status.Unauthorized) {
        setMetadata(presentation.metadata.Token, null)
        setMetadataLocalStorage(login.metadata.LoginEndpoint, null)

        if (doNavigate) {
          const loc = getCurrentLocation()
          loc.path[1] = 'login'
          loc.path.length = 2
          navigate(loc)
        }
        return null
      }

      return null
    } else {
      Analytics.handleError(err)

      return null
    }
  }
}

export async function getRegionInfo (doNavigate: boolean = true): Promise<RegionInfo[] | null> {
  const token = getMetadata(presentation.metadata.Token)
  if (token == null) {
    if (doNavigate) {
      const loc = getCurrentLocation()
      loc.path[1] = 'login'
      loc.path.length = 2
      navigate(loc)
    }
    return null
  }

  try {
    return await getAccountClient(token).getRegionInfo()
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Get region info error', err.status)

      return null
    } else {
      Analytics.handleError(err)

      return null
    }
  }
}

export async function selectWorkspace (
  workspaceUrl: string,
  token?: string | null | undefined
): Promise<[Status, WorkspaceLoginInfo | null]> {
  const actualToken = token ?? getMetadata(presentation.metadata.Token) ?? undefined

  try {
    const loginInfo = await getAccountClient(actualToken).selectWorkspace(workspaceUrl)

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError && err.status.code === platform.status.Unauthorized) {
      const loc = getCurrentLocation()
      loc.path[0] = 'login'
      loc.path[1] = 'login'
      loc.path.length = 2
      navigate(loc)
      return [unknownStatus('Please login'), null]
    } else if (err instanceof PlatformError) {
      Analytics.handleEvent(LoginEvents.SelectWorkspace, { name: workspaceUrl, ok: false })
      await handleStatusError('Select workspace error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent(LoginEvents.SelectWorkspace, { name: workspaceUrl, ok: false })
      Analytics.handleError(err)
      return [unknownError(err), null]
    }
  }
}

export async function exchangeGuestToken (token: string): Promise<string> {
  return await getAccountClient(token).exchangeGuestToken(token)
}

export async function fetchWorkspace (): Promise<[Status, WorkspaceInfoWithStatus | null]> {
  const token = getMetadata(presentation.metadata.Token)
  if (token === undefined) {
    return [unknownStatus('Please login'), null]
  }

  try {
    const workspaceWithStatus = await getAccountClient(token).getWorkspaceInfo(true)

    Analytics.handleEvent('Fetch workspace')
    // Analytics.setWorkspace(workspaceWithStatus.url)

    return [OK, workspaceWithStatus]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Fetch workspace error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function unArchive (workspaceId: string, token: string): Promise<boolean> {
  try {
    return await getAccountClient(token).performWorkspaceOperation(workspaceId, 'unarchive')
  } catch (err: any) {
    Analytics.handleError(err)
    return false
  }
}

export async function getPerson (): Promise<[Status, Person | null]> {
  const token = getMetadata(presentation.metadata.Token)
  if (token === undefined) {
    return [unknownStatus('Please login'), null]
  }

  try {
    const person = await getAccountClient(token).getPerson()

    return [OK, person]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Get person error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export function setLoginInfo (loginInfo: WorkspaceLoginInfo): void {
  setMetadata(presentation.metadata.Token, loginInfo.token)
  setMetadata(presentation.metadata.WorkspaceUuid, loginInfo.workspace)
  setMetadata(presentation.metadata.WorkspaceDataId, loginInfo.workspaceDataId)
  setMetadataLocalStorage(login.metadata.LoginEndpoint, loginInfo.endpoint)
  setMetadataLocalStorage(login.metadata.LoginAccount, loginInfo.account)
  setMetadataLocalStorage(login.metadata.LastAccount, loginInfo.account)
}

export function navigateToWorkspace (
  workspaceUrl: string,
  loginInfo: WorkspaceLoginInfo | null,
  navigateUrl?: string | null,
  replace = false
): void {
  if (loginInfo == null) {
    return
  }

  setLoginInfo(loginInfo)
  Analytics.handleEvent(LoginEvents.SelectWorkspace, {
    workspace: workspaceUrl,
    workspace_uuid: loginInfo.workspace
  })

  if (navigateUrl != null) {
    try {
      const loc = JSON.parse(decodeURIComponent(navigateUrl)) as Location
      if (loc.path[1] === workspaceUrl) {
        navigate(loc, replace)
        return
      }
    } catch (err: any) {
      // Json parse error could be ignored
    }
  }
  const newLoc: Location = { path: [workbenchId, workspaceUrl] }
  let last: Location | undefined
  try {
    last = JSON.parse(localStorage.getItem(`${locationStorageKeyId}_${workspaceUrl}`) ?? '')
  } catch (err: any) {
    // Ignore
  }
  if (last != null && isSameSegments(last, newLoc, 2)) {
    // If last location in our workspace path, use it.
    navigate(last, replace)
  } else {
    navigate(newLoc, replace)
  }
}

export async function checkJoined (inviteId: string): Promise<WorkspaceLoginInfo | undefined> {
  const token = getMetadata(presentation.metadata.Token)

  if (token == null) return

  try {
    const workspaceLoginInfo = await getAccountClient(token).checkJoin(inviteId)

    return workspaceLoginInfo
  } catch (err: any) {
    if (!(err instanceof PlatformError)) {
      Analytics.handleError(err)
    }
  }
}

export async function checkAutoJoin (
  inviteId: string,
  firstName?: string,
  lastName?: string
): Promise<[Status, WorkspaceInviteInfo | WorkspaceLoginInfo | null]> {
  const token = getMetadata(presentation.metadata.Token)

  try {
    const autoJoinResult = await getAccountClient(token).checkAutoJoin(inviteId, firstName, lastName)

    return [OK, autoJoinResult]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      return [err.status, null]
    } else {
      Analytics.handleError(err)
      return [unknownError(err), null]
    }
  }
}

export async function getInviteLink (
  expHours: number,
  mask: string,
  limit: number | undefined,
  role: AccountRole,
  navigateUrl?: string
): Promise<string> {
  const inviteId = await getInviteLinkId(expHours, mask, limit ?? -1, role)
  const loc = getCurrentLocation()
  loc.path[0] = loginId
  loc.path[1] = 'join'
  loc.path.length = 2
  loc.query = {
    inviteId
  }
  if (navigateUrl !== undefined) {
    loc.query.navigateUrl = navigateUrl
  }
  loc.fragment = undefined

  const url = locationToUrl(loc)

  const frontUrl = getMetadata(presentation.metadata.FrontUrl)
  const host = frontUrl ?? document.location.origin
  return concatLink(host, url)
}

export async function getInviteLinkId (
  expHours: number,
  emailMask: string,
  limit: number,
  role: AccountRole = AccountRole.User
): Promise<string> {
  const exp = expHours < 0 ? -1 : expHours * 1000 * 60 * 60
  const token = getMetadata(presentation.metadata.Token)

  if (token === undefined) {
    const loc = getCurrentLocation()
    loc.path[1] = 'login'
    loc.path.length = 2
    navigate(loc)

    return ''
  }

  const inviteLink = await getAccountClient(token).createInvite(exp, emailMask, limit, role)

  Analytics.handleEvent('Get invite link', { invite_id: inviteLink })

  return inviteLink
}

export async function join (
  email: string,
  password: string,
  inviteId: string,
  workspace: string
): Promise<[Status, WorkspaceLoginInfo | null]> {
  try {
    const workspaceLoginInfo = await getAccountClient().join(email, password, inviteId, workspace)

    Analytics.handleEvent('Join', { email, ok: true })

    return [OK, workspaceLoginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent('Join', { email, ok: false })
      await handleStatusError('Join error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent('Join', { email, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function signUpJoin (
  email: string,
  password: string,
  first: string,
  last: string,
  inviteId: string,
  workspace: string
): Promise<[Status, WorkspaceLoginInfo | null]> {
  try {
    const workspaceLoginInfo = await getAccountClient().signUpJoin(email, password, first, last, inviteId, workspace)

    Analytics.handleEvent('Signup Join', { email, ok: true })

    return [OK, workspaceLoginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent('Signup Join', { email, ok: false })
      await handleStatusError('Sign up join error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleEvent('Signup Join', { email, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function changePassword (oldPassword: string, password: string): Promise<void> {
  try {
    await getAccountClient().changePassword(oldPassword, password)
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Change password error', err.status)
    } else {
      Analytics.handleError(err)
    }
    throw err
  }
}

export async function changeUsername (first: string, last: string): Promise<void> {
  try {
    await getAccountClient().changeUsername(first, last)
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Change username error', err.status)
    } else {
      Analytics.handleError(err)
    }
    throw err
  }
}

export async function leaveWorkspace (account: AccountUuid): Promise<LoginInfo | null> {
  return await getAccountClient().leaveWorkspace(account)
}

export async function sendInvite (email: string, role: AccountRole): Promise<void> {
  try {
    await getAccountClient().sendInvite(email, role)
  } catch (e) {
    console.log('Failed to send invite', email, role)
    console.error(e)
  }
}

export async function resendInvite (email: string, role: AccountRole): Promise<void> {
  try {
    await getAccountClient().resendInvite(email, role)
  } catch (e) {
    console.log('Failed to resend invite', email, role)
    console.error(e)
  }
}

export async function requestPassword (email: string): Promise<Status> {
  try {
    await getAccountClient(null).requestPasswordReset(email)

    return OK
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Request password error', err.status)

      return err.status
    } else {
      Analytics.handleError(err)

      return unknownError(err)
    }
  }
}

export async function confirm (confirmationToken: string): Promise<[Status, LoginInfo | null]> {
  try {
    const loginInfo = await getAccountClient(confirmationToken).confirm()

    Analytics.handleEvent('Confirm email')

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Confirm email error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function restorePassword (token: string, password: string): Promise<[Status, LoginInfo | null]> {
  try {
    const loginInfo = await getAccountClient(token).restorePassword(password)

    Analytics.handleEvent('Restore password')

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      await handleStatusError('Restore password error', err.status)

      return [err.status, null]
    } else {
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

async function handleStatusError (message: string, err: Status): Promise<void> {
  if (
    err.code === platform.status.InvalidPassword ||
    err.code === platform.status.AccountNotFound ||
    err.code === platform.status.InvalidOtp
  ) {
    // No need to send to analytics
    return
  }
  const label = await translate(err.code, err.params, 'en')
  Analytics.handleError(new Error(`${message}: ${label}`))
}

export function getLoc (path: Pages): Location {
  const loc = getCurrentLocation()
  loc.path[1] = path
  loc.path.length = 2
  return loc
}

export function goTo (path: Pages, clearQuery: boolean = false): void {
  const loc = getLoc(path)
  if (clearQuery) {
    loc.query = undefined
  }
  navigate(loc, clearQuery)
}

export function getHref (path: Pages): string {
  const url = locationToUrl(getLoc(path))
  const frontUrl = getMetadata(presentation.metadata.FrontUrl)
  const host = frontUrl ?? document.location.origin
  return host + url
}

export async function afterConfirm (clearQuery = false): Promise<void> {
  const joinedWS = await getWorkspaces()
  if (joinedWS.length === 0) {
    goTo('createWorkspace', clearQuery)
  } else if (joinedWS.length === 1) {
    const result = (await selectWorkspace(joinedWS[0].url, null))[1]
    if (result != null) {
      setMetadata(presentation.metadata.Token, result.token)
      setMetadata(presentation.metadata.WorkspaceUuid, result.workspace)
      setMetadata(presentation.metadata.WorkspaceDataId, result.workspaceDataId)

      setLoginInfo(result)

      navigateToWorkspace(joinedWS[0].url, result, undefined, clearQuery)
    }
  } else {
    goTo('selectWorkspace', clearQuery)
  }
}

export async function getLoginInfo (): Promise<LoginInfo | WorkspaceLoginInfo | null> {
  try {
    return await getAccountClient().getLoginInfoByToken()
  } catch (err: any) {
    if (err instanceof PlatformError) {
      if (err.status.code === platform.status.Unauthorized) {
        return null
      }
    } else {
      Analytics.handleError(err)
    }

    throw err
  }
}

export function getAutoJoinInfo (): any {
  const query = getCurrentLocation().query

  if (query == null) {
    return null
  }

  const { token, autoJoin, inviteId, navigateUrl } = query

  if (token == null || autoJoin === undefined || inviteId == null) {
    return null
  }

  return { token, autoJoin, inviteId, navigateUrl }
}

export async function getLoginInfoFromQuery (): Promise<LoginInfo | WorkspaceLoginInfo | null> {
  const token = getCurrentLocation().query?.token

  if (token == null) {
    return null
  }

  try {
    return await getAccountClient(token).getLoginInfoByToken()
  } catch (err: any) {
    if (!(err instanceof PlatformError)) {
      Analytics.handleError(err)
    }

    throw err
  }
}

export async function getProviders (): Promise<ProviderInfo[]> {
  let providers: ProviderInfo[]

  try {
    providers = await getAccountClient(null).getProviders()
  } catch (err: any) {
    providers = []
  }

  return providers
}

export async function loginOtp (email: string): Promise<[Status, OtpInfo | null]> {
  try {
    const otpInfo = await getAccountClient(null).loginOtp(email)

    Analytics.handleEvent('sendOtp', { email, ok: true })

    return [OK, otpInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent('sendOtp', { email, ok: false })
      await handleStatusError('Send otp error', err.status)

      return [err.status, null]
    } else {
      console.error('Send otp error', err)
      Analytics.handleEvent('sendOtp', { email, ok: false })
      Analytics.handleError(err)

      return [unknownError(err), null]
    }
  }
}

export async function doValidateOtp (
  isSignUp: boolean,
  email: string,
  code: string,
  password?: string
): Promise<[Status, LoginInfo | null]> {
  const telemetryEvent = isSignUp ? LoginEvents.SignUpOtp : LoginEvents.LoginOtp
  try {
    const loginInfo = await getAccountClient(null).validateOtp(email, code, password)

    Analytics.handleEvent(telemetryEvent, { email, ok: true })

    return [OK, loginInfo]
  } catch (err: any) {
    if (err instanceof PlatformError) {
      Analytics.handleEvent(telemetryEvent, { email, ok: false })
      await handleStatusError('Login with otp error', err.status)

      return [err.status, null]
    } else {
      console.error('Login with otp error', err)
      Analytics.handleEvent(telemetryEvent, { email, ok: false })
      Analytics.handleError(err)
      return [unknownError(err), null]
    }
  }
}

export async function doLoginNavigate (
  result: LoginInfo | null,
  updateStatus: (status: Status) => void,
  navigateUrl?: string
): Promise<void> {
  if (result != null) {
    if (result.token != null) {
      await logIn(result)
    }

    if (navigateUrl !== undefined) {
      try {
        const loc = JSON.parse(decodeURIComponent(navigateUrl)) as Location
        const workspaceUrl = loc.path[1]

        if (workspaceUrl !== undefined) {
          const workspaces = await getWorkspaces()

          if (workspaces.find((p) => p.url === workspaceUrl) !== undefined) {
            updateStatus(new Status(Severity.INFO, login.status.ConnectingToServer, {}))

            const [loginStatus, selectResult] = await selectWorkspace(workspaceUrl)
            updateStatus(loginStatus)
            navigateToWorkspace(workspaceUrl, selectResult, navigateUrl)
            return
          }
        }
      } catch (err: any) {
        // Json parse error could be ignored
      }
    }

    const loc = getCurrentLocation()
    loc.path[1] = result.token != null ? 'selectWorkspace' : 'confirmationSend'
    loc.path.length = 2
    if (navigateUrl !== undefined) {
      loc.query = { ...loc.query, navigateUrl }
    }

    navigate(loc)
  }
}

export function isWorkspaceLoginInfo (
  info: WorkspaceLoginInfo | LoginInfo | WorkspaceInviteInfo | null
): info is WorkspaceLoginInfo {
  return (info as any)?.workspace !== undefined && (info as any)?.token !== undefined
}

export function getAccountDisplayName (loginInfo: LoginInfo | null | undefined): string {
  if (loginInfo == null) {
    return ''
  }

  if (loginInfo.name != null) {
    return loginInfo.name
  }

  return loginInfo.account
}
