import type { JobSource, SourceQuery, NormalizedJob } from '@job-radar/shared';
import { fetchRemoteOk } from './remote-ok.js';
import { fetchRemotive } from './remotive.js';
import { fetchLinkedIn } from './linkedin.js';
import { fetchGoogleJobs } from './google-jobs.js';
import { fetchIndeed } from './indeed.js';
import { fetchLinkedInJobs } from './reddit.js';
import { fetchAdzuna } from './adzuna.js';
import { fetchJobicy } from './jobicy.js';
import { fetchWeWorkRemotely } from './weworkremotely.js';

class RemoteOkSource implements JobSource {
  id = 'remoteok';
  name = 'RemoteOK';
  description = 'Vagas remotas em tecnologia diretamente do JSON público do RemoteOK. Baixa manutenção e boa cobertura para devs.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchRemoteOk(query);
  }
}

class RemotiveSource implements JobSource {
  id = 'remotive';
  name = 'Remotive';
  description = 'Vagas remotas curadas pela Remotive, com foco em tecnologia e alta qualidade de listagens.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchRemotive(query);
  }
}

class LinkedInSource implements JobSource {
  id = 'linkedin';
  name = 'LinkedIn';
  description = 'Busca em páginas públicas do LinkedIn Jobs via scraping guest. Cobertura limitada a ~100 vagas por query e sujeita a bloqueios.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchLinkedIn(query);
  }
}

class GoogleJobsSource implements JobSource {
  id = 'google-jobs';
  name = 'Google Jobs';
  description = 'Vagas agregadas pelo Google Jobs. Boa cobertura geral, mas menos filtros avançados que boards especializados.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchGoogleJobs(query);
  }
}

class IndeedSource implements JobSource {
  id = 'indeed';
  name = 'Indeed';
  description = 'Agregador de vagas com foco em mercado geral e Brasil. Volume alto, mas scraping mais sujeito a mudanças.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchIndeed(query);
  }
}

class AdzunaSource implements JobSource {
  id = 'adzuna';
  name = 'Adzuna';
  description = 'API oficial do Adzuna com free tier de 1k chamadas/mês. Agrega vagas em 16+ países, incluindo Brasil, com dados estruturados.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchAdzuna(query);
  }
}

class JobicySource implements JobSource {
  id = 'jobicy';
  name = 'Jobicy';
  description = 'Vagas remotas em tecnologia direto da API pública do Jobicy. Sem autenticação, com filtros por país, categoria e keyword.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchJobicy(query);
  }
}

class WeWorkRemotelySource implements JobSource {
  id = 'weworkremotely';
  name = 'We Work Remotely';
  description = 'Board remoto curado, com foco em tecnologia e empresas remotas-first. Dados vindos do RSS público.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchWeWorkRemotely(query);
  }
}

class ManualSource implements JobSource {
  id = 'manual'
  name = 'Manual'
  description = 'Vagas adicionadas manualmente pelo usuário a partir de LinkedIn, indicações ou outras fontes.'

  async fetch(_query: SourceQuery): Promise<NormalizedJob[]> {
    return []
  }
}

class RedditSource implements JobSource {
  id = 'linkedin-apify'
  name = 'LinkedIn (Apify API)'
  description = 'Busca no LinkedIn via Apify Actor. Retorna mais resultados que o scraping guest direto, mas depende de token e custo por resultado.'

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchLinkedInJobs(query)
  }
}

const sources: Map<string, JobSource> = new Map([
  [new RemoteOkSource().id, new RemoteOkSource()],
  [new RemotiveSource().id, new RemotiveSource()],
  [new LinkedInSource().id, new LinkedInSource()],
  [new GoogleJobsSource().id, new GoogleJobsSource()],
  [new IndeedSource().id, new IndeedSource()],
  [new AdzunaSource().id, new AdzunaSource()],
  [new JobicySource().id, new JobicySource()],
  [new WeWorkRemotelySource().id, new WeWorkRemotelySource()],
  [new ManualSource().id, new ManualSource()],
  [new RedditSource().id, new RedditSource()],
]);

export function getSource(id: string): JobSource | undefined {
  return sources.get(id);
}

export function getAllSources(): JobSource[] {
  return Array.from(sources.values());
}

export function registerSource(source: JobSource): void {
  sources.set(source.id, source);
}

export async function collectFromSource(
  sourceId: string,
  query: SourceQuery,
): Promise<{ sourceId: string; jobs: NormalizedJob[]; error?: string }> {
  const source = getSource(sourceId);
  if (!source) {
    return { sourceId, jobs: [], error: `Source '${sourceId}' not found` };
  }

  try {
    const jobs = await source.fetch(query);
    return { sourceId, jobs };
  } catch (err) {
    return {
      sourceId,
      jobs: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function collectFromAllSources(
  query: SourceQuery,
): Promise<Array<{ sourceId: string; jobs: NormalizedJob[]; error?: string }>> {
  const sources = getAllSources();
  return Promise.all(sources.map((s) => collectFromSource(s.id, query)));
}
