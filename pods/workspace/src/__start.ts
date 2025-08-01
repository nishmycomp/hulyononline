//
// Copyright © 2023 Hardcore Engineering Inc.
//
import { Analytics } from '@hcengineering/analytics'
import { configureAnalytics, createOpenTelemetryMetricsContext, SplitLogger } from '@hcengineering/analytics-service'
import { newMetrics, type Tx } from '@hcengineering/core'
import { getPlatformQueue } from '@hcengineering/kafka'
import builder, { getModelVersion, migrateOperations } from '@hcengineering/model-all'
import { initStatisticsContext, loadBrandingMap } from '@hcengineering/server-core'
import { serveWorkspaceAccount } from '@hcengineering/workspace-service'
import { join } from 'path'

const txes = JSON.parse(JSON.stringify(builder().getTxes())) as Tx[]

configureAnalytics('workspace', process.env.VERSION ?? '0.7.0')
Analytics.setTag('application', 'workspace')

// Force create server metrics context with proper logging
const metricsContext = initStatisticsContext('workspace', {
  factory: () =>
    createOpenTelemetryMetricsContext(
      'workspace',
      {},
      {},
      newMetrics(),
      new SplitLogger('workspace', {
        root: join(process.cwd(), 'logs'),
        enableConsole: (process.env.ENABLE_CONSOLE ?? 'true') === 'true'
      })
    )
})

const brandingPath = process.env.BRANDING_PATH

const queue = getPlatformQueue('workspace')

serveWorkspaceAccount(
  metricsContext,
  queue,
  getModelVersion(),
  txes,
  migrateOperations,
  loadBrandingMap(brandingPath),
  () => {}
)
