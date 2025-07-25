//
// Copyright © 2024 Hardcore Engineering Inc
//

import { addEventListener, PlatformEvent, Severity, Status, translate } from '@hcengineering/platform'

export const providers: AnalyticProvider[] = []
export interface AnalyticProvider {
  init: (config: Record<string, any>) => boolean
  setUser: (email: string, data: any) => void
  setAlias: (distinctId: string, alias: string) => void
  setTag: (key: string, value: string) => void
  setWorkspace: (ws: string, guest: boolean) => void
  handleEvent: (event: string, params: Record<string, string>) => void
  handleError: (error: Error) => void
  navigate: (path: string) => void
  logout: () => void
}

export const Analytics = {
  data: {},

  init (provider: AnalyticProvider, config: Record<string, any>): void {
    const res = provider.init(config)
    if (res) {
      providers.push(provider)
    }
  },

  setUser (email: string, data: any): void {
    providers.forEach((provider) => {
      provider.setUser(email, data)
    })
  },

  setAlias (distinctId: string, alias: string): void {
    providers.forEach((provider) => {
      provider.setAlias(distinctId, alias)
    })
  },

  setTag (key: string, value: string): void {
    providers.forEach((provider) => {
      provider.setTag(key, value)
    })
  },

  setWorkspace (ws: string, guest: boolean): void {
    providers.forEach((provider) => {
      provider.setWorkspace(ws, guest)
    })
  },

  handleEvent (event: string, params: Record<string, any> = {}): void {
    providers.forEach((provider) => {
      provider.handleEvent(event, { ...this.data, ...params })
    })
  },

  handleError (error: Error): void {
    providers.forEach((provider) => {
      provider.handleError(error)
    })
  },

  navigate (path: string): void {
    providers.forEach((provider) => {
      provider.navigate(path)
    })
  },

  logout (): void {
    providers.forEach((provider) => {
      provider.logout()
    })
  }
}

addEventListener(PlatformEvent, async (_event, _status: Status) => {
  if (_status.severity === Severity.ERROR) {
    const label = await translate(_status.code, _status.params, 'en')
    Analytics.handleError(new Error(label))
  }
})
