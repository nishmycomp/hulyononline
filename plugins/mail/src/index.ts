//
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
//

import type { Ref } from '@hcengineering/core'
import { Asset, IntlString, type Plugin, plugin } from '@hcengineering/platform'
import type { Tag } from '@hcengineering/card'

/**
 * @public
 */
export const mailId = 'mail' as Plugin

export default plugin(mailId, {
  tag: {
    MailChannel: '' as Ref<Tag>,
    MailThread: '' as Ref<Tag>
  },
  string: {
    MailTag: '' as IntlString
  },
  icon: {
    Mail: '' as Asset
  }
})
