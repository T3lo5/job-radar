import type { NormalizedJob, SourceQuery } from '@job-radar/shared'
import { normalizeJobFields } from './normalizer.js'

const LINKEDIN_GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

interface LinkedInGuestJob {
  title: string
  company: string
  location: string
  link: string
  listedAt: string
}

export async function fetchLinkedIn(query: SourceQuery): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = []
  const keywords = query.keywords.length > 0 ? query.keywords.join('%20') : 'developer'
  const location = query.remoteOnly ? 'remote' : 'Brazil'
  const maxResults = query.limit ?? 50
  const pageSize = 25

  let start = 0

  while (jobs.length < maxResults) {
    const url = `${LINKEDIN_GUEST_API}?keywords=${keywords}&location=${location}&start=${start}`

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
        },
      })

      if (response.status === 429) {
        console.warn('LinkedIn rate limit reached (429). Stopping collection.')
        break
      }

      if (!response.ok) {
        throw new Error(`LinkedIn guest API error: ${response.status}`)
      }

      const html = await response.text()
      const pageJobs = parseLinkedInGuestHtml(html)

      if (pageJobs.length === 0) {
        break
      }

      jobs.push(
        ...pageJobs.map((raw) =>
          normalizeJobFields({
            title: raw.title,
            company: raw.company,
            description: '',
            location: raw.location || null,
            url: raw.link,
            externalId: raw.link.split('?')[0]?.split('-').pop() || String(Date.now()),
            publishedAt: raw.listedAt ? new Date(raw.listedAt) : null,
            tags: [],
          }),
        ),
      )

      start += pageSize

      if (jobs.length < maxResults) {
        await randomDelay(2000, 8000)
      }
    } catch (err) {
      console.error('LinkedIn fetch error:', err)
      break
    }
  }

  return jobs.slice(0, maxResults)
}

function parseLinkedInGuestHtml(html: string): LinkedInGuestJob[] {
  const jobs: LinkedInGuestJob[] = []

  const liPattern = /<li>([\s\S]*?)<\/li>/g
  let liMatch: RegExpExecArray | null

  while ((liMatch = liPattern.exec(html)) !== null) {
    const cardHtml = liMatch[1]

    const titleMatch = cardHtml.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)
    const companyMatch = cardHtml.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i)
    const locationMatch = cardHtml.match(/<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const linkMatch = cardHtml.match(/<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[^>]*>/i)
    const timeMatch = cardHtml.match(/<time[^>]*class="[^"]*job-search-card__listdate[^"]*"[^>]*datetime="([^"]*)"[^>]*>/i)

    if (titleMatch) {
      jobs.push({
        title: stripHtml(titleMatch[1]),
        company: companyMatch ? stripHtml(companyMatch[1]) : 'Empresa não divulgada',
        location: locationMatch ? stripHtml(locationMatch[1]) : '',
        link: linkMatch?.[1] || 'https://www.linkedin.com/jobs',
        listedAt: timeMatch?.[1] || '',
      })
    }
  }

  return jobs
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

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, delay))
}
