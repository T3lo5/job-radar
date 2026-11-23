import type { NormalizedJob, SourceQuery } from '@job-radar/shared';
import { normalizeJobFields } from './normalizer.js';
import { fetchWithTimeout } from '../utils/http.js';

/**
 * Hacker News "Who is Hiring" via API pública do Algolia (mesmo backend do
 * busca do HN). Não exige token e devolve JSON estruturado.
 *
 * Usamos `search_by_date` para pegar as postagens mais recentes primeiro;
 * `tags=job` restringe ao feed de vagas (os posts "X (YC W24) Is Hiring").
 */
const HN_SEARCH_API = 'https://hn.algolia.com/api/v1/search_by_date';

interface HNHit {
  objectID: string;
  title?: string;
  url?: string;
  author?: string;
  created_at?: string;
  job_text?: string | null;
  story_text?: string | null;
  comment_text?: string | null;
}

interface HNResponse {
  hits: HNHit[];
  nbHits: number;
}

interface ParsedHNJob {
  title: string;
  company: string;
  description: string;
  url: string;
  publishedAt: string;
  externalId: string;
}

/**
 * Extrai o nome da empresa do título no formato "Empresa (YC W24) Is Hiring..."
 * ou "Empresa Is Hiring...". Cai no autor do post quando não dá para inferir.
 */
function parseCompany(title: string, author: string | undefined): string {
  const parenMatch = title.match(/^(.+?)\s*\([^)]*\)/);
  if (parenMatch) return parenMatch[1].trim();

  const isHiringMatch = title.match(/^(.+?)\s+is hiring/i);
  if (isHiringMatch) return isHiringMatch[1].trim();

  return author || 'Empresa não informada';
}

function parseHnResponse(data: HNResponse): ParsedHNJob[] {
  const jobs: ParsedHNJob[] = [];

  for (const hit of data.hits) {
    const title = hit.title?.trim();
    if (!title) continue;

    const description = hit.job_text || hit.story_text || hit.comment_text || '';

    jobs.push({
      title,
      company: parseCompany(title, hit.author),
      description,
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      publishedAt: hit.created_at || '',
      externalId: hit.objectID,
    });
  }

  return jobs;
}

export async function fetchHackerNews(query: SourceQuery): Promise<NormalizedJob[]> {
  const url = new URL(HN_SEARCH_API);
  url.searchParams.set('tags', 'job');
  url.searchParams.set('hitsPerPage', String(Math.min(query.limit ?? 50, 200)));
  if (query.keywords.length > 0) {
    url.searchParams.set('query', query.keywords.join(' '));
  }

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.warn(`HackerNews API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as HNResponse;
  const jobs = parseHnResponse(data).map((raw) =>
    normalizeJobFields({
      title: raw.title,
      company: raw.company,
      description: raw.description,
      location: null,
      url: raw.url,
      externalId: raw.externalId,
      publishedAt: raw.publishedAt ? new Date(raw.publishedAt) : null,
      tags: ['hackernews', 'whoishiring'],
    }),
  );

  return jobs;
}
