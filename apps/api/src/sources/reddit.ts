import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { parseRemoteMode } from './normalizer.js'
import { settingsService } from '../services/settings-service.js'
import { SETTINGS_SCOPE, APIFY_SETTINGS } from '../services/settings-keys.js'

const DEFAULT_APIFY_ACTOR_URL = 'https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items'

interface ApifyJob {
  title?: string
  company?: string
  companyUrl?: string
  location?: string
  description?: { text?: string } | string
  url?: string
  datePosted?: string
  salary?: string
  jobPoster?: { name?: string; title?: string }
  applicants?: number
  experienceLevel?: string
  employmentType?: string
  workplaceType?: string
  sectors?: string[]
  companyId?: string
  linkedinJobId?: string
  [key: string]: unknown
}

type ApifyResponse = ApifyJob[]

export async function fetchLinkedInJobs(query: SourceQuery): Promise<NormalizedJob[]> {
  let token = await settingsService.get(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN)
  if (!token) {
    token = process.env.APIFY_TOKEN ?? null
  }
  if (!token) {
    console.warn('Apify token not configured, skipping LinkedIn Jobs scrape')
    return []
  }
  if (token === '********') {
    return []
  }

  const baseUrl = (await settingsService.get(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.BASE_URL)) || DEFAULT_APIFY_ACTOR_URL

  const jobs: NormalizedJob[] = []

  try {
    const keywords = query.keywords.length > 0 ? query.keywords.join(' ') : 'developer'

    const response = await fetch(`${baseUrl}?token=${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        location: 'Brazil',
        limitPerSource: 100,
        datePosted: 'pastWeek',
        autoConvertToAiSearch: true,
        scrapeCompany: false,
      }),
    })

    if (!response.ok) {
      console.warn(`Apify API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data = (await response.json()) as ApifyResponse

    for (const item of data) {
      if (!item.title) continue

      const description =
        typeof item.description === 'string' ? item.description : item.description?.text || ''

      jobs.push({
        title: item.title,
        company: item.company || item.companyUrl || 'Empresa não informada',
        description,
        location: item.location || null,
        remote: parseRemoteMode(item.workplaceType || description),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        url: item.url || `https://www.linkedin.com/jobs/view/${item.linkedinJobId || ''}`,
        externalId: `apify-${item.linkedinJobId || Date.now().toString()}`,
        publishedAt: item.datePosted ? new Date(item.datePosted) : new Date(),
        tags: ['linkedin', 'apify', ...(item.sectors || [])],
      })
    }
  } catch (err) {
    console.error('Error fetching LinkedIn jobs via Apify:', err)
  }

  return jobs
}
