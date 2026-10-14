import { Queue, Worker, type ConnectionOptions } from 'bullmq';
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
import { SETTINGS_SCOPE, CRON_SETTINGS, DEFAULT_CRON } from '../services/settings-keys.js';
import { redisConnectionOptions, WORKER_LOCK_OPTIONS } from '../db/redis-connection.js';

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
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
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

export async function setupCronSchedule(): Promise<void> {
  const collectionCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.JOB_COLLECTION)) ??
    DEFAULT_CRON.JOB_COLLECTION;
  const reportCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.DAILY_REPORT)) ??
    DEFAULT_CRON.DAILY_REPORT;

  await jobCollectionQueue.upsertJobScheduler(
    'job-collection-scheduler',
    { pattern: collectionCron },
    { name: JOB_NAME },
  );

  await jobCollectionQueue.upsertJobScheduler(
    'daily-report-scheduler',
    { pattern: reportCron },
    { name: REPORT_NAME },
  );
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
  /** Busca as vagas em todas as fontes. */
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
}> {
  if (!deps.temFontes()) {
    return { collected: 0, errors: ['No job sources registered'] };
  }

  const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES);
  const profile = await prisma.profile.findFirst({
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

  for (let layerIndex = 0; layerIndex < searchLayers.length; layerIndex++) {
    const layer = searchLayers[layerIndex];
    usedLayerIndex = layerIndex;

    const jobFilter = createJobFilter(profile, { relaxed: layer.relaxed });

    const results = await deps.coletar({
      keywords: layer.keywords,
      remoteOnly: profile?.remotePreference === 'REMOTE',
    });

    let layerCollected = 0;
    const layerErrors: string[] = [];

    for (const result of results) {
      if (result.error) {
        layerErrors.push(`Source ${result.sourceId}: ${result.error}`);
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
    `Collection completed: ${collected} jobs collected using ${usedLayerIndex + 1}/${searchLayers.length} search layers`,
  );

  if (allNewJobIds.length > 0) {
    await deps.enfileirar(allNewJobIds);
  }

  return { collected, errors };
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
