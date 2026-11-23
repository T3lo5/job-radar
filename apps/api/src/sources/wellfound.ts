import type { NormalizedJob, SourceQuery } from '@job-radar/shared';
import { normalizeJobFields, parseDate, stripHtml } from './normalizer.js';
import { fetchWithTimeout } from '../utils/http.js';

const WELLFOUND_SEARCH = 'https://wellfound.com/jobs';

interface WellfoundJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  datePosted: string;
  salary?: string;
  jobKey: string;
}

export async function fetchWellfound(query: SourceQuery): Promise<NormalizedJob[]> {
  const keywords = query.keywords.length > 0 ? query.keywords.join(' ') : 'developer';
  const location = query.remoteOnly ? 'remote' : 'Brazil';

  const url = new URL(WELLFOUND_SEARCH);
  url.searchParams.set('q', keywords);
  url.searchParams.set('location', location);
  if (query.limit) {
    url.searchParams.set('limit', String(query.limit));
  }

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });

  if (!response.ok) {
    console.warn(`Wellfound error: ${response.status} ${response.statusText}`);
    return [];
  }

  const html = await response.text();
  const jobs = parseWellfoundHtml(html);
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
  );
}

function parseWellfoundHtml(html: string): WellfoundJob[] {
  const jobs: WellfoundJob[] = [];

  const scriptPattern = /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/g;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const jobList = data?.jobs?.results || data?.jobListings || [];

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
            jobKey: job.jobKey || job.key || job.id || '',
          });
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  if (jobs.length === 0) {
    const cardJobs = parseWellfoundCards(html);
    jobs.push(...cardJobs);
  }

  return jobs;
}

function parseWellfoundCards(html: string): WellfoundJob[] {
  const jobs: WellfoundJob[] = [];

  const cardPattern = /<div[^>]*class="[^"]*job-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let match: RegExpExecArray | null;

  while ((match = cardPattern.exec(html)) !== null) {
    const cardHtml = match[1];

    const titleMatch = cardHtml.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const companyMatch = cardHtml.match(
      /<span[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const locationMatch = cardHtml.match(
      /<span[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
    );
    const linkMatch = cardHtml.match(/<a[^>]*href="([^"]*)"[^>]*>/i);

    if (titleMatch && companyMatch && linkMatch) {
      jobs.push({
        title: stripHtml(titleMatch[1]),
        company: stripHtml(companyMatch[1]),
        location: locationMatch ? stripHtml(locationMatch[1]) : '',
        description: '',
        url: linkMatch[1].startsWith('http')
          ? linkMatch[1]
          : `https://wellfound.com${linkMatch[1]}`,
        datePosted: '',
        salary: undefined,
        jobKey: linkMatch[1].split('/').pop() || '',
      });
    }
  }

  return jobs;
}
