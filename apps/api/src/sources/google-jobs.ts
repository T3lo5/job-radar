import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields, parseDate, decodeHtmlEntities } from './normalizer.js'

const GOOGLE_JOBS_SEARCH = 'https://www.google.com/search'

interface GoogleJobData {
  title: string
  company: string
  location: string
  description: string
  url: string
  datePosted: string
  salary?: string
}

export async function fetchGoogleJobs(query: SourceQuery): Promise<NormalizedJob[]> {
  const keywords = query.keywords.length > 0 ? query.keywords.join(' ') : 'developer'
  const location = query.remoteOnly ? '' : 'Brazil'

  const url = `${GOOGLE_JOBS_SEARCH}?q=${encodeURIComponent(keywords)}&ibp=htl;jobs&hl=pt-BR&gl=br&location=${encodeURIComponent(location)}`

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(`Google Jobs error: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const jobs = parseGoogleJobsHtml(html)
  return jobs.map((raw) =>
    normalizeJobFields({
      title: raw.title,
      company: raw.company,
      description: raw.description,
      location: raw.location || null,
      salary: raw.salary,
      url: raw.url,
      publishedAt: parseDate(raw.datePosted),
      tags: [],
    }),
  )
}

function parseGoogleJobsHtml(html: string): GoogleJobData[] {
  const jobs: GoogleJobData[] = []

  const jobPattern = /\[1,\[1,"([^"]+)","([^"]+)","([^"]*)","([^"]*)",null,null,null,"([^"]*)"\]/g
  let match: RegExpExecArray | null

  while ((match = jobPattern.exec(html)) !== null) {
    const [, title, company, location, description, , url] = match
    if (title && company) {
      jobs.push({
        title: decodeHtmlEntities(title),
        company: decodeHtmlEntities(company),
        location: decodeHtmlEntities(location || ''),
        description: decodeHtmlEntities(description || ''),
        url: url || '',
        datePosted: '',
      })
    }
  }

  if (jobs.length === 0) {
    const structuredData = extractStructuredData(html)
    jobs.push(...structuredData)
  }

  return jobs
}

function extractStructuredData(html: string): GoogleJobData[] {
  const jobs: GoogleJobData[] = []
  const ldJsonPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let match: RegExpExecArray | null

  while ((match = ldJsonPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'JobPosting') {
        jobs.push({
          title: data.title || '',
          company: data.hiringOrganization?.name || '',
          location: data.jobLocation?.address?.addressLocality || '',
          description: data.description || '',
          url: data.url || '',
          datePosted: data.datePosted || '',
          salary: data.baseSalary?.value
            ? `${data.baseSalary.value.minValue || data.baseSalary.value.value} - ${data.baseSalary.value.maxValue || data.baseSalary.value.value}`
            : undefined,
        })
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return jobs
}
