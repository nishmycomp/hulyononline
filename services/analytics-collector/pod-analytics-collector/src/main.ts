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

import { setMetadata } from '@hcengineering/platform'
import serverClient from '@hcengineering/server-client'
import serverToken from '@hcengineering/server-token'

import { Analytics } from '@hcengineering/analytics'
import { SplitLogger, configureAnalytics, createOpenTelemetryMetricsContext } from '@hcengineering/analytics-service'
import { newMetrics } from '@hcengineering/core'
import { join } from 'path'

import { initStatisticsContext } from '@hcengineering/server-core'
import config from './config'
import { createServer, listen } from './server'

configureAnalytics('analytics-collector', process.env.VERSION ?? '0.7.0')
const ctx = initStatisticsContext('analytics-collector', {
  factory: () =>
    createOpenTelemetryMetricsContext(
      'analytics-collector-service',
      {},
      {},
      newMetrics(),
      new SplitLogger('analytics-collector-service', {
        root: join(process.cwd(), 'logs'),
        enableConsole: (process.env.ENABLE_CONSOLE ?? 'true') === 'true'
      })
    )
})

Analytics.setTag('application', 'analytics-collector-service')

export const main = async (): Promise<void> => {
  setMetadata(serverToken.metadata.Secret, config.Secret)
  setMetadata(serverClient.metadata.Endpoint, config.AccountsUrl)
  setMetadata(serverClient.metadata.UserAgent, config.ServiceID)

  ctx.info('Analytics service started', {
    accountsUrl: config.AccountsUrl
  })

  const app = createServer()
  const server = listen(app, config.Port)

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
}
