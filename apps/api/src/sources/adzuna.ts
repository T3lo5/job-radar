import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'
import { settingsService } from '../services/settings-service.js'
import { SETTINGS_SCOPE, ADZUNA_SETTINGS } from '../services/settings-keys.js'

const ADZUNA_API = 'https://api.adzuna.com/v1/api/jobs'

interface AdzunaJob {
  id: string
  title: string
  company?: {
    display_name: string
  }
  location?: {
    area?: string[]
  }
  description?: string
  salary_min?: number
  salary_max?: number
  redirect_url?: string
  created?: string
  category?: {
    label?: string
  }
  [key: string]: unknown
}

interface AdzunaResponse {
  results: AdzunaJob[]
  count: number
}

async function getAdzunaCredentials(): Promise<{ appId: string; appKey: string } | null> {
  const appId = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_ID)
  const appKey = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_KEY)

  if (appId && appKey) {
    return { appId, appKey }
  }

  const envAppId = process.env.ADZUNA_APP_ID
  const envAppKey = process.env.ADZUNA_APP_KEY
  if (envAppId && envAppKey) {
    return { appId: envAppId, appKey: envAppKey }
  }

  return null
}

export async function fetchAdzuna(query: SourceQuery): Promise<NormalizedJob[]> {
  const credentials = await getAdzunaCredentials()
  if (!credentials) {
    console.warn('Adzuna credentials not configured, skipping')
    return []
  }

  const country = 'br'
  const page = 1
  const resultsPerPage = Math.min(query.limit ?? 20, 50)
  const keywords = query.keywords.join(' ')
  const location = query.location ?? 'Brazil'

  const url = new URL(`${ADZUNA_API}/${country}/search/${page}`)
  url.searchParams.set('app_id', credentials.appId)
  url.searchParams.set('app_key', credentials.appKey)
  url.searchParams.set('what', keywords)
  url.searchParams.set('where', location)
  url.searchParams.set('results_per_page', String(resultsPerPage))
  url.searchParams.set('content-type', 'application/json')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.warn(`Adzuna API error: ${response.status} ${response.statusText}`)
    return []
  }

  const data = (await response.json()) as AdzunaResponse
  const jobs: NormalizedJob[] = []

  for (const raw of data.results) {
    if (!raw.title) continue

    const locationParts = raw.location?.area ?? []
    const locationString = locationParts.length > 0 ? locationParts.join(', ') : (raw.location ? String(raw.location) : null)

    jobs.push(
      normalizeJobFields({
        title: raw.title,
        company: raw.company?.display_name ?? 'Empresa não informada',
        description: raw.description ?? '',
        location: locationString,
        salary: raw.salary_min && raw.salary_max ? `${raw.salary_min}-${raw.salary_max}` : undefined,
        url: raw.redirect_url ?? `https://www.adzuna.com/jobs/search?q=${encodeURIComponent(raw.title)}`,
        externalId: raw.id,
        publishedAt: raw.created ? new Date(raw.created) : null,
        tags: raw.category?.label ? [raw.category.label] : [],
      }),
    )
  }

  return jobs
}
