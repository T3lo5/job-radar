import type { NormalizedJob, SourceQuery } from '@job-radar/shared';
import { parseRemoteMode } from './normalizer.js';
import { settingsService } from '../services/settings-service.js';
import { SETTINGS_SCOPE, APIFY_SETTINGS } from '../services/settings-keys.js';
import { fetchWithTimeout } from '../utils/http.js';

const DEFAULT_APIFY_ACTOR_URL =
  'https://api.apify.com/v2/acts/curious_coder~linkedin-jobs-scraper/run-sync-get-dataset-items';

/**
 * Hosts aceitos para o `baseUrl` configurado.
 *
 * O valor vem do settings (digitado pelo usuário) e era usado como destino do
 * POST com o token do Apify. Sem allowlist, um `baseUrl` qualquer recebia o
 * token — e como o token ia na query string, ele também aparecia em log de
 * proxy, histórico e mensagem de erro. Agora o token vai no header
 * `Authorization` e o destino tem que ser https em api.apify.com.
 */
const APIFY_ALLOWED_HOSTS = new Set(['api.apify.com']);

/**
 * Valida o `baseUrl` do Apify. Devolve `null` quando não é permitido e o
 * default quando não há valor configurado. Query e hash são descartados: o
 * endpoint do ator não usa nenhum dos dois.
 */
export function resolveApifyBaseUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.trim() === '') return DEFAULT_APIFY_ACTOR_URL;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (!APIFY_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.username || url.password) return null;

  url.search = '';
  url.hash = '';

  return url.toString();
}

interface ApifyJob {
  title?: string;
  company?: string;
  companyUrl?: string;
  location?: string;
  description?: { text?: string } | string;
  url?: string;
  datePosted?: string;
  salary?: string;
  jobPoster?: { name?: string; title?: string };
  applicants?: number;
  experienceLevel?: string;
  employmentType?: string;
  workplaceType?: string;
  sectors?: string[];
  companyId?: string;
  linkedinJobId?: string;
  [key: string]: unknown;
}

type ApifyResponse = ApifyJob[];

export async function fetchLinkedInJobs(query: SourceQuery): Promise<NormalizedJob[]> {
  let token = await settingsService.get(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN);
  if (!token) {
    token = process.env.APIFY_TOKEN ?? null;
  }
  if (!token) {
    console.warn('Apify token not configured, skipping LinkedIn Jobs scrape');
    return [];
  }
  if (token === '********') {
    return [];
  }

  const configuredBaseUrl = await settingsService.get(
    SETTINGS_SCOPE.APIFY,
    APIFY_SETTINGS.BASE_URL,
  );
  const baseUrl = resolveApifyBaseUrl(configuredBaseUrl);
  if (!baseUrl) {
    // Não ecoa o valor configurado: ele pode conter token colado por engano.
    console.warn('Apify baseUrl inválida; use https://api.apify.com/... — coleta ignorada');
    return [];
  }

  const jobs: NormalizedJob[] = [];

  try {
    const keywords = query.keywords.length > 0 ? query.keywords.join(' ') : 'developer';

    const response = await fetchWithTimeout(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        keywords,
        location: 'Brazil',
        limitPerSource: 100,
        datePosted: 'pastWeek',
        autoConvertToAiSearch: true,
        scrapeCompany: false,
      }),
    });

    if (!response.ok) {
      console.warn(`Apify API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as ApifyResponse;

    for (const item of data) {
      if (!item.title) continue;

      const description =
        typeof item.description === 'string' ? item.description : item.description?.text || '';

      jobs.push({
        title: item.title,
        company: item.company || item.companyUrl || 'Empresa não informada',
        description,
        location: item.location || null,
        remote: parseRemoteMode(item.workplaceType || description),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        url: item.url || `https://www.linkedin.com/jobs/view/${item.linkedinJobId || ''}`,
        externalId: `apify-${item.linkedinJobId || Date.now().toString()}`,
        publishedAt: item.datePosted ? new Date(item.datePosted) : new Date(),
        tags: ['linkedin', 'apify', ...(item.sectors || [])],
      });
    }
  } catch (err) {
    console.error('Error fetching LinkedIn jobs via Apify:', err);
  }

  return jobs;
}
