//
// Copyright © 2022, 2023, 2025 Hardcore Engineering Inc.
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

import platform, { type Plugin, addLocation, addStringsLoader, platformId } from '@hcengineering/platform'

import { activityId } from '@hcengineering/activity'
import aiBot, { aiBotId } from '@hcengineering/ai-bot'
import analyticsCollector, { analyticsCollectorId } from '@hcengineering/analytics-collector'
import { attachmentId } from '@hcengineering/attachment'
import { boardId } from '@hcengineering/board'
import calendar, { calendarId } from '@hcengineering/calendar'
import { cardId } from '@hcengineering/card'
import { chunterId } from '@hcengineering/chunter'
import client, { clientId } from '@hcengineering/client'
import contactPlugin, { contactId } from '@hcengineering/contact'
import { documentsId } from '@hcengineering/controlled-documents'
import { desktopPreferencesId } from '@hcengineering/desktop-preferences'
import { diffviewId } from '@hcengineering/diffview'
import { documentId } from '@hcengineering/document'
import { driveId } from '@hcengineering/drive'
import exportPlugin, { exportId } from '@hcengineering/export'
import gmail, { gmailId } from '@hcengineering/gmail'
import guest, { guestId } from '@hcengineering/guest'
import { hrId } from '@hcengineering/hr'
import { imageCropperId } from '@hcengineering/image-cropper'
import { inventoryId } from '@hcengineering/inventory'
import { leadId } from '@hcengineering/lead'
import login, { loginId } from '@hcengineering/login'
import love, { loveId } from '@hcengineering/love'
import notification, { notificationId } from '@hcengineering/notification'
import onboard, { onboardId } from '@hcengineering/onboard'
import presence, { presenceId } from '@hcengineering/presence'
import print, { printId } from '@hcengineering/print'
import { processId } from '@hcengineering/process'
import { productsId } from '@hcengineering/products'
import { questionsId } from '@hcengineering/questions'
import { recruitId } from '@hcengineering/recruit'
import rekoni from '@hcengineering/rekoni'
import { requestId } from '@hcengineering/request'
import setting, { settingId } from '@hcengineering/setting'
import sign from '@hcengineering/sign'
import { supportId } from '@hcengineering/support'
import { surveyId } from '@hcengineering/survey'
import { tagsId } from '@hcengineering/tags'
import { taskId } from '@hcengineering/task'
import telegram, { telegramId } from '@hcengineering/telegram'
import { templatesId } from '@hcengineering/templates'
import { testManagementId } from '@hcengineering/test-management'
import textEditor, { textEditorId } from '@hcengineering/text-editor'
import { timeId } from '@hcengineering/time'
import tracker, { trackerId } from '@hcengineering/tracker'
import { trainingId } from '@hcengineering/training'
import uiPlugin from '@hcengineering/ui'
import { uploaderId } from '@hcengineering/uploader'
import { mediaId } from '@hcengineering/media'
import recorder, { recorderId } from '@hcengineering/recorder'
import { viewId } from '@hcengineering/view'
import workbench, { workbenchId } from '@hcengineering/workbench'
import { mailId } from '@hcengineering/mail'
import { chatId } from '@hcengineering/chat'
import github, { githubId } from '@hcengineering/github'
import { bitrixId } from '@hcengineering/bitrix'
import {inboxId} from '@hcengineering/inbox'
import {achievementId} from '@hcengineering/achievement'
import communication, { communicationId } from '@hcengineering/communication'
import {emojiId} from '@hcengineering/emoji'
import billingPlugin, {billingId} from '@hcengineering/billing'

import '@hcengineering/activity-assets'
import '@hcengineering/analytics-collector-assets'
import '@hcengineering/attachment-assets'
import '@hcengineering/bitrix-assets'
import '@hcengineering/board-assets'
import '@hcengineering/calendar-assets'
import '@hcengineering/card-assets'
import '@hcengineering/chunter-assets'
import '@hcengineering/contact-assets'
import '@hcengineering/controlled-documents-assets'
import '@hcengineering/desktop-preferences-assets'
import '@hcengineering/diffview-assets'
import '@hcengineering/document-assets'
import '@hcengineering/drive-assets'
import '@hcengineering/export-assets'
import '@hcengineering/gmail-assets'
import '@hcengineering/guest-assets'
import '@hcengineering/hr-assets'
import '@hcengineering/inventory-assets'
import '@hcengineering/lead-assets'
import '@hcengineering/login-assets'
import '@hcengineering/love-assets'
import '@hcengineering/notification-assets'
import '@hcengineering/preference-assets'
import '@hcengineering/print-assets'
import '@hcengineering/process-assets'
import '@hcengineering/products-assets'
import '@hcengineering/questions-assets'
import '@hcengineering/recruit-assets'
import '@hcengineering/request-assets'
import '@hcengineering/setting-assets'
import '@hcengineering/support-assets'
import '@hcengineering/survey-assets'
import '@hcengineering/tags-assets'
import '@hcengineering/task-assets'
import '@hcengineering/telegram-assets'
import '@hcengineering/templates-assets'
import '@hcengineering/test-management-assets'
import '@hcengineering/text-editor-assets'
import '@hcengineering/time-assets'
import '@hcengineering/tracker-assets'
import '@hcengineering/training-assets'
import '@hcengineering/uploader-assets'
import '@hcengineering/recorder-assets'
import '@hcengineering/media-assets'
import '@hcengineering/view-assets'
import '@hcengineering/workbench-assets'
import '@hcengineering/chat-assets'
import '@hcengineering/inbox-assets'
import '@hcengineering/mail-assets'
import '@hcengineering/github-assets'
import '@hcengineering/achievement-assets'
import '@hcengineering/communication-assets'
import '@hcengineering/emoji-assets'
import '@hcengineering/billing-assets'

import { coreId } from '@hcengineering/core'
import presentation, {
  loadServerConfig,
  parsePreviewConfig,
  parseUploadConfig,
  presentationId
} from '@hcengineering/presentation'

import { setMetadata } from '@hcengineering/platform'
import { initThemeStore, setDefaultLanguage } from '@hcengineering/theme'

import { preferenceId } from '@hcengineering/preference'
import { uiId } from '@hcengineering/ui/src/plugin'
import { configureAnalytics } from './analytics'

export interface Config {
  ACCOUNTS_URL: string
  UPLOAD_URL: string
  FILES_URL: string
  MODEL_VERSION: string
  VERSION: string
  COLLABORATOR_URL: string
  COLLABORATOR?: string
  REKONI_URL: string
  TELEGRAM_URL: string
  GMAIL_URL: string
  CALENDAR_URL: string
  PUSH_PUBLIC_KEY: string
  APP_PROTOCOL?: string
  GITHUB_APP?: string
  GITHUB_CLIENTID?: string
  GITHUB_URL: string
  SENTRY_DSN?: string
  LOVE_ENDPOINT?: string
  LIVEKIT_WS?: string
  SIGN_URL?: string
  PRINT_URL?: string
  POSTHOG_API_KEY?: string
  POSTHOG_HOST?: string
  ANALYTICS_COLLECTOR_URL?: string
  BRANDING_URL?: string
  TELEGRAM_BOT_URL?: string
  AI_URL?: string
  DISABLE_SIGNUP?: string
  HIDE_LOCAL_LOGIN?: string
  LINK_PREVIEW_URL?: string
  PASSWORD_STRICTNESS?: 'very_strict' | 'strict' | 'normal' | 'none'
  // Could be defined for dev environment
  FRONT_URL?: string
  PREVIEW_CONFIG?: string
  UPLOAD_CONFIG?: string
  STATS_URL?: string
  PRESENCE_URL?: string
  USE_BINARY_PROTOCOL?: boolean
  TRANSACTOR_OVERRIDE?: string
  BACKUP_URL?: string
  STREAM_URL?: string
  PUBLIC_SCHEDULE_URL?: string
  CALDAV_SERVER_URL?: string
  EXPORT_URL?: string
  MAIL_URL?: string,
  COMMUNICATION_API_ENABLED?: string
  BILLING_URL?: string,
  EXCLUDED_APPLICATIONS_FOR_ANONYMOUS?: string
}

export interface Branding {
  title?: string
  links?: {
    rel: string
    href: string
    type?: string
    sizes?: string
  }[]
  languages?: string
  lastNameFirst?: string
  defaultLanguage?: string
  defaultApplication?: string
  defaultSpace?: string
  defaultSpecial?: string
  initWorkspace?: string
}

export type BrandingMap = Record<string, Branding>

const clientType = process.env.CLIENT_TYPE
const configs: Record<string, string> = {
  'dev-production': '/config-dev.json',
  'dev-huly': '/config-huly.json',
  'dev-bold': '/config.json',
  'dev-server': '/config.json',
  'dev-server-test': '/config-test.json',
  'dev-worker': '/config-worker.json',
  'dev-worker-local': '/config-worker-local.json'
}

const PASSWORD_REQUIREMENTS: Record<NonNullable<Config['PASSWORD_STRICTNESS']>, Record<string, number>> = {
  very_strict: {
    MinDigits: 4,
    MinLength: 32,
    MinLowerChars: 4,
    MinSpecialChars: 4,
    MinUpperChars: 4
  },
  strict: {
    MinDigits: 2,
    MinLength: 16,
    MinLowerChars: 2,
    MinSpecialChars: 2,
    MinUpperChars: 2
  },
  normal: {
    MinDigits: 1,
    MinLength: 8,
    MinLowerChars: 1,
    MinSpecialChars: 1,
    MinUpperChars: 1
  },
  none: {
    MinDigits: 0,
    MinLength: 0,
    MinLowerChars: 0,
    MinSpecialChars: 0,
    MinUpperChars: 0
  }
}

function configureI18n(): void {
  //Add localization
  addStringsLoader(platformId, async (lang: string) => await import(
    /* webpackInclude: /\.json$/ */
    /* webpackMode: "lazy" */
    /* webpackChunkName: "lang-[request]" */
    `@hcengineering/platform/lang/${lang}.json`
  ))
  addStringsLoader(coreId, async (lang: string) => await import(
    /* webpackInclude: /\.json$/ */
    /* webpackMode: "lazy" */
    /* webpackChunkName: "lang-[request]" */
    `@hcengineering/core/lang/${lang}.json`
  ))
  addStringsLoader(
    presentationId,
    async (lang: string) => await import(`@hcengineering/presentation/lang/${lang}.json`)
  )
  addStringsLoader(
    textEditorId,
    async (lang: string) => await import(`@hcengineering/text-editor-assets/lang/${lang}.json`)
  )
  addStringsLoader(uiId, async (lang: string) => await import(`@hcengineering/ui/lang/${lang}.json`))
  addStringsLoader(uploaderId, async (lang: string) => await import(`@hcengineering/uploader-assets/lang/${lang}.json`))
  addStringsLoader(recorderId, async (lang: string) => await import(`@hcengineering/recorder-assets/lang/${lang}.json`))
  addStringsLoader(mediaId, async (lang: string) => await import(`@hcengineering/media-assets/lang/${lang}.json`))
  addStringsLoader(activityId, async (lang: string) => await import(`@hcengineering/activity-assets/lang/${lang}.json`))
  addStringsLoader(
    attachmentId,
    async (lang: string) => await import(`@hcengineering/attachment-assets/lang/${lang}.json`)
  )
  addStringsLoader(bitrixId, async (lang: string) => await import(`@hcengineering/bitrix-assets/lang/${lang}.json`))
  addStringsLoader(boardId, async (lang: string) => await import(`@hcengineering/board-assets/lang/${lang}.json`))
  addStringsLoader(calendarId, async (lang: string) => await import(`@hcengineering/calendar-assets/lang/${lang}.json`))
  addStringsLoader(chunterId, async (lang: string) => await import(`@hcengineering/chunter-assets/lang/${lang}.json`))
  addStringsLoader(contactId, async (lang: string) => await import(`@hcengineering/contact-assets/lang/${lang}.json`))
  addStringsLoader(driveId, async (lang: string) => await import(`@hcengineering/drive-assets/lang/${lang}.json`))
  addStringsLoader(gmailId, async (lang: string) => await import(`@hcengineering/gmail-assets/lang/${lang}.json`))
  addStringsLoader(hrId, async (lang: string) => await import(`@hcengineering/hr-assets/lang/${lang}.json`))
  addStringsLoader(
    inventoryId,
    async (lang: string) => await import(`@hcengineering/inventory-assets/lang/${lang}.json`)
  )
  addStringsLoader(leadId, async (lang: string) => await import(`@hcengineering/lead-assets/lang/${lang}.json`))
  addStringsLoader(loginId, async (lang: string) => await import(`@hcengineering/login-assets/lang/${lang}.json`))
  addStringsLoader(
    notificationId,
    async (lang: string) => await import(`@hcengineering/notification-assets/lang/${lang}.json`)
  )
  addStringsLoader(onboardId, async (lang: string) => await import(`@hcengineering/onboard-assets/lang/${lang}.json`))
  addStringsLoader(
    preferenceId,
    async (lang: string) => await import(`@hcengineering/preference-assets/lang/${lang}.json`)
  )
  addStringsLoader(recruitId, async (lang: string) => await import(`@hcengineering/recruit-assets/lang/${lang}.json`))
  addStringsLoader(requestId, async (lang: string) => await import(`@hcengineering/request-assets/lang/${lang}.json`))
  addStringsLoader(settingId, async (lang: string) => await import(`@hcengineering/setting-assets/lang/${lang}.json`))
  addStringsLoader(supportId, async (lang: string) => await import(`@hcengineering/support-assets/lang/${lang}.json`))
  addStringsLoader(tagsId, async (lang: string) => await import(`@hcengineering/tags-assets/lang/${lang}.json`))
  addStringsLoader(taskId, async (lang: string) => await import(`@hcengineering/task-assets/lang/${lang}.json`))
  addStringsLoader(telegramId, async (lang: string) => await import(`@hcengineering/telegram-assets/lang/${lang}.json`))
  addStringsLoader(
    templatesId,
    async (lang: string) => await import(`@hcengineering/templates-assets/lang/${lang}.json`)
  )
  addStringsLoader(trackerId, async (lang: string) => await import(`@hcengineering/tracker-assets/lang/${lang}.json`))
  addStringsLoader(viewId, async (lang: string) => await import(`@hcengineering/view-assets/lang/${lang}.json`))
  addStringsLoader(
    workbenchId,
    async (lang: string) => await import(`@hcengineering/workbench-assets/lang/${lang}.json`)
  )

  addStringsLoader(
    desktopPreferencesId,
    async (lang: string) => await import(`@hcengineering/desktop-preferences-assets/lang/${lang}.json`)
  )
  addStringsLoader(diffviewId, async (lang: string) => await import(`@hcengineering/diffview-assets/lang/${lang}.json`))
  addStringsLoader(documentId, async (lang: string) => await import(`@hcengineering/document-assets/lang/${lang}.json`))
  addStringsLoader(timeId, async (lang: string) => await import(`@hcengineering/time-assets/lang/${lang}.json`))
  addStringsLoader(githubId, async (lang: string) => await import(`@hcengineering/github-assets/lang/${lang}.json`))
  addStringsLoader(
    documentsId,
    async (lang: string) => await import(`@hcengineering/controlled-documents-assets/lang/${lang}.json`)
  )
  addStringsLoader(productsId, async (lang: string) => await import(`@hcengineering/products-assets/lang/${lang}.json`))
  addStringsLoader(
    questionsId,
    async (lang: string) => await import(`@hcengineering/questions-assets/lang/${lang}.json`)
  )
  addStringsLoader(trainingId, async (lang: string) => await import(`@hcengineering/training-assets/lang/${lang}.json`))
  addStringsLoader(guestId, async (lang: string) => await import(`@hcengineering/guest-assets/lang/${lang}.json`))
  addStringsLoader(loveId, async (lang: string) => await import(`@hcengineering/love-assets/lang/${lang}.json`))
  addStringsLoader(printId, async (lang: string) => await import(`@hcengineering/print-assets/lang/${lang}.json`))
  addStringsLoader(exportId, async (lang: string) => await import(`@hcengineering/export-assets/lang/${lang}.json`))
  addStringsLoader(
    analyticsCollectorId,
    async (lang: string) => await import(`@hcengineering/analytics-collector-assets/lang/${lang}.json`)
  )
  addStringsLoader(
    testManagementId,
    async (lang: string) => await import(`@hcengineering/test-management-assets/lang/${lang}.json`)
  )
  addStringsLoader(surveyId, async (lang: string) => await import(`@hcengineering/survey-assets/lang/${lang}.json`))
  addStringsLoader(cardId, async (lang: string) => await import(`@hcengineering/card-assets/lang/${lang}.json`))
  addStringsLoader(mailId, async (lang: string) => await import(`@hcengineering/mail-assets/lang/${lang}.json`))
  addStringsLoader(chatId, async (lang: string) => await import(`@hcengineering/chat-assets/lang/${lang}.json`))
  addStringsLoader(processId, async (lang: string) => await import(`@hcengineering/process-assets/lang/${lang}.json`))
  addStringsLoader(inboxId, async (lang: string) => await import(`@hcengineering/inbox-assets/lang/${lang}.json`))
  addStringsLoader(achievementId, async (lang: string) => await import(`@hcengineering/achievement-assets/lang/${lang}.json`))
  addStringsLoader(communicationId, async (lang: string) => await import(`@hcengineering/communication-assets/lang/${lang}.json`))
  addStringsLoader(emojiId, async (lang: string) => await import(`@hcengineering/emoji-assets/lang/${lang}.json`))
  addStringsLoader(billingId, async (lang: string) => await import(`@hcengineering/billing-assets/lang/${lang}.json`))
}

export async function configurePlatform() {
  setMetadata(platform.metadata.LoadHelper, async (loader) => {
    for (let i = 0; i < 5; i++) {
      try {
        return loader()
      } catch (err: any) {
        if (err.message.includes('Loading chunk') && i != 4) {
          continue
        }
        location.reload()
      }
    }
  })
  configureI18n()

  const config: Config = await loadServerConfig(configs[clientType ?? ''] ?? '/config.json')
  const branding: BrandingMap =
    config.BRANDING_URL !== undefined ? await (await fetch(config.BRANDING_URL, { keepalive: true })).json() : {}
  const myBranding = branding[window.location.host] ?? {}

  console.log('loading configuration', config)
  console.log('loaded branding', myBranding)

  const title = myBranding.title ?? 'Platform'

  // apply branding
  window.document.title = title

  const links = myBranding.links ?? []
  if (links.length > 0) {
    // remove the default favicon
    // it's only needed for Safari which cannot use dynamically added links for favicons
    document.getElementById('default-favicon')?.remove()

    for (const link of links) {
      const htmlLink = document.createElement('link')
      htmlLink.rel = link.rel
      htmlLink.href = link.href

      if (link.type !== undefined) {
        htmlLink.type = link.type
      }

      if (link.sizes !== undefined) {
        htmlLink.setAttribute('sizes', link.sizes)
      }

      document.head.appendChild(htmlLink)
    }
  }

  configureAnalytics(config)
  // tryOpenInDesktopApp(config.APP_PROTOCOL ?? 'huly://')

  setMetadata(login.metadata.AccountsUrl, config.ACCOUNTS_URL)
  setMetadata(login.metadata.DisableSignUp, config.DISABLE_SIGNUP === 'true')
  setMetadata(login.metadata.HideLocalLogin, config.HIDE_LOCAL_LOGIN === 'true')

  setMetadata(login.metadata.PasswordValidations, PASSWORD_REQUIREMENTS[config.PASSWORD_STRICTNESS ?? 'none'])

  setMetadata(presentation.metadata.FilesURL, config.FILES_URL)
  setMetadata(presentation.metadata.UploadURL, config.UPLOAD_URL)
  setMetadata(presentation.metadata.CollaboratorUrl, config.COLLABORATOR_URL)

  setMetadata(presentation.metadata.FrontUrl, config.FRONT_URL)
  setMetadata(presentation.metadata.PreviewConfig, parsePreviewConfig(config.PREVIEW_CONFIG))
  setMetadata(presentation.metadata.UploadConfig, parseUploadConfig(config.UPLOAD_CONFIG ?? '', config.UPLOAD_URL))
  setMetadata(presentation.metadata.StatsUrl, config.STATS_URL)
  setMetadata(presentation.metadata.LinkPreviewUrl, config.LINK_PREVIEW_URL)
  setMetadata(presentation.metadata.MailUrl, config.MAIL_URL)
  setMetadata(recorder.metadata.StreamUrl, config.STREAM_URL)
  setMetadata(textEditor.metadata.Collaborator, config.COLLABORATOR)
  setMetadata(communication.metadata.Enabled, config.COMMUNICATION_API_ENABLED === 'true')

  if (config.MODEL_VERSION != null) {
    console.log('Minimal Model version requirement', config.MODEL_VERSION)
    setMetadata(presentation.metadata.ModelVersion, config.MODEL_VERSION)
  }
  if (config.VERSION != null) {
    console.log('Minimal version requirement', config.VERSION)
    setMetadata(presentation.metadata.FrontVersion, config.VERSION)
  }
  setMetadata(telegram.metadata.TelegramURL, config.TELEGRAM_URL ?? 'http://localhost:8086')
  setMetadata(telegram.metadata.BotUrl, config.TELEGRAM_BOT_URL ?? 'http://huly.local:4020')
  setMetadata(gmail.metadata.GmailURL, config.GMAIL_URL ?? 'http://localhost:8087')
  setMetadata(calendar.metadata.CalendarServiceURL, config.CALENDAR_URL ?? 'http://localhost:8095')
  setMetadata(calendar.metadata.PublicScheduleURL, config.PUBLIC_SCHEDULE_URL)
  setMetadata(calendar.metadata.CalDavServerURL, config.CALDAV_SERVER_URL)
  setMetadata(notification.metadata.PushPublicKey, config.PUSH_PUBLIC_KEY)
  setMetadata(analyticsCollector.metadata.EndpointURL, config.ANALYTICS_COLLECTOR_URL)
  setMetadata(aiBot.metadata.EndpointURL, config.AI_URL)

  setMetadata(github.metadata.GithubApplication, config.GITHUB_APP ?? '')
  setMetadata(github.metadata.GithubClientID, config.GITHUB_CLIENTID ?? '')
  setMetadata(github.metadata.GithubURL, config.GITHUB_URL)

  setMetadata(rekoni.metadata.RekoniUrl, config.REKONI_URL)

  setMetadata(uiPlugin.metadata.DefaultApplication, login.component.LoginApp)
  setMetadata(contactPlugin.metadata.LastNameFirst, myBranding.lastNameFirst === 'true')
  setMetadata(love.metadata.ServiceEnpdoint, config.LOVE_ENDPOINT)
  setMetadata(love.metadata.WebSocketURL, config.LIVEKIT_WS)
  setMetadata(print.metadata.PrintURL, config.PRINT_URL)
  setMetadata(sign.metadata.SignURL, config.SIGN_URL)
  setMetadata(presence.metadata.PresenceUrl, config.PRESENCE_URL ?? '')
  setMetadata(exportPlugin.metadata.ExportUrl, config.EXPORT_URL ?? '')

  setMetadata(billingPlugin.metadata.BillingURL, config.BILLING_URL ?? '')

  const languages = myBranding.languages
    ? (myBranding.languages as string).split(',').map((l) => l.trim())
    : ['en', 'ru', 'es', 'pt', 'zh', 'fr', 'cs', 'it', 'de', 'ja']

  setMetadata(uiPlugin.metadata.Languages, languages)

  setMetadata(
    uiPlugin.metadata.Routes,
    new Map([
      [workbenchId, workbench.component.WorkbenchApp],
      [loginId, login.component.LoginApp],
      [onboardId, onboard.component.OnboardApp],
      [githubId, github.component.ConnectApp],
      [calendarId, calendar.component.ConnectApp],
      [guestId, guest.component.GuestApp]
    ])
  )

  addLocation(coreId, async () => ({ default: async () => ({}) }))
  addLocation(presentationId, async () => ({ default: async () => ({}) }))

  addLocation(clientId, () => import(/* webpackChunkName: "client" */ '@hcengineering/client-resources'))
  addLocation(loginId, () => import(/* webpackChunkName: "login" */ '@hcengineering/login-resources'))
  addLocation(onboardId, () => import(/* webpackChunkName: "onboard" */ '@hcengineering/onboard-resources'))
  addLocation(workbenchId, () => import(/* webpackChunkName: "workbench" */ '@hcengineering/workbench-resources'))
  addLocation(viewId, () => import(/* webpackChunkName: "view" */ '@hcengineering/view-resources'))
  addLocation(taskId, () => import(/* webpackChunkName: "task" */ '@hcengineering/task-resources'))
  addLocation(contactId, () => import(/* webpackChunkName: "contact" */ '@hcengineering/contact-resources'))
  addLocation(chunterId, () => import(/* webpackChunkName: "chunter" */ '@hcengineering/chunter-resources'))
  addLocation(recruitId, () => import(/* webpackChunkName: "recruit" */ '@hcengineering/recruit-resources'))
  addLocation(activityId, () => import(/*webpackChunkName: "activity" */ '@hcengineering/activity-resources'))
  addLocation(settingId, () => import(/* webpackChunkName: "setting" */ '@hcengineering/setting-resources'))
  addLocation(leadId, () => import(/* webpackChunkName: "lead" */ '@hcengineering/lead-resources'))
  addLocation(telegramId, () => import(/* webpackChunkName: "telegram" */ '@hcengineering/telegram-resources'))
  addLocation(attachmentId, () => import(/* webpackChunkName: "attachment" */ '@hcengineering/attachment-resources'))
  addLocation(gmailId, () => import(/* webpackChunkName: "gmail" */ '@hcengineering/gmail-resources'))
  addLocation(
    imageCropperId,
    () => import(/* webpackChunkName: "image-cropper" */ '@hcengineering/image-cropper-resources')
  )
  addLocation(inventoryId, () => import(/* webpackChunkName: "inventory" */ '@hcengineering/inventory-resources'))
  addLocation(templatesId, () => import(/* webpackChunkName: "templates" */ '@hcengineering/templates-resources'))
  addLocation(
    notificationId,
    () => import(/* webpackChunkName: "notification" */ '@hcengineering/notification-resources')
  )
  addLocation(tagsId, () => import(/* webpackChunkName: "tags" */ '@hcengineering/tags-resources'))
  addLocation(calendarId, () => import(/* webpackChunkName: "calendar" */ '@hcengineering/calendar-resources'))
  addLocation(diffviewId, () => import(/* webpackChunkName: "diffview" */ '@hcengineering/diffview-resources'))
  addLocation(timeId, () => import(/* webpackChunkName: "time" */ '@hcengineering/time-resources'))
  addLocation(
    desktopPreferencesId,
    () => import(/* webpackChunkName: "desktop-preferences" */ '@hcengineering/desktop-preferences-resources')
  )
  addLocation(analyticsCollectorId, async () => await import('@hcengineering/analytics-collector-resources'))
  addLocation(aiBotId, async () => await import('@hcengineering/ai-bot-resources'))

  addLocation(trackerId, () => import(/* webpackChunkName: "tracker" */ '@hcengineering/tracker-resources'))
  addLocation(boardId, () => import(/* webpackChunkName: "board" */ '@hcengineering/board-resources'))
  addLocation(hrId, () => import(/* webpackChunkName: "hr" */ '@hcengineering/hr-resources'))
  addLocation(bitrixId, () => import(/* webpackChunkName: "bitrix" */ '@hcengineering/bitrix-resources'))
  addLocation(requestId, () => import(/* webpackChunkName: "request" */ '@hcengineering/request-resources'))
  addLocation(driveId, () => import(/* webpackChunkName: "drive" */ '@hcengineering/drive-resources'))
  addLocation(supportId, () => import(/* webpackChunkName: "support" */ '@hcengineering/support-resources'))

  addLocation(documentId, () => import(/* webpackChunkName: "document" */ '@hcengineering/document-resources'))
  addLocation(githubId, () => import(/* webpackChunkName: "github" */ '@hcengineering/github-resources'))
  addLocation(questionsId, () => import(/* webpackChunkName: "training" */ '@hcengineering/questions-resources'))
  addLocation(trainingId, () => import(/* webpackChunkName: "training" */ '@hcengineering/training-resources'))
  addLocation(productsId, () => import(/* webpackChunkName: "products" */ '@hcengineering/products-resources'))
  addLocation(
    documentsId,
    () => import(/* webpackChunkName: "documents" */ '@hcengineering/controlled-documents-resources')
  )
  addLocation(guestId, () => import(/* webpackChunkName: "guest" */ '@hcengineering/guest-resources'))
  addLocation(loveId, () => import(/* webpackChunkName: "love" */ '@hcengineering/love-resources'))
  addLocation(printId, () => import(/* webpackChunkName: "print" */ '@hcengineering/print-resources'))
  addLocation(exportId, () => import(/* webpackChunkName: "export" */ '@hcengineering/export-resources'))
  addLocation(textEditorId, () => import(/* webpackChunkName: "text-editor" */ '@hcengineering/text-editor-resources'))
  addLocation(uploaderId, () => import(/* webpackChunkName: "uploader" */ '@hcengineering/uploader-resources'))
  addLocation(recorderId, () => import(/* webpackChunkName: "recorder" */ '@hcengineering/recorder-resources'))
  addLocation(mediaId, () => import(/* webpackChunkName: "media" */ '@hcengineering/media-resources'))

  addLocation(
    testManagementId,
    () => import(/* webpackChunkName: "test-management" */ '@hcengineering/test-management-resources')
  )
  addLocation(surveyId, () => import(/* webpackChunkName: "survey" */ '@hcengineering/survey-resources'))
  addLocation(presenceId, () => import(/* webpackChunkName: "presence" */ '@hcengineering/presence-resources'))
  addLocation(cardId, () => import(/* webpackChunkName: "card" */ '@hcengineering/card-resources'))
  addLocation(chatId, () => import(/* webpackChunkName: "chat" */ '@hcengineering/chat-resources'))
  addLocation(processId, () => import(/* webpackChunkName: "process" */ '@hcengineering/process-resources'))
  addLocation(inboxId, () => import(/* webpackChunkName: "inbox" */ '@hcengineering/inbox-resources'))
  addLocation(achievementId, () => import(/* webpackChunkName: "achievement" */ '@hcengineering/achievement-resources'))
  addLocation(communicationId, () => import(/* webpackChunkName: "communication" */ '@hcengineering/communication-resources'))
  addLocation(emojiId, () => import(/* webpackChunkName: "achievement" */ '@hcengineering/emoji-resources'))
  addLocation(billingId, () => import(/* webpackChunkName: "achievement" */ '@hcengineering/billing-resources'))

  setMetadata(client.metadata.FilterModel, 'ui')
  setMetadata(client.metadata.ExtraPlugins, ['preference' as Plugin])
  setMetadata(login.metadata.TransactorOverride, config.TRANSACTOR_OVERRIDE)

  // Use binary response transfer for faster performance and small transfer sizes.
  const binaryOverride = localStorage.getItem(client.metadata.UseBinaryProtocol)
  setMetadata(
    client.metadata.UseBinaryProtocol,
    binaryOverride != null ? binaryOverride === 'true' : config.USE_BINARY_PROTOCOL ?? true
  )

  // Disable for now, since it causes performance issues on linux/docker/kubernetes boxes for now.
  setMetadata(client.metadata.UseProtocolCompression, true)

  setMetadata(uiPlugin.metadata.PlatformTitle, title)
  setMetadata(workbench.metadata.PlatformTitle, title)
  setDefaultLanguage(myBranding.defaultLanguage ?? 'en')
  setMetadata(workbench.metadata.DefaultApplication, myBranding.defaultApplication ?? 'tracker')
  setMetadata(workbench.metadata.DefaultSpace, myBranding.defaultSpace ?? tracker.project.DefaultProject)
  setMetadata(workbench.metadata.DefaultSpecial, myBranding.defaultSpecial ?? 'issues')

  try {
    const parsed = JSON.parse(config.EXCLUDED_APPLICATIONS_FOR_ANONYMOUS ?? '')
    setMetadata(workbench.metadata.ExcludedApplicationsForAnonymous, Array.isArray(parsed) ? parsed : [])
  } catch (err) {
    setMetadata(workbench.metadata.ExcludedApplicationsForAnonymous, [])
  }

  setMetadata(setting.metadata.BackupUrl, config.BACKUP_URL ?? '')

  initThemeStore()
}
