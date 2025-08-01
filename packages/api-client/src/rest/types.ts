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

import {
  type Account,
  type Class,
  type Doc,
  type DocumentQuery,
  type DomainParams,
  type DomainRequestOptions,
  type DomainResult,
  type FindOptions,
  type FulltextStorage,
  type Hierarchy,
  type ModelDb,
  type OperationDomain,
  type PersonId,
  type PersonUuid,
  type Ref,
  type SocialIdType,
  type Storage,
  type WithLookup
} from '@hcengineering/core'

export interface RestClient extends Storage, FulltextStorage {
  getAccount: () => Promise<Account>

  findOne: <T extends Doc>(
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ) => Promise<WithLookup<T> | undefined>

  getModel: () => Promise<{ hierarchy: Hierarchy, model: ModelDb }>

  domainRequest: <T>(
    domain: OperationDomain,
    params: DomainParams,
    options?: DomainRequestOptions
  ) => Promise<DomainResult<T>>

  ensurePerson: (
    socialType: SocialIdType,
    socialValue: string,
    firstName: string,
    lastName: string
  ) => Promise<{ uuid: PersonUuid, socialId: PersonId, localPerson: string }>
}
