import type { JobSource, SourceQuery, NormalizedJob } from '@job-radar/shared';
import { settingsService } from '../services/settings-service.js';
import { SETTINGS_SCOPE, sourceEnabledKey } from '../services/settings-keys.js';
import { fetchRemoteOk } from './remote-ok.js';
import { fetchRemotive } from './remotive.js';
import { fetchLinkedIn } from './linkedin.js';
import { fetchIndeed } from './indeed.js';
import { fetchLinkedInJobs } from './linkedin-apify.js';
import { fetchAdzuna } from './adzuna.js';
import { fetchJobicy } from './jobicy.js';
import { fetchWeWorkRemotely } from './weworkremotely.js';
import { fetchWellfound } from './wellfound.js';
import { fetchHackerNews } from './hackernews.js';
import { fetchDribbble } from './dribbble.js';

class RemoteOkSource implements JobSource {
  id = 'remoteok';
  name = 'RemoteOK';
  description =
    'Vagas remotas em tecnologia diretamente do JSON público do RemoteOK. Baixa manutenção e boa cobertura para devs.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchRemoteOk(query);
  }
}

class RemotiveSource implements JobSource {
  id = 'remotive';
  name = 'Remotive';
  description =
    'Vagas remotas curadas pela Remotive, com foco em tecnologia e alta qualidade de listagens.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchRemotive(query);
  }
}

class LinkedInSource implements JobSource {
  id = 'linkedin';
  name = 'LinkedIn';
  description =
    'Busca em páginas públicas do LinkedIn Jobs via scraping guest. Cobertura limitada a ~100 vagas por query e sujeita a bloqueios.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchLinkedIn(query);
  }
}

class IndeedSource implements JobSource {
  id = 'indeed';
  name = 'Indeed';
  description =
    'Agregador de vagas com foco em mercado geral e Brasil. Volume alto, mas scraping mais sujeito a mudanças.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchIndeed(query);
  }
}

class AdzunaSource implements JobSource {
  id = 'adzuna';
  name = 'Adzuna';
  description =
    'API oficial do Adzuna com free tier de 1k chamadas/mês. Agrega vagas em 16+ países, incluindo Brasil, com dados estruturados.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchAdzuna(query);
  }
}

class JobicySource implements JobSource {
  id = 'jobicy';
  name = 'Jobicy';
  description =
    'Vagas remotas em tecnologia direto da API pública do Jobicy. Sem autenticação, com filtros por país, categoria e keyword.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchJobicy(query);
  }
}

class WeWorkRemotelySource implements JobSource {
  id = 'weworkremotely';
  name = 'We Work Remotely';
  description =
    'Board remoto curado, com foco em tecnologia e empresas remotas-first. Dados vindos do RSS público.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchWeWorkRemotely(query);
  }
}

class WellfoundSource implements JobSource {
  id = 'wellfound';
  name = 'Wellfound';
  description =
    'Vagas de startups e tecnologia do Wellfound (ex-AngelList). Boa cobertura para empresas early-stage e remotas.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchWellfound(query);
  }
}

class HackerNewsSource implements JobSource {
  id = 'hackernews';
  name = 'Hacker News (Who is Hiring)';
  description =
    'Feed "Who is Hiring" do Hacker News via API pública do Algolia. Posts diretos de startups (muitas YC), perfil técnico. Sem autenticação.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchHackerNews(query);
  }
}

class DribbbleSource implements JobSource {
  id = 'dribbble';
  name = 'Dribbble';
  description =
    'Vagas de design e criação do board público do Dribbble. Foco em produto visual, UX/UI e branding.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchDribbble(query);
  }
}

class LinkedInApifySource implements JobSource {
  id = 'linkedin-apify';
  name = 'LinkedIn (Apify API)';
  description =
    'Busca no LinkedIn via Apify Actor. Retorna mais resultados que o scraping guest direto, mas depende de token e custo por resultado.';

  async fetch(query: SourceQuery): Promise<NormalizedJob[]> {
    return fetchLinkedInJobs(query);
  }
}

class ManualSource implements JobSource {
  id = 'manual';
  name = 'Manual';
  description =
    'Vagas adicionadas manualmente pelo usuário a partir de LinkedIn, indicações ou outras fontes.';

  async fetch(_query: SourceQuery): Promise<NormalizedJob[]> {
    return [];
  }
}

const sources: Map<string, JobSource> = new Map([
  [new RemoteOkSource().id, new RemoteOkSource()],
  [new RemotiveSource().id, new RemotiveSource()],
  [new LinkedInSource().id, new LinkedInSource()],
  [new IndeedSource().id, new IndeedSource()],
  [new AdzunaSource().id, new AdzunaSource()],
  [new JobicySource().id, new JobicySource()],
  [new WeWorkRemotelySource().id, new WeWorkRemotelySource()],
  [new WellfoundSource().id, new WellfoundSource()],
  [new HackerNewsSource().id, new HackerNewsSource()],
  [new DribbbleSource().id, new DribbbleSource()],
  [new ManualSource().id, new ManualSource()],
  [new LinkedInApifySource().id, new LinkedInApifySource()],
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

/**
 * Fontes habilitadas segundo os settings `source_<id>_enabled`.
 *
 * Setting ausente = habilitada: é o estado de uma instalação nova e o que a UI
 * mostra. Só o valor exato `'false'` desliga.
 */
export async function getEnabledSourceIds(): Promise<Set<string>> {
  const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES);
  return new Set(
    getAllSources()
      .filter((source) => settings[sourceEnabledKey(source.id)] !== 'false')
      .map((source) => source.id),
  );
}

export interface CollectFromAllOptions {
  /**
   * Quando já calculado pelo chamador, evita reler os settings a cada camada de
   * busca. Ausente, a própria função lê — assim qualquer call site respeita o
   * toggle, não só `runCollection`.
   */
  enabledSourceIds?: ReadonlySet<string>;
}

export async function collectFromAllSources(
  query: SourceQuery,
  options: CollectFromAllOptions = {},
): Promise<Array<{ sourceId: string; jobs: NormalizedJob[]; error?: string }>> {
  const enabled = options.enabledSourceIds ?? (await getEnabledSourceIds());
  // Antes o laço usava `getAllSources()` direto: desligar a fonte na UI mudava
  // só a tela, e a coleta continuava gastando rate limit nela.
  const sources = getAllSources().filter((source) => enabled.has(source.id));
  return Promise.all(sources.map((s) => collectFromSource(s.id, query)));
}
