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

import hr from '@hcengineering/hr'
import { loadMetadata } from '@hcengineering/platform'

const icons = require('../assets/icons.svg') as string // eslint-disable-line
loadMetadata(hr.icon, {
  HR: `${icons}#hr`,
  Department: `${icons}#department`,
  Structure: `${icons}#structure`,
  Members: `${icons}#members`,
  Vacation: `${icons}#vacation`,
  Sick: `${icons}#sick`,
  PTO: `${icons}#pto`,
  PTO2: `${icons}#pto2`,
  Overtime: `${icons}#overtime`,
  Overtime2: `${icons}#overtime2`,
  Remote: `${icons}#remote`
})
