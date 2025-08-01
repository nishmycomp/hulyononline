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

interface Config {
  AccountsURL: string
  Port: number
  ServiceID: string

  LiveKitProject: string
  LiveKitHost: string
  ApiKey: string
  ApiSecret: string

  StorageConfig: string
  StorageProviderName: string
  S3StorageConfig: string
  Secret: string

  RecordingPreset: string

  BillingUrl: string
  BillingPollInterval: number
}

const envMap: { [key in keyof Config]: string } = {
  AccountsURL: 'ACCOUNTS_URL',
  Port: 'PORT',

  LiveKitProject: 'LIVEKIT_PROJECT',
  LiveKitHost: 'LIVEKIT_HOST',
  ApiKey: 'LIVEKIT_API_KEY',
  ApiSecret: 'LIVEKIT_API_SECRET',

  StorageConfig: 'STORAGE_CONFIG',
  StorageProviderName: 'STORAGE_PROVIDER_NAME',
  S3StorageConfig: 'S3_STORAGE_CONFIG',
  Secret: 'SECRET',
  ServiceID: 'SERVICE_ID',

  RecordingPreset: 'RECORDING_PRESET',

  BillingUrl: 'BILLING_URL',
  BillingPollInterval: 'BILLING_POLL_INTERVAL'
}

const parseNumber = (str: string | undefined): number | undefined => (str !== undefined ? Number(str) : undefined)

const config: Config = (() => {
  const params: Partial<Config> = {
    AccountsURL: process.env[envMap.AccountsURL],
    Port: parseNumber(process.env[envMap.Port]) ?? 8096,
    LiveKitProject: process.env[envMap.LiveKitProject] ?? '',
    LiveKitHost: process.env[envMap.LiveKitHost],
    ApiKey: process.env[envMap.ApiKey],
    ApiSecret: process.env[envMap.ApiSecret],
    StorageConfig: process.env[envMap.StorageConfig],
    StorageProviderName: process.env[envMap.StorageProviderName] ?? 's3',
    S3StorageConfig: process.env[envMap.S3StorageConfig],
    Secret: process.env[envMap.Secret],
    ServiceID: process.env[envMap.ServiceID] ?? 'love-service',
    RecordingPreset: process.env[envMap.RecordingPreset] ?? '720p',
    BillingUrl: process.env[envMap.BillingUrl] ?? '',
    BillingPollInterval: parseNumber(process.env[envMap.BillingPollInterval]) ?? 15
  }

  const optional = ['StorageConfig', 'S3StorageConfig', 'LiveKitProject', 'BillingUrl']

  const missingEnv = (Object.keys(params) as Array<keyof Config>)
    .filter((key) => !optional.includes(key))
    .filter((key) => params[key] === undefined)
    .map((key) => envMap[key])

  if (missingEnv.length > 0) {
    throw Error(`Missing env variables: ${missingEnv.join(', ')}`)
  }

  return params as Config
})()

export default config
