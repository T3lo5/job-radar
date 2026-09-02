import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'

const JOBICY_API = 'https://jobicy.com/api/v2/remote-jobs'

interface JobicyJob {
  id: number
  url: string
  jobTitle: string
  companyName: string
  companyLogo?: string
  jobIndustry: string[]
  jobType: string[]
  jobGeo: string
  jobLevel: string
  jobExcerpt: string
  jobDescription: string
  pubDate: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  salaryPeriod?: string
  [key: string]: unknown
}

interface JobicyResponse {
  jobs: JobicyJob[]
}

export async function fetchJobicy(query: SourceQuery): Promise<NormalizedJob[]> {
  const url = new URL(JOBICY_API)
  const count = Math.min(query.limit ?? 50, 200)

  url.searchParams.set('count', String(count))
  if (query.keywords.length > 0) {
    url.searchParams.set('tag', query.keywords.join(','))
  }
  if (query.location) {
    url.searchParams.set('geo', query.location.toLowerCase())
  }
  if (query.remoteOnly) {
    url.searchParams.set('geo', 'anywhere')
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    console.warn(`Jobicy API error: ${response.status} ${response.statusText}`)
    return []
  }

  const data = (await response.json()) as JobicyResponse
  const jobs: NormalizedJob[] = []

  for (const raw of data.jobs) {
    if (!raw.jobTitle) continue

    const salary = raw.salaryMin && raw.salaryMax ? `${raw.salaryMin}-${raw.salaryMax}` : undefined

    jobs.push(
      normalizeJobFields({
        title: raw.jobTitle,
        company: raw.companyName,
        description: raw.jobDescription || raw.jobExcerpt,
        location: raw.jobGeo || null,
        salary,
        url: raw.url,
        externalId: String(raw.id),
        publishedAt: raw.pubDate ? new Date(raw.pubDate) : null,
        tags: raw.jobIndustry,
      }),
    )
  }

  return jobs
}
