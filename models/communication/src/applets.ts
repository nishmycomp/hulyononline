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

import { type Builder } from '@hcengineering/model'
import core from '@hcengineering/core'

import communication from './plugin'

export function buildApplets (builder: Builder): void {
  builder.createDoc(
    communication.class.Applet,
    core.space.Model,
    {
      type: 'application/vnd.huly.applet.poll',
      label: communication.string.Poll,
      icon: communication.icon.Poll,
      component: communication.poll.PollPresenter,
      createLabel: communication.string.CreatePoll,
      createComponent: communication.poll.CreatePoll,
      previewComponent: communication.poll.PollPreview,
      createFn: communication.poll.CreatePollFn
    },
    communication.ids.PollApplet
  )
}
