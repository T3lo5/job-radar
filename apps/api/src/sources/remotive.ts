import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'

const REMOTIVE_API = 'https://remotive.com/api/remote-jobs'

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  candidate_required_location: string
  salary?: string
  description: string
  category: string
  tags: string[]
  date: string
}

interface RemotiveResponse {
  'job-count': number
  jobs: RemotiveJob[]
}

export async function fetchRemotive(query: SourceQuery): Promise<NormalizedJob[]> {
  const url = new URL(REMOTIVE_API)
  if (query.keywords.length > 0) {
    url.searchParams.set('search', query.keywords.join(' '))
  }
  if (query.limit) {
    url.searchParams.set('limit', String(query.limit))
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobRadar/1.0; +https://github.com/job-radar)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Remotive API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RemotiveResponse
  return data.jobs.map((raw) =>
    normalizeJobFields({
      title: raw.title,
      company: raw.company_name,
      description: raw.description,
      location: raw.candidate_required_location || null,
      salary: raw.salary,
      url: raw.url,
      externalId: String(raw.id),
      publishedAt: raw.date ? new Date(raw.date) : null,
      tags: raw.tags || [],
    }),
  )
}
