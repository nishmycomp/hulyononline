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

import core, { ClassifierKind } from '@hcengineering/core'
import { type Builder } from '@hcengineering/model'
import chat from '@hcengineering/chat'

import card from '@hcengineering/card'
import mail from '@hcengineering/mail'

export { mailId } from '@hcengineering/mail'

export function createModel (builder: Builder): void {
  // Create mail tags for Thread and Channel master tags
  builder.createDoc(
    card.class.Tag,
    core.space.Model,
    {
      extends: chat.masterTag.Thread,
      label: mail.string.MailTag,
      kind: ClassifierKind.MIXIN,
      icon: mail.icon.Mail
    },
    mail.tag.MailThread
  )
  builder.createDoc(
    card.class.Tag,
    core.space.Model,
    {
      extends: chat.masterTag.Channel,
      label: mail.string.MailTag,
      kind: ClassifierKind.MIXIN,
      icon: mail.icon.Mail
    },
    mail.tag.MailChannel
  )
}
