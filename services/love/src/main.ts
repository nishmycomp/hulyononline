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
import {
  getClient as getAccountClientRaw,
  isWorkspaceLoginInfo,
  type AccountClient
} from '@hcengineering/account-client'
import { createOpenTelemetryMetricsContext, SplitLogger } from '@hcengineering/analytics-service'
import { MeasureContext, newMetrics, Ref, WorkspaceIds } from '@hcengineering/core'
import { MeetingMinutes, RoomMetadata, TranscriptionStatus } from '@hcengineering/love'
import { setMetadata } from '@hcengineering/platform'
import serverClient from '@hcengineering/server-client'
import { initStatisticsContext, StorageConfig, StorageConfiguration } from '@hcengineering/server-core'
import { storageConfigFromEnv } from '@hcengineering/server-storage'
import serverToken, { decodeToken, Token } from '@hcengineering/server-token'
import cors from 'cors'
import express, { type Request } from 'express'
import { IncomingHttpHeaders } from 'http'
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookReceiver
} from 'livekit-server-sdk'
import { join } from 'path'
import { saveLiveKitEgressBilling, updateLiveKitSessions } from './billing'
import config from './config'
import { getRecordingPreset } from './preset'
import { getS3UploadParams, saveFile } from './storage'
import { WorkspaceClient } from './workspaceClient'

const extractToken = (header: IncomingHttpHeaders): any => {
  try {
    return header.authorization?.slice(7) ?? ''
  } catch {
    return undefined
  }
}

function getAccountClient (token?: string): AccountClient {
  return getAccountClientRaw(config.AccountsURL, token)
}

export const main = async (): Promise<void> => {
  setMetadata(serverClient.metadata.Endpoint, config.AccountsURL)
  setMetadata(serverClient.metadata.UserAgent, config.ServiceID)
  setMetadata(serverToken.metadata.Secret, config.Secret)
  setMetadata(serverToken.metadata.Service, 'love')

  const storageConfigs: StorageConfiguration = storageConfigFromEnv()
  const s3StorageConfigs: StorageConfiguration | undefined =
    config.S3StorageConfig !== undefined ? storageConfigFromEnv(config.S3StorageConfig) : undefined

  const ctx = initStatisticsContext('love', {
    factory: () =>
      createOpenTelemetryMetricsContext(
        'love',
        {},
        {},
        newMetrics(),
        new SplitLogger('love', {
          root: join(process.cwd(), 'logs'),
          enableConsole: (process.env.ENABLE_CONSOLE ?? 'true') === 'true'
        })
      )
  })

  const storageConfig = storageConfigs.storages.findLast((p) => p.name === config.StorageProviderName)
  const s3storageConfig = s3StorageConfigs?.storages.findLast((p) => p.kind === 's3')

  const app = express()
  const port = config.Port
  app.use(cors())
  app.use(express.raw({ type: 'application/webhook+json' }))
  app.use(express.json())

  const receiver = new WebhookReceiver(config.ApiKey, config.ApiSecret)
  const roomClient = new RoomServiceClient(config.LiveKitHost, config.ApiKey, config.ApiSecret)
  const egressClient = new EgressClient(config.LiveKitHost, config.ApiKey, config.ApiSecret)
  const dataByUUID = new Map<
  string,
  {
    name: string
    wsIds: WorkspaceIds
    meetingMinutes?: Ref<MeetingMinutes>
  }
  >()

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/webhook', async (req, res) => {
    try {
      const event = await receiver.receive(req.body, req.get('Authorization'))
      if (event.event === 'egress_ended' && event.egressInfo !== undefined) {
        for (const res of event.egressInfo.fileResults) {
          ctx.info('webhook event', { event: event.event, egress: event.egressInfo })

          const data = dataByUUID.get(res.filename)
          if (data !== undefined && storageConfig !== undefined) {
            const storedBlob = await saveFile(ctx, data.wsIds, storageConfig, s3storageConfig, res.filename)
            if (storedBlob !== undefined) {
              const preset = getRecordingPreset(config.RecordingPreset)
              const client = await WorkspaceClient.create(data.wsIds.uuid, ctx)
              await client.saveFile(storedBlob._id, data.name, storedBlob, preset, data.meetingMinutes)
              await client.close()
            }
            dataByUUID.delete(res.filename)
          } else {
            console.log('no data found for', res.filename)
          }
        }

        try {
          await saveLiveKitEgressBilling(ctx, event.egressInfo)
        } catch {
          // Ensure we don't fail the webhook if billing fails
        }

        res.send()
        return
      } else if (event.event === 'room_started' && event.room !== undefined) {
        const { sid, name } = event.room
        ctx.info('webhook event', { event: event.event, room: { sid, name } })
      } else if (event.event === 'room_finished' && event.room !== undefined) {
        const { sid, name } = event.room
        ctx.info('webhook event', { event: event.event, room: { sid, name } })
        res.send()
        return
      }
      res.status(400).send()
    } catch (e) {
      console.error(e)
      res.status(500).send()
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/getToken', async (req, res) => {
    const roomName = req.body.roomName
    const _id = req.body._id
    const participantName = req.body.participantName

    if (typeof roomName !== 'string') {
      res.status(400).send()
      return
    }
    if (!hasWorkspaceAccess(roomName, req)) {
      res.status(401).send()
      return
    }
    res.send(await createToken(roomName, _id, participantName))
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get('/checkRecordAvailable', async (_req, res) => {
    res.send(await checkRecordAvailable(storageConfig, s3storageConfig))
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/startRecord', async (req, res) => {
    const roomName = req.body.roomName
    const room = req.body.room
    const meetingMinutes = req.body.meetingMinutes

    if (typeof roomName !== 'string') {
      res.status(400).send()
      return
    }
    if (!hasWorkspaceAccess(roomName, req)) {
      res.status(401).send()
      return
    }

    try {
      const token = extractToken(req.headers)
      const wsLoginInfo = await getAccountClient(token).getLoginInfoByToken()
      if (!isWorkspaceLoginInfo(wsLoginInfo)) {
        console.error('No workspace found for the token')
        res.status(401).send()
        return
      }
      const dateStr = new Date().toISOString().replace('T', '_').slice(0, 19)
      const name = `${room}_${dateStr}.mp4`
      const wsIds = { uuid: wsLoginInfo.workspace, dataId: wsLoginInfo.workspaceDataId, url: wsLoginInfo.workspaceUrl }
      const id = await startRecord(ctx, storageConfig, s3storageConfig, egressClient, roomClient, roomName, wsIds)
      dataByUUID.set(id, { name, wsIds, meetingMinutes })
      ctx.info('Start recording', { workspace: wsLoginInfo.workspace, roomName, meetingMinutes })
      res.send()
    } catch (e) {
      console.error(e)
      res.status(500).send()
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/stopRecord', async (req, res) => {
    const roomName = req.body.roomName
    if (typeof roomName !== 'string') {
      res.status(400).send()
      return
    }
    if (!hasWorkspaceAccess(roomName, req)) {
      res.status(401).send()
      return
    }

    await updateMetadata(roomClient, roomName, { recording: false })
    void stopEgress(egressClient, roomName)
    res.send()
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/transcription', async (req, res) => {
    const roomName = req.body.roomName
    const language = req.body.language
    const transcription = req.body.transcription as TranscriptionStatus

    if (typeof roomName !== 'string') {
      res.status(400).send()
      return
    }

    if (!hasWorkspaceAccess(roomName, req)) {
      res.status(401).send()
      return
    }

    const metadata = language != null ? { transcription, language } : { transcription }
    try {
      await updateMetadata(roomClient, roomName, metadata)
      res.status(200).send()
    } catch (e) {
      console.error(e)
      res.status(500).send()
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.post('/language', async (req, res) => {
    const roomName = req.body.roomName
    const language = req.body.language

    if (typeof roomName !== 'string' || language == null) {
      res.status(400).send()
      return
    }

    if (!hasWorkspaceAccess(roomName, req)) {
      res.status(401).send()
      return
    }

    try {
      await updateMetadata(roomClient, roomName, { language })
      res.send()
    } catch (e) {
      console.error(e)
      res.status(500).send()
    }
  })

  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })

  const shutdown = (): void => {
    server.close(() => process.exit())
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('uncaughtException', (e) => {
    console.error(e)
  })
  process.on('unhandledRejection', (e) => {
    console.error(e)
  })

  if (config.BillingUrl !== '') {
    setInterval(
      () => {
        try {
          void updateLiveKitSessions(ctx)
        } catch {}
      },
      config.BillingPollInterval * 60 * 1000
    )
    try {
      void updateLiveKitSessions(ctx)
    } catch {}
  }
}

const stopEgress = async (egressClient: EgressClient, roomName: string): Promise<void> => {
  const egresses = await egressClient.listEgress({ active: true, roomName })
  for (const egress of egresses) {
    await egressClient.stopEgress(egress.egressId)
  }
}

const createToken = async (roomName: string, _id: string, participantName: string): Promise<string> => {
  const at = new AccessToken(config.ApiKey, config.ApiSecret, {
    identity: _id,
    name: participantName,
    // token to expire after 10 minutes
    ttl: '10m'
  })
  at.addGrant({ roomJoin: true, room: roomName })

  return await at.toJwt()
}

const checkRecordAvailable = async (
  storageConfig: StorageConfig | undefined,
  s3storageConfig: StorageConfig | undefined
): Promise<boolean> => {
  if (storageConfig !== undefined && storageConfig.kind === 's3') return true
  if (storageConfig !== undefined && storageConfig.kind === 'datalake' && s3storageConfig !== undefined) return true
  return false
}

const startRecord = async (
  ctx: MeasureContext,
  storageConfig: StorageConfig | undefined,
  s3StorageConfig: StorageConfig | undefined,
  egressClient: EgressClient,
  roomClient: RoomServiceClient,
  roomName: string,
  wsIds: WorkspaceIds
): Promise<string> => {
  if (storageConfig === undefined) {
    console.error('please provide storage configuration')
    throw new Error('please provide storage configuration')
  }
  const uploadParams = await getS3UploadParams(ctx, wsIds, storageConfig, s3StorageConfig)

  const { filepath, endpoint, accessKey, secret, region, bucket } = uploadParams
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    disableManifest: true,
    output: {
      case: 's3',
      value: new S3Upload({
        endpoint,
        accessKey,
        region,
        secret,
        bucket,
        forcePathStyle: true
      })
    }
  })
  const { preset } = getRecordingPreset(config.RecordingPreset)
  await updateMetadata(roomClient, roomName, { recording: true })
  await egressClient.startRoomCompositeEgress(roomName, { file: output }, { layout: 'grid', encodingOptions: preset })
  return filepath
}

function hasWorkspaceAccess (roomName: string, req: Request): boolean {
  const workspace = roomName.split('_')[0]
  const token = extractToken(req.headers)
  if (token === undefined) {
    return false
  }

  let decodedToken: Token | undefined
  try {
    decodedToken = decodeToken(token)
  } catch (e) {}

  if (
    decodedToken === undefined ||
    decodedToken.workspace !== workspace ||
    decodedToken.extra?.readonly === 'true' ||
    decodedToken.extra?.guest === 'true'
  ) {
    return false
  }
  return true
}

function parseMetadata (metadata?: string | null): RoomMetadata {
  if (metadata === '' || metadata == null) return {}

  try {
    return JSON.parse(metadata) as RoomMetadata
  } catch (e) {
    return {}
  }
}

async function updateMetadata (
  roomClient: RoomServiceClient,
  roomName: string,
  metadata: Partial<RoomMetadata>
): Promise<void> {
  const room = (await roomClient.listRooms([roomName]))[0]
  const currentMetadata = parseMetadata(room?.metadata)

  await roomClient.updateRoomMetadata(roomName, JSON.stringify({ ...currentMetadata, ...metadata }))
}
