import type { NormalizedJob, SourceQuery } from '@job-radar/shared';
import { normalizeJobFields, parseDate, stripHtml } from './normalizer.js';
import { fetchWithTimeout } from '../utils/http.js';

const DRIBBBLE_JOBS = 'https://dribbble.com/jobs';

interface DribbbleJob {
  title: string;
  company: string;
  location: string;
  url: string;
  jobKey: string;
}

/**
 * Dribbble não tem API pública de vagas; o board `/jobs` é HTML estático com
 * um `<li class="job-list-item">` por vaga. Extraímos os campos por regex
 * ancorada nas classes que o Dribbble usa hoje:
 *   - `.job-board-job-title`  → título
 *   - `.job-board-job-company` → empresa
 *   - `.job-link[href]`        → âncora do card (id e slug)
 */
export function parseDribbbleHtml(html: string): DribbbleJob[] {
  const jobs: DribbbleJob[] = [];

  const itemPattern = /<li[^>]*class="[^"]*job-list-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemPattern.exec(html)) !== null) {
    const item = itemMatch[1];

    const linkMatch = item.match(/class="[^"]*job-link[^"]*"[^>]*href="([^"]+)"/);
    const titleMatch = item.match(/class="[^"]*job-board-job-title[^"]*"[^>]*>([\s\S]*?)<\//);
    const companyMatch = item.match(/class="[^"]*job-board-job-company[^"]*"[^>]*>([\s\S]*?)<\//);
    const locationMatch = item.match(
      /class="[^"]*color-deep-blue-sea-light-40[^"]*"[^>]*>([\s\S]*?)<\//,
    );

    if (!linkMatch || !titleMatch) continue;

    const href = linkMatch[1];
    const jobKey = href.match(/\/jobs\/(\d+)/)?.[1] ?? href;

    jobs.push({
      title: stripHtml(titleMatch[1]),
      company: companyMatch ? stripHtml(companyMatch[1]) : 'Empresa não informada',
      location: locationMatch ? stripHtml(locationMatch[1]) : '',
      url: href.startsWith('http') ? href : `https://dribbble.com${href.split('?')[0]}`,
      jobKey,
    });
  }

  return jobs;
}

export async function fetchDribbble(query: SourceQuery): Promise<NormalizedJob[]> {
  const url = new URL(DRIBBBLE_JOBS);

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    console.warn(`Dribbble error: ${response.status} ${response.statusText}`);
    return [];
  }

  const html = await response.text();
  const rawJobs = parseDribbbleHtml(html);

  const filtered = rawJobs.filter((job) => {
    if (query.keywords.length === 0) return true;
    const text = `${job.title} ${job.company}`.toLowerCase();
    return query.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });

  const limit = query.limit ?? 50;

  return filtered.slice(0, limit).map((raw) =>
    normalizeJobFields({
      title: raw.title,
      company: raw.company,
      description: '',
      location: raw.location || null,
      url: raw.url,
      externalId: raw.jobKey,
      publishedAt: parseDate(''),
      tags: ['dribbble', 'design'],
    }),
  );
}
