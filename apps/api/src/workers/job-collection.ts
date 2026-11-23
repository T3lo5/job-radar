import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import cronParser from 'cron-parser';
import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { collectFromAllSources, getAllSources } from '../sources/index.js';
import { settingsService } from '../services/settings-service.js';
import { sendDailyReport } from '../services/daily-report.js';
import { enqueueJobPipeline } from './processing.js';
import { persistSourceJobs, type JobCandidate } from './job-persistence.js';
import { detectSeniority } from '../utils/seniority.js';
import { createLocationFilter } from '../utils/location-filter.js';
import { createJobFilter } from '../utils/job-filter.js';
import { buildSearchKeywords } from '../utils/search-strategy.js';
import {
  SETTINGS_SCOPE,
  CRON_SETTINGS,
  DEFAULT_CRON,
  sourceEnabledKey,
} from '../services/settings-keys.js';
import { redisConnectionOptions, WORKER_LOCK_OPTIONS } from '../db/redis-connection.js';
import { BACKOFF_TYPE, BACKOFF_WORKER_SETTINGS, MAX_ATTEMPTS } from './backoff.js';

const QUEUE_NAME = 'job-collection';
const JOB_NAME = 'collect-jobs';
const REPORT_NAME = 'send-daily-report';
const MIN_TOTAL_JOBS = 10;

function getConnection(): ConnectionOptions {
  return redisConnectionOptions() as ConnectionOptions;
}

function computeHash(job: { title: string; company: string; url: string }): string {
  const content = `${job.title}|${job.company}|${job.url}`;
  return createHash('sha256').update(content).digest('hex');
}

export const jobCollectionQueue = new Queue(QUEUE_NAME, {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: BACKOFF_TYPE },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

/**
 * Resolve (ou cria) a JobSource pelo nome da fonte.
 *
 * Eram 2 queries por fonte a cada coleta, mesmo com a fonte ja cadastrada.
 * Sao ~9 fontes, entao o ganho e pequeno comparado ao lote de vagas, mas o
 * `create` podia falhar por corrida entre duas coletas.
 */
async function ensureJobSource(name: string) {
  const existing = await prisma.jobSource.findFirst({ where: { name } });
  if (existing) return existing;

  return prisma.jobSource.create({
    data: { name, type: 'api', baseUrl: null, enabled: true },
  });
}

export function isValidCronExpression(expression: string): boolean {
  if (!expression.trim()) return false;
  try {
    cronParser.parseExpression(expression);
    return true;
  } catch {
    return false;
  }
}

/** Próxima execução do padrão, ou `null` se o padrão salvo for inválido. */
export function nextRunFor(expression: string): string | null {
  try {
    return cronParser.parseExpression(expression).next().toDate().toISOString();
  } catch {
    return null;
  }
}

export interface CronScheduleInfo {
  jobCollectionCron: string;
  dailyReportCron: string;
  nextJobCollectionRun: string | null;
  nextDailyReportRun: string | null;
}

type SchedulerQueue = Pick<Queue, 'upsertJobScheduler'>;

/**
 * (Re)agenda coleta e relatório com o que está salvo em settings. Idempotente:
 * `upsertJobScheduler` com o mesmo id substitui o agendamento anterior.
 *
 * Antes só era chamado no boot; salvar o cron retornava 204 e nada mudava até
 * reiniciar. Recebe a fila por parâmetro para o teste exercitar a troca de
 * padrão sem Redis.
 */
export async function setupCronSchedule(
  queue: SchedulerQueue = jobCollectionQueue,
): Promise<CronScheduleInfo> {
  const collectionCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.JOB_COLLECTION)) ??
    DEFAULT_CRON.JOB_COLLECTION;
  const reportCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.DAILY_REPORT)) ??
    DEFAULT_CRON.DAILY_REPORT;

  await queue.upsertJobScheduler(
    'job-collection-scheduler',
    { pattern: collectionCron },
    { name: JOB_NAME },
  );

  await queue.upsertJobScheduler(
    'daily-report-scheduler',
    { pattern: reportCron },
    { name: REPORT_NAME },
  );

  return {
    jobCollectionCron: collectionCron,
    dailyReportCron: reportCron,
    nextJobCollectionRun: nextRunFor(collectionCron),
    nextDailyReportRun: nextRunFor(reportCron),
  };
}

/**
 * As três portas que a coleta usa para falar com o mundo de fora.
 *
 * Existiam só para isto: sem injeção, `runCollection` importava
 * `collectFromAllSources` direto e não havia como exercitá-la sem sair para a
 * rede. A cadeia de testes ia de "vaga já inserida" em diante — justamente a
 * etapa que ESCREVE no banco ficava sem cobertura.
 *
 * O default é a implementação real, então os call sites de produção
 * (`runCollection()`) não mudam.
 */
export interface CollectionDeps {
  /** Há fonte registrada? Sem nenhuma, a coleta nem começa. */
  temFontes: () => boolean;
  /** Busca as vagas nas fontes habilitadas. */
  coletar: typeof collectFromAllSources;
  /** Coloca as vagas novas no pipeline. */
  enfileirar: typeof enqueueJobPipeline;
}

const depsPadrao: CollectionDeps = {
  temFontes: () => getAllSources().length > 0,
  coletar: collectFromAllSources,
  enfileirar: enqueueJobPipeline,
};

export async function runCollection(deps: CollectionDeps = depsPadrao): Promise<{
  collected: number;
  errors: string[];
  /** Fontes consultadas nesta coleta. */
  executedSources: string[];
  /** Fontes desativadas que foram ignoradas. */
  skippedSources: string[];
}> {
  if (!deps.temFontes()) {
    return {
      collected: 0,
      errors: ['No job sources registered'],
      executedSources: [],
      skippedSources: [],
    };
  }

  const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES);

  // O toggle da UI grava `source_<id>_enabled`; até aqui a coleta ignorava isso
  // e varria todas as fontes. A leitura é feita uma vez por execução (não por
  // camada de busca) e repassada ao coletor.
  const enabledSourceIds = new Set(
    getAllSources()
      .filter((source) => settings[sourceEnabledKey(source.id)] !== 'false')
      .map((source) => source.id),
  );
  const executedSources = [...enabledSourceIds];
  const skippedSources = getAllSources()
    .filter((source) => !enabledSourceIds.has(source.id))
    .map((source) => source.id);

  if (executedSources.length === 0) {
    console.log('Collection skipped: all job sources are disabled');
    return { collected: 0, errors: [], executedSources, skippedSources };
  }

  // Coleta é global (uma varredura para a instalação), então não há usuário de
  // sessão aqui. O perfil serve só para derivar palavras-chave e filtros; usar
  // o mais antigo explicitamente evita depender da ordem que o Postgres quiser.
  const profile = await prisma.profile.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { skills: { include: { skill: true } } },
  });

  // Create location filter based on profile preference
  const locationFilter = createLocationFilter(profile?.location, profile?.remotePreference);

  const keywords = Object.entries(settings)
    .filter(([key]) => key.startsWith('keyword.'))
    .map(([, value]) => value);

  const profileSkillNames = (profile?.skills ?? []).map((ps) =>
    (ps.skill?.name ?? '').toLowerCase(),
  );

  const searchLayers = buildSearchKeywords({
    profileJobTypes: profile?.jobTypes ?? [],
    profileSeniorityList: profile?.seniorityList ?? [],
    profileSkillNames,
    settingKeywords: keywords,
  });

  let collected = 0;
  const errors: string[] = [];
  const allNewJobIds: string[] = [];
  const seenHashes = new Set<string>();
  let usedLayerIndex = -1;

  // Circuit breaker por coleta: fonte que errou numa camada é a mesma que vai
  // errar nas próximas (RemoteOK 404 de rate-limit/Cloudflare, Indeed 403 de
  // anti-robô). Sem isto, cada camada repetia o erro E martelava a fonte — o
  // que ainda aumentava a chance de 404. Errar uma vez basta; guardamos o id e
  // não o chamamos de novo nesta coleta.
  const failedSourceIds = new Set<string>();

  for (let layerIndex = 0; layerIndex < searchLayers.length; layerIndex++) {
    const layer = searchLayers[layerIndex];
    usedLayerIndex = layerIndex;

    const activeSourceIds = new Set([...enabledSourceIds].filter((id) => !failedSourceIds.has(id)));
    if (activeSourceIds.size === 0) {
      console.log('Collection stopped: every source failed in a previous layer');
      break;
    }

    const jobFilter = createJobFilter(profile, { relaxed: layer.relaxed });

    const results = await deps.coletar(
      {
        keywords: layer.keywords,
        remoteOnly: profile?.remotePreference === 'REMOTE',
      },
      // Defesa em profundidade: mesmo que o coletor não lesse os settings, ele
      // recebe aqui o conjunto já filtrado (desativadas + fontes que já falharam).
      { enabledSourceIds: activeSourceIds },
    );

    let layerCollected = 0;
    const layerErrors: string[] = [];

    for (const result of results) {
      if (result.error) {
        layerErrors.push(`Source ${result.sourceId}: ${result.error}`);
        // Marca para não repetir a chamada nas próximas camadas.
        failedSourceIds.add(result.sourceId);
        continue;
      }

      const jobSource = await ensureJobSource(result.sourceId);

      // Os filtros rodam em memoria antes de qualquer query: e mais barato
      // descartar aqui do que pagar round-trip para descobrir que a vaga nao
      // interessa.
      const candidates: JobCandidate[] = [];
      for (const job of result.jobs) {
        const hash = computeHash(job);

        // Ja vista em outro lote desta mesma coleta: pular evita contar a
        // mesma vaga duas vezes em `sourceCount`.
        if (seenHashes.has(hash)) {
          continue;
        }

        const detectedSeniority = detectSeniority(job.title);

        if (!locationFilter.isAllowed(job.location, job.description, job.remote)) {
          continue;
        }

        const filterResult = jobFilter.filter({
          title: job.title,
          description: job.description,
          seniority: detectedSeniority,
        });
        if (!filterResult.allowed) {
          continue;
        }

        candidates.push({
          title: job.title,
          company: job.company,
          description: job.description,
          location: job.location,
          remote: job.remote,
          seniority: detectedSeniority,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          url: job.url,
          externalId: job.externalId,
          publishedAt: job.publishedAt,
          hash,
        });
      }

      if (candidates.length === 0) continue;

      try {
        const outcome = await persistSourceJobs({
          prisma,
          sourceId: jobSource.id,
          candidates,
        });

        // So entra no seenHashes depois de gravar. Se o lote falhar, a vaga
        // continua elegivel na proxima fonte - igual ao comportamento de antes.
        for (const candidate of candidates) {
          seenHashes.add(candidate.hash);
        }

        allNewJobIds.push(...outcome.newJobIds);
        layerCollected += outcome.inserted;

        if (outcome.duplicateCount > 0) {
          layerErrors.push(
            `Source ${result.sourceId}: ${outcome.duplicateCount} job(s) already saved by another collection`,
          );
        }
      } catch (err) {
        // Falha de lote (constraint, conexao) atinge todas as vagas da fonte.
        // Antes cada vaga falhava sozinha; aqui vira uma entrada de erro por
        // fonte, que e o que o log da coleta mostra.
        layerErrors.push(
          `Source ${result.sourceId}: failed to persist ${candidates.length} job(s): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    collected += layerCollected;
    errors.push(...layerErrors);

    if (collected >= MIN_TOTAL_JOBS) {
      break;
    }
  }

  console.log(
    `Collection completed: ${collected} jobs collected using ${usedLayerIndex + 1}/${searchLayers.length} search layers` +
      (skippedSources.length > 0
        ? `; ${skippedSources.length} disabled source(s) skipped: ${skippedSources.join(', ')}`
        : ''),
  );

  if (allNewJobIds.length > 0) {
    await deps.enfileirar(allNewJobIds);
  }

  return { collected, errors, executedSources, skippedSources };
}

export function createJobCollectionWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === REPORT_NAME) {
        await sendDailyReport();
        return;
      }
      return runCollection();
    },
    {
      connection: getConnection(),
      concurrency: 1,
      ...WORKER_LOCK_OPTIONS,
      settings: BACKOFF_WORKER_SETTINGS,
    },
  );

  worker.on('completed', (_job, result) => {
    if (result?.collected !== undefined) {
      console.log(`Job collection completed: ${result.collected} jobs collected`);
      if (result.errors?.length > 0) {
        console.warn(`Errors: ${result.errors.join('; ')}`);
      }
    }
  });

  worker.on('failed', (_job, err) => {
    console.error(`Job failed: ${err.message}`);
  });

  return worker;
}
