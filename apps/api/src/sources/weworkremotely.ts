import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'

const WWR_RSS = 'https://weworkremotely.com/remote-jobs.rss'

interface WwrJob {
  title: string
  company: string
  location: string
  url: string
  publishedAt: string
  description: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseWwrRss(xml: string): WwrJob[] {
  const jobs: WwrJob[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let itemMatch: RegExpExecArray | null

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const item = itemMatch[1]

    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/)
    const companyMatch = item.match(/<company[^>]*>([\s\S]*?)<\/company>/)
    const locationMatch = item.match(/<location[^>]*>([\s\S]*?)<\/location>/)
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/)
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)
    const descriptionMatch = item.match(/<description>([\s\S]*?)<\/description>/)

    if (titleMatch && linkMatch) {
      jobs.push({
        title: stripHtml(titleMatch[1]),
        company: companyMatch ? stripHtml(companyMatch[1]) : 'Empresa não informada',
        location: locationMatch ? stripHtml(locationMatch[1]) : '',
        url: stripHtml(linkMatch[1]),
        publishedAt: pubDateMatch ? stripHtml(pubDateMatch[1]) : '',
        description: descriptionMatch ? stripHtml(descriptionMatch[1]) : '',
      })
    }
  }

  return jobs
}

export async function fetchWeWorkRemotely(query: SourceQuery): Promise<NormalizedJob[]> {
  const response = await fetch(WWR_RSS, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
    },
  })

  if (!response.ok) {
    console.warn(`WeWorkRemotely RSS error: ${response.status} ${response.statusText}`)
    return []
  }

  const xml = await response.text()
  const rawJobs = parseWwrRss(xml)

  const filtered = rawJobs.filter((job) => {
    if (query.keywords.length === 0) return true
    const text = `${job.title} ${job.company} ${job.description}`.toLowerCase()
    return query.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  })

  const limit = query.limit ?? 50
  const jobs: NormalizedJob[] = []

  for (const raw of filtered.slice(0, limit)) {
    jobs.push(
      normalizeJobFields({
        title: raw.title,
        company: raw.company,
        description: raw.description,
        location: raw.location || null,
        url: raw.url,
        externalId: raw.url,
        publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
        tags: ['remote', 'weworkremotely'],
      }),
    )
  }

  return jobs
}
