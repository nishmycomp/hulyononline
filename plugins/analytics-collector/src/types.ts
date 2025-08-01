//
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
//

import { Channel } from '@hcengineering/chunter'
import type { AccountUuid, WorkspaceUuid } from '@hcengineering/core'

export enum AnalyticEventType {
  SetUser = 'setUser',
  SetAlias = 'setAlias',
  SetTag = 'setTag',
  SetGroup = 'setGroup',
  Navigation = 'navigation',
  Error = 'error',
  CustomEvent = 'customEvent'
}

export interface AnalyticEvent {
  event: AnalyticEventType
  properties: Record<string, any>
  timestamp: number
  distinct_id: string
}

export interface OnboardingChannel extends Channel {
  workspaceId: WorkspaceUuid
  workspaceName: string
  workspaceUrl: string
  account: AccountUuid
  userName: string
  disableAIReplies: boolean
  showAIReplies: boolean
}
