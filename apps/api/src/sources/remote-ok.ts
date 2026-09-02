import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'

const REMOTEOK_API = 'https://remoteok.com/api'

interface RemoteOkJob {
  slug: string
  company: string
  position: string
  description: string
  location: string
  tags: string[]
  date: string
  salary?: string
  url: string
}

export async function fetchRemoteOk(query: SourceQuery): Promise<NormalizedJob[]> {
  const url = new URL(REMOTEOK_API)
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
    throw new Error(`RemoteOK API error: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RemoteOkJob[]

  const jobs = data.filter((item) => item.slug && item.position)

  return jobs.map((raw) =>
    normalizeJobFields({
      title: raw.position,
      company: raw.company,
      description: raw.description,
      location: raw.location || null,
      salary: raw.salary,
      url: raw.url || `https://remoteok.com/remote-jobs/${raw.slug}`,
      externalId: raw.slug,
      publishedAt: raw.date ? new Date(raw.date) : null,
      tags: raw.tags || [],
    }),
  )
}
