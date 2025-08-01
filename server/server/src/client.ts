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

import type { LoginInfoWithWorkspaces } from '@hcengineering/account-client'
import {
  generateId,
  TxProcessor,
  type Account,
  type AccountUuid,
  type Class,
  type Doc,
  type DocumentQuery,
  type Domain,
  type DomainParams,
  type DomainResult,
  type FindOptions,
  type FindResult,
  type LoadModelResponse,
  type MeasureContext,
  type OperationDomain,
  type PersonId,
  type Ref,
  type SearchOptions,
  type SearchQuery,
  type SearchResult,
  type SessionData,
  type SocialId,
  type Timestamp,
  type Tx,
  type TxCUD,
  type TxResult,
  type WorkspaceDataId,
  type WorkspaceIds
} from '@hcengineering/core'
import { PlatformError, unknownError } from '@hcengineering/platform'
import {
  BackupClientOps,
  createBroadcastEvent,
  SessionDataImpl,
  type ClientSessionCtx,
  type ConnectionSocket,
  type Pipeline,
  type Session,
  type SessionRequest,
  type StatisticsElement
} from '@hcengineering/server-core'
import { type Token } from '@hcengineering/server-token'

const useReserveContext = (process.env.USE_RESERVE_CTX ?? 'true') === 'true'

/**
 * @public
 */
export class ClientSession implements Session {
  createTime = Date.now()
  requests = new Map<string, SessionRequest>()
  binaryMode: boolean = false
  useCompression: boolean = false
  sessionId = ''
  lastRequest = Date.now()

  lastPing: number = Date.now()

  total: StatisticsElement = { find: 0, tx: 0 }
  current: StatisticsElement = { find: 0, tx: 0 }
  mins5: StatisticsElement = { find: 0, tx: 0 }
  measures: { id: string, message: string, time: 0 }[] = []

  ops: BackupClientOps | undefined
  opsPipeline: Pipeline | undefined
  isAdmin: boolean

  constructor (
    readonly token: Token,
    readonly workspace: WorkspaceIds,
    readonly account: Account,
    readonly info: LoginInfoWithWorkspaces,
    readonly allowUpload: boolean
  ) {
    this.isAdmin = this.token.extra?.admin === 'true'
  }

  getUser (): AccountUuid {
    return this.token.account
  }

  getUserSocialIds (): PersonId[] {
    return this.account.socialIds
  }

  getSocialIds (): SocialId[] {
    return this.info.socialIds
  }

  getRawAccount (): Account {
    return this.account
  }

  isUpgradeClient (): boolean {
    return this.token.extra?.model === 'upgrade'
  }

  getMode (): string {
    return this.token.extra?.mode ?? 'normal'
  }

  updateLast (): void {
    this.lastRequest = Date.now()
  }

  async ping (ctx: ClientSessionCtx): Promise<void> {
    this.lastRequest = Date.now()
    ctx.sendPong()
  }

  async loadModel (ctx: ClientSessionCtx, lastModelTx: Timestamp, hash?: string): Promise<void> {
    try {
      this.includeSessionContext(ctx)
      const result = await ctx.ctx.with('load-model', {}, () => ctx.pipeline.loadModel(ctx.ctx, lastModelTx, hash))
      await ctx.sendResponse(ctx.requestId, result)
    } catch (err) {
      await ctx.sendError(ctx.requestId, 'Failed to loadModel', unknownError(err))
      ctx.ctx.error('failed to loadModel', { err })
    }
  }

  async loadModelRaw (ctx: ClientSessionCtx, lastModelTx: Timestamp, hash?: string): Promise<LoadModelResponse | Tx[]> {
    this.includeSessionContext(ctx)
    return await ctx.ctx.with('load-model', {}, (_ctx) => ctx.pipeline.loadModel(_ctx, lastModelTx, hash))
  }

  includeSessionContext (ctx: ClientSessionCtx): void {
    const dataId = this.workspace.dataId ?? (this.workspace.uuid as unknown as WorkspaceDataId)
    const contextData = new SessionDataImpl(
      this.account,
      this.sessionId,
      this.isAdmin,
      undefined,
      {
        ...this.workspace,
        dataId
      },
      false,
      undefined,
      undefined,
      ctx.pipeline.context.modelDb,
      ctx.socialStringsToUsers,
      this.token.extra?.service ?? '🤦‍♂️user'
    )
    ctx.ctx.contextData = contextData
  }

  findAllRaw<T extends Doc>(
    ctx: ClientSessionCtx,
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    this.lastRequest = Date.now()
    this.total.find++
    this.current.find++
    this.includeSessionContext(ctx)
    return ctx.pipeline.findAll(ctx.ctx, _class, query, options)
  }

  async findAll<T extends Doc>(
    ctx: ClientSessionCtx,
    _class: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<void> {
    try {
      await ctx.sendResponse(ctx.requestId, await this.findAllRaw(ctx, _class, query, options))
    } catch (err) {
      await ctx.sendError(ctx.requestId, 'Failed to findAll', unknownError(err))
      ctx.ctx.error('failed to findAll', { err })
    }
  }

  async searchFulltext (ctx: ClientSessionCtx, query: SearchQuery, options: SearchOptions): Promise<void> {
    try {
      this.lastRequest = Date.now()
      this.includeSessionContext(ctx)
      await ctx.sendResponse(ctx.requestId, await ctx.pipeline.searchFulltext(ctx.ctx, query, options))
    } catch (err) {
      await ctx.sendError(ctx.requestId, 'Failed to searchFulltext', unknownError(err))
      ctx.ctx.error('failed to searchFulltext', { err })
    }
  }

  async searchFulltextRaw (ctx: ClientSessionCtx, query: SearchQuery, options: SearchOptions): Promise<SearchResult> {
    this.lastRequest = Date.now()
    this.includeSessionContext(ctx)
    return await ctx.pipeline.searchFulltext(ctx.ctx, query, options)
  }

  async txRaw (
    ctx: ClientSessionCtx,
    tx: Tx
  ): Promise<{
      result: TxResult
      broadcastPromise: Promise<void>
      asyncsPromise: Promise<void> | undefined
    }> {
    this.lastRequest = Date.now()
    this.total.tx++
    this.current.tx++
    this.includeSessionContext(ctx)

    let cid = 'client_' + generateId()
    ctx.ctx.id = cid
    let onEnd = useReserveContext ? ctx.pipeline.context.adapterManager?.reserveContext?.(cid) : undefined
    let result: TxResult
    try {
      result = await ctx.pipeline.tx(ctx.ctx, [tx])
    } finally {
      onEnd?.()
    }
    // Send result immideately
    await ctx.sendResponse(ctx.requestId, result)

    // We need to broadcast all collected transactions
    const broadcastPromise = ctx.pipeline.handleBroadcast(ctx.ctx)

    // ok we could perform async requests if any
    const asyncs = (ctx.ctx.contextData as SessionData).asyncRequests ?? []
    let asyncsPromise: Promise<void> | undefined
    if (asyncs.length > 0) {
      cid = 'client_async_' + generateId()
      ctx.ctx.id = cid
      onEnd = useReserveContext ? ctx.pipeline.context.adapterManager?.reserveContext?.(cid) : undefined
      const handleAyncs = async (): Promise<void> => {
        try {
          for (const r of asyncs) {
            await r(ctx.ctx)
          }
        } finally {
          onEnd?.()
        }
      }
      asyncsPromise = handleAyncs()
    }

    return { result, broadcastPromise, asyncsPromise }
  }

  async tx (ctx: ClientSessionCtx, tx: Tx): Promise<void> {
    try {
      const { broadcastPromise, asyncsPromise } = await this.txRaw(ctx, tx)
      await broadcastPromise
      if (asyncsPromise !== undefined) {
        await asyncsPromise
      }
    } catch (err) {
      await ctx.sendError(ctx.requestId, 'Failed to tx', unknownError(err))
      ctx.ctx.error('failed to tx', { err })
    }
  }

  broadcast (ctx: MeasureContext, socket: ConnectionSocket, tx: Tx[]): void {
    if (this.tx.length > 10000) {
      const classes = new Set<Ref<Class<Doc>>>()
      for (const dtx of tx) {
        if (TxProcessor.isExtendsCUD(dtx._class)) {
          classes.add((dtx as TxCUD<Doc>).objectClass)
          const attachedToClass = (dtx as TxCUD<Doc>).attachedToClass
          if (attachedToClass !== undefined) {
            classes.add(attachedToClass)
          }
        }
      }
      const bevent = createBroadcastEvent(Array.from(classes))
      void socket.send(
        ctx,
        {
          result: [bevent]
        },
        this.binaryMode,
        this.useCompression
      )
    } else {
      void socket.send(ctx, { result: tx }, this.binaryMode, this.useCompression)
    }
  }

  getOps (pipeline: Pipeline): BackupClientOps {
    if (this.ops === undefined || this.opsPipeline !== pipeline) {
      if (pipeline.context.lowLevelStorage === undefined) {
        throw new PlatformError(unknownError('Low level storage is not available'))
      }
      this.ops = new BackupClientOps(pipeline.context.lowLevelStorage)
      this.opsPipeline = pipeline
    }
    return this.ops
  }

  async loadChunk (ctx: ClientSessionCtx, domain: Domain, idx?: number): Promise<void> {
    this.lastRequest = Date.now()
    try {
      const result = await this.getOps(ctx.pipeline).loadChunk(ctx.ctx, domain, idx)
      await ctx.sendResponse(ctx.requestId, result)
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to upload', unknownError(err))
      ctx.ctx.error('failed to loadChunk', { domain, err })
    }
  }

  async getDomainHash (ctx: ClientSessionCtx, domain: Domain): Promise<void> {
    this.lastRequest = Date.now()
    try {
      const result = await this.getOps(ctx.pipeline).getDomainHash(ctx.ctx, domain)
      await ctx.sendResponse(ctx.requestId, result)
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to upload', unknownError(err))
      ctx.ctx.error('failed to getDomainHash', { domain, err })
    }
  }

  async closeChunk (ctx: ClientSessionCtx, idx: number): Promise<void> {
    try {
      this.lastRequest = Date.now()
      await this.getOps(ctx.pipeline).closeChunk(ctx.ctx, idx)
      await ctx.sendResponse(ctx.requestId, {})
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to closeChunk', unknownError(err))
      ctx.ctx.error('failed to closeChunk', { err })
    }
  }

  async loadDocs (ctx: ClientSessionCtx, domain: Domain, docs: Ref<Doc>[]): Promise<void> {
    this.lastRequest = Date.now()
    try {
      const result = await this.getOps(ctx.pipeline).loadDocs(ctx.ctx, domain, docs)
      await ctx.sendResponse(ctx.requestId, result)
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to loadDocs', unknownError(err))
      ctx.ctx.error('failed to loadDocs', { domain, err })
    }
  }

  async upload (ctx: ClientSessionCtx, domain: Domain, docs: Doc[]): Promise<void> {
    if (!this.allowUpload) {
      await ctx.sendResponse(ctx.requestId, { error: 'Upload not allowed' })
    }
    this.lastRequest = Date.now()
    try {
      await this.getOps(ctx.pipeline).upload(ctx.ctx, domain, docs)
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to upload', unknownError(err))
      ctx.ctx.error('failed to loadDocs', { domain, err })
      return
    }
    await ctx.sendResponse(ctx.requestId, {})
  }

  async clean (ctx: ClientSessionCtx, domain: Domain, docs: Ref<Doc>[]): Promise<void> {
    if (!this.allowUpload) {
      await ctx.sendResponse(ctx.requestId, { error: 'Clean not allowed' })
    }
    this.lastRequest = Date.now()
    try {
      await this.getOps(ctx.pipeline).clean(ctx.ctx, domain, docs)
    } catch (err: any) {
      await ctx.sendError(ctx.requestId, 'Failed to clean', unknownError(err))
      ctx.ctx.error('failed to clean', { domain, err })
      return
    }
    await ctx.sendResponse(ctx.requestId, {})
  }

  async domainRequest (ctx: ClientSessionCtx, domain: OperationDomain, params: DomainParams): Promise<void> {
    try {
      const { asyncsPromise, broadcastPromise } = await this.domainRequestRaw(ctx, domain, params)

      await broadcastPromise

      if (asyncsPromise !== undefined) {
        await asyncsPromise
      }
    } catch (err) {
      await ctx.sendError(ctx.requestId, 'Failed to domainRequest', unknownError(err))
      ctx.ctx.error('failed to domainRequest', { err })
    }
  }

  async domainRequestRaw (
    ctx: ClientSessionCtx,
    domain: OperationDomain,
    params: DomainParams
  ): Promise<{
      result: DomainResult
      broadcastPromise: Promise<void>
      asyncsPromise: Promise<void> | undefined
    }> {
    this.lastRequest = Date.now()
    this.total.find++
    this.current.find++
    this.includeSessionContext(ctx)

    const result: DomainResult = await ctx.pipeline.domainRequest(ctx.ctx, domain, params)
    await ctx.sendResponse(ctx.requestId, result)
    // We need to broadcast all collected transactions
    const broadcastPromise = ctx.pipeline.handleBroadcast(ctx.ctx)

    // ok we could perform async requests if any
    const asyncs = (ctx.ctx.contextData as SessionData).asyncRequests ?? []
    let asyncsPromise: Promise<void> | undefined
    if (asyncs.length > 0) {
      const handleAyncs = async (): Promise<void> => {
        // Make sure the broadcast is complete before we start the asyncs
        await broadcastPromise
        ctx.ctx.contextData.broadcast.queue = []
        ctx.ctx.contextData.broadcast.txes = []
        ctx.ctx.contextData.broadcast.sessions = {}
        try {
          for (const r of asyncs) {
            await r(ctx.ctx)
          }
        } catch (err: any) {
          ctx.ctx.error('failed to handleAsyncs', { err })
        }
      }
      asyncsPromise = handleAyncs().then(async () => {
        await ctx.pipeline?.handleBroadcast(ctx.ctx)
      })
    }

    return { result, asyncsPromise, broadcastPromise }
  }
}
