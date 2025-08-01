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
/* eslint-disable @typescript-eslint/no-unused-vars */
import core, {
  type AttachedDoc,
  type Class,
  DOMAIN_TX,
  type Doc,
  type DocumentQuery,
  type FindOptions,
  type FindResult,
  type LookupData,
  type MeasureContext,
  type PersonUuid,
  type Ref,
  type Tx,
  type TxCUD,
  TxProcessor,
  systemAccountUuid,
  type SessionData,
  type AccountUuid
} from '@hcengineering/core'
import platform, { PlatformError, Severity, Status } from '@hcengineering/platform'
import {
  BaseMiddleware,
  type Middleware,
  type TxMiddlewareResult,
  type PipelineContext
} from '@hcengineering/server-core'
import { DOMAIN_PREFERENCE } from '@hcengineering/server-preference'

/**
 * @public
 */
export class PrivateMiddleware extends BaseMiddleware implements Middleware {
  private readonly targetDomains = [DOMAIN_PREFERENCE]

  private constructor (context: PipelineContext, next?: Middleware) {
    super(context, next)
  }

  static async create (
    ctx: MeasureContext,
    context: PipelineContext,
    next: Middleware | undefined
  ): Promise<PrivateMiddleware> {
    return new PrivateMiddleware(context, next)
  }

  isTargetDomain (tx: Tx): boolean {
    if (TxProcessor.isExtendsCUD(tx._class)) {
      const txCUD = tx as TxCUD<Doc>
      const domain = this.context.hierarchy.getDomain(txCUD.objectClass)
      return this.targetDomains.includes(domain)
    }
    return false
  }

  tx (ctx: MeasureContext<SessionData>, txes: Tx[]): Promise<TxMiddlewareResult> {
    for (const tx of txes) {
      if (this.isTargetDomain(tx)) {
        const account = ctx.contextData.account
        if (!account.socialIds.includes(tx.modifiedBy) && account.uuid !== systemAccountUuid) {
          throw new PlatformError(new Status(Severity.ERROR, platform.status.Forbidden, {}))
        }
        const modifiedByAccount = ctx.contextData.socialStringsToUsers.get(tx.modifiedBy)?.accontUuid
        const target = [account.uuid, systemAccountUuid]
        if (modifiedByAccount !== undefined && !target.includes(modifiedByAccount)) {
          target.push(modifiedByAccount)
        }
        ctx.contextData.broadcast.targets['checkDomain' + account.uuid] = async (tx) => {
          if (this.isTargetDomain(tx)) {
            return {
              target
            }
          }
        }
      }
    }
    return this.provideTx(ctx, txes)
  }

  override async findAll<T extends Doc>(
    ctx: MeasureContext<SessionData>,
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    let newQuery = query
    const domain = this.context.hierarchy.getDomain(_class)
    if (this.targetDomains.includes(domain)) {
      const account = ctx.contextData.account
      const socialStrings = account.socialIds
      if (account.uuid !== systemAccountUuid) {
        newQuery = {
          ...query,
          createdBy: { $in: socialStrings }
        }
      }
    }
    const findResult = await this.provideFindAll(ctx, _class, newQuery, options)
    if (domain === DOMAIN_TX) {
      const account = ctx.contextData.account
      const socialStrings = account.socialIds
      if (account.uuid !== systemAccountUuid) {
        const targetClasses = new Set(
          this.context.hierarchy.getDescendants(core.class.Doc).filter((p) => {
            const domain = this.context.hierarchy.findDomain(p)
            return domain != null && this.targetDomains.includes(domain)
          })
        )
        ;(findResult as FindResult<Doc> as FindResult<Tx>).filter(
          (p) =>
            !TxProcessor.isExtendsCUD(p._class) ||
            !targetClasses.has((p as TxCUD<Doc>).objectClass) ||
            (p.createdBy !== undefined && socialStrings.includes(p.createdBy))
        )
      }
    }
    if (options?.lookup !== undefined) {
      for (const object of findResult) {
        if (object.$lookup !== undefined) {
          this.filterLookup(ctx, object.$lookup)
        }
      }
    }
    return findResult
  }

  isAvailable (ctx: MeasureContext<SessionData>, doc: Doc): boolean {
    const domain = this.context.hierarchy.getDomain(doc._class)
    if (!this.targetDomains.includes(domain)) return true
    const account = ctx.contextData.account
    const socialStrings = account.socialIds
    return (doc.createdBy !== undefined && socialStrings.includes(doc.createdBy)) || account.uuid === systemAccountUuid
  }

  filterLookup<T extends Doc>(ctx: MeasureContext, lookup: LookupData<T>): void {
    for (const key in lookup) {
      const val = lookup[key]
      if (Array.isArray(val)) {
        const arr: AttachedDoc[] = []
        for (const value of val) {
          if (this.isAvailable(ctx, value)) {
            arr.push(value)
          }
        }
        lookup[key] = arr as any
      } else if (val !== undefined) {
        if (!this.isAvailable(ctx, val)) {
          lookup[key] = undefined
        }
      }
    }
  }
}
