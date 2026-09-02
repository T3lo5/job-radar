export const SETTINGS_SCOPE = {
  AI: 'ai',
  TELEGRAM: 'telegram',
  CRON: 'cron',
  SOURCES: 'sources',
  APIFY: 'apify',
  ADZUNA: 'adzuna',
} as const

export const APIFY_SETTINGS = {
  TOKEN: 'token',
  BASE_URL: 'baseUrl',
} as const

export const ADZUNA_SETTINGS = {
  APP_ID: 'appId',
  APP_KEY: 'appKey',
} as const

export const APIFY_CONSOLE_URL = 'https://console.apify.com/account#/integrations/api-token'
export const APIFY_DOCS_URL = 'https://docs.apify.com/guides/api'
export const APIFY_SIGNUP_URL = 'https://apify.com/signup'

export const AI_SETTINGS = {
  PROVIDER: 'provider',
  BASE_URL: 'baseUrl',
  API_KEY: 'apiKey',
  MODEL: 'model',
  CUSTOM_PROMPT: 'customPrompt',
} as const

export const TELEGRAM_SETTINGS = {
  BOT_TOKEN: 'botToken',
  CHAT_ID: 'chatId',
} as const

export const CRON_SETTINGS = {
  JOB_COLLECTION: 'jobCollectionCron',
  DAILY_REPORT: 'dailyReportCron',
} as const

export const DEFAULT_CRON = {
  JOB_COLLECTION: '0 6 * * *',
  DAILY_REPORT: '5 18 * * *',
} as const

export function sourceEnabledKey(sourceId: string): string {
  return `source_${sourceId}_enabled`
}
