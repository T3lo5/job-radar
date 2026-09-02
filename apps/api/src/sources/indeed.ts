import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields, parseDate, stripHtml } from './normalizer.js'

const INDEED_SEARCH = 'https://www.indeed.com/jobs'
const INDEED_BRAZIL_SEARCH = 'https://br.indeed.com/vagas'

interface IndeedJob {
  title: string
  company: string
  location: string
  description: string
  url: string
  datePosted: string
  salary?: string
  jobKey: string
}

export async function fetchIndeed(query: SourceQuery): Promise<NormalizedJob[]> {
  const keywords = query.keywords.length > 0 ? query.keywords.join(' ') : 'developer'
  const location = query.remoteOnly ? '' : 'Brazil'
  const isBrazil = !query.remoteOnly

  const baseUrl = isBrazil ? INDEED_BRAZIL_SEARCH : INDEED_SEARCH
  const url = new URL(baseUrl)
  url.searchParams.set('q', keywords)
  if (location) {
    url.searchParams.set('l', location)
  }
  if (query.limit) {
    url.searchParams.set('limit', String(query.limit))
  }
  if (query.remoteOnly) {
    url.searchParams.set('remotejob', '032b3046-06a3-4876-8dfd-474eb5e7ed11')
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': isBrazil ? 'pt-BR,pt;q=0.9' : 'en-US,en;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(`Indeed error: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const jobs = parseIndeedHtml(html)
  return jobs.map((raw) =>
    normalizeJobFields({
      title: raw.title,
      company: raw.company,
      description: raw.description,
      location: raw.location || null,
      salary: raw.salary,
      url: raw.url,
      externalId: raw.jobKey,
      publishedAt: parseDate(raw.datePosted),
      tags: [],
    }),
  )
}

function parseIndeedHtml(html: string): IndeedJob[] {
  const jobs: IndeedJob[] = []

  const scriptPattern = /window\._initialData\s*=\s*(\{[\s\S]*?\})\s*<\/script>/g
  let match: RegExpExecArray | null

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const jobList = data?.jobList || data?.searchResults?.results || []

      for (const job of jobList) {
        if (job.title && job.company) {
          jobs.push({
            title: job.title,
            company: job.company,
            location: job.location || job.formattedLocation || '',
            description: job.snippet || job.description || '',
            url: job.url || job.jobUrl || '',
            datePosted: job.datePosted || job.formattedRelativeTime || '',
            salary: job.salary || job.formattedSalary,
            jobKey: job.jobKey || job.key || '',
          })
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  if (jobs.length === 0) {
    const cardJobs = parseIndeedCards(html)
    jobs.push(...cardJobs)
  }

  return jobs
}

function parseIndeedCards(html: string): IndeedJob[] {
  const jobs: IndeedJob[] = []

  const cardPattern = /<div[^>]*data-jk="([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
  let match: RegExpExecArray | null

  while ((match = cardPattern.exec(html)) !== null) {
    const jobKey = match[1]
    const cardHtml = match[2]

    const titleMatch = cardHtml.match(/<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)
    const companyMatch = cardHtml.match(/<span[^>]*class="[^"]*companyName[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const locationMatch = cardHtml.match(/<div[^>]*class="[^"]*companyLocation[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const salaryMatch = cardHtml.match(/<div[^>]*class="[^"]*salary-snippet-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const dateMatch = cardHtml.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i)

    if (titleMatch && companyMatch) {
      jobs.push({
        title: stripHtml(titleMatch[1]),
        company: stripHtml(companyMatch[1]),
        location: locationMatch ? stripHtml(locationMatch[1]) : '',
        description: '',
        url: `https://www.indeed.com/viewjob?jk=${jobKey}`,
        datePosted: dateMatch ? stripHtml(dateMatch[1]) : '',
        salary: salaryMatch ? stripHtml(salaryMatch[1]) : undefined,
        jobKey,
      })
    }
  }

  return jobs
}
