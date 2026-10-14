import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { jobCollectionQueue, runCollection } from '../workers/job-collection.js';
import { processingQueue } from '../workers/processing.js';
import { enqueueJobPipeline } from '../workers/processing.js';
import { prisma } from '../db/prisma.js';
import { settingsService } from '../services/settings-service.js';
import {
  SETTINGS_SCOPE,
  APIFY_SETTINGS,
  APIFY_CONSOLE_URL,
  APIFY_SIGNUP_URL,
  APIFY_DOCS_URL,
  ADZUNA_SETTINGS,
  sourceEnabledKey,
} from '../services/settings-keys.js';
import { getAllSources } from '../sources/index.js';
import { estimateCostUsd } from '../services/ai/pricing.js';
import type { AiRunType } from '../generated/prisma/index.js';

/**
 * Espelha o enum AiRunType do Prisma.
 *
 * Existe para validar o query param do filtro. Com `as any`, um valor errado
 * chegava ao Prisma e virava 500 — o usuário só via "algo deu errado".
 */
const AI_RUN_TYPES = [
  'CV_PARSE',
  'REQUIREMENT_EXTRACT',
  'MATCH_EXPLAIN',
  'JOB_ANALYZE',
  'CV_OPTIMIZE',
  'SUMMARIZE',
  'OTHER',
] as const satisfies readonly AiRunType[];

const aiRunTypeSchema = z.enum(AI_RUN_TYPES);

/** Rótulo em português para a tela de auditoria. */
export const AI_RUN_LABELS: Record<AiRunType, string> = {
  CV_PARSE: 'Leitura de CV',
  REQUIREMENT_EXTRACT: 'Extração de requisitos',
  MATCH_EXPLAIN: 'Explicação de match',
  JOB_ANALYZE: 'Análise de vaga',
  CV_OPTIMIZE: 'Otimização de CV',
  SUMMARIZE: 'Resumo',
  OTHER: 'Outra operação',
};

/**
 * Prisma entrega `costUsd` como Decimal, que vira string no JSON. O front
 * espera número para somar e formatar.
 */
function serializeRun<T extends { costUsd: unknown }>(run: T) {
  return {
    ...run,
    costUsd: run.costUsd == null ? null : Number(run.costUsd),
  };
}

const SOURCE_IDS = [
  'linkedin',
  'remoteok',
  'remotive',
  'google-jobs',
  'indeed',
  'linkedin-apify',
  'adzuna',
  'jobicy',
  'weworkremotely',
];

const apifyTokenSchema = z.object({
  token: z.string().min(1),
});

export async function adminRoutes(app: FastifyInstance) {
  // POST /api/admin/collect-now
  app.post('/api/admin/collect-now', async (_request, reply) => {
    const result = await runCollection();
    return reply.send(result);
  });

  // POST /api/admin/collect-async
  app.post('/api/admin/collect-async', async (_request, reply) => {
    await jobCollectionQueue.add('collect-jobs', {});
    return reply.status(202).send({ message: 'Collection job queued' });
  });

  // POST /api/admin/process-all — trigger processing for all RAW jobs
  app.post('/api/admin/process-all', async (_request, reply) => {
    const rawJobs = await prisma.job.findMany({
      where: { status: 'RAW' },
      select: { id: true },
    });

    if (rawJobs.length === 0) {
      return reply.send({ message: 'No RAW jobs to process', count: 0 });
    }

    await enqueueJobPipeline(rawJobs.map((j) => j.id));

    return reply.send({
      message: `Processing ${rawJobs.length} jobs`,
      count: rawJobs.length,
    });
  });

  // GET /api/admin/sources — list sources with enabled status
  app.get('/api/admin/sources', async () => {
    const sources = getAllSources();
    const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES);
    const sourcesWithStatus = sources.map((source) => ({
      id: source.id,
      name: source.name,
      description: source.description,
      enabled: settings[sourceEnabledKey(source.id)] !== 'false',
    }));

    return { sources: sourcesWithStatus };
  });

  // PUT /api/admin/sources/:sourceId/enable — toggle source
  app.put(
    '/api/admin/sources/:sourceId/enable',
    {
      schema: {
        params: z.object({ sourceId: z.string().min(1) }),
        body: z.object({ enabled: z.boolean() }),
      },
    },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const { enabled } = request.body as { enabled: boolean };

      if (!SOURCE_IDS.includes(sourceId)) {
        return reply.status(404).send({ error: 'Source not found' });
      }

      await settingsService.set(
        SETTINGS_SCOPE.SOURCES,
        sourceEnabledKey(sourceId),
        String(enabled),
      );
      return { sourceId, enabled };
    },
  );

  // GET /api/admin/apify-token — check if token is configured
  app.get('/api/admin/apify-token', async () => {
    const token = await settingsService.get(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN);
    const envToken = process.env.APIFY_TOKEN;
    return {
      configured: (token !== null && token !== '********') || !!envToken,
      fromEnv: !!envToken,
      links: {
        console: APIFY_CONSOLE_URL,
        signup: APIFY_SIGNUP_URL,
        docs: APIFY_DOCS_URL,
      },
    };
  });

  // POST /api/admin/apify-token — save Apify token
  app.post(
    '/api/admin/apify-token',
    {
      schema: {
        body: apifyTokenSchema,
      },
    },
    async (request, reply) => {
      const { token } = request.body as z.infer<typeof apifyTokenSchema>;
      await settingsService.set(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN, token, true);
      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/admin/apify-token — remove Apify token
  app.delete('/api/admin/apify-token', async (_request, reply) => {
    const cacheKey = `settings:${SETTINGS_SCOPE.APIFY}:${APIFY_SETTINGS.TOKEN}`;
    await prisma.setting.delete({ where: { key: cacheKey } }).catch(() => {});
    return reply.status(200).send({ ok: true });
  });

  // GET /api/admin/adzuna-credentials — check if credentials are configured
  app.get('/api/admin/adzuna-credentials', async () => {
    const appId = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_ID);
    const appKey = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_KEY);
    const envAppId = process.env.ADZUNA_APP_ID;
    const envAppKey = process.env.ADZUNA_APP_KEY;

    return {
      configured: !!(appId && appKey) || !!(envAppId && envAppKey),
      fromEnv: !!(envAppId && envAppKey),
      hasAppId: !!(appId && appId !== '********') || !!envAppId,
      hasAppKey: !!(appKey && appKey !== '********') || !!envAppKey,
      links: {
        signup: 'https://developer.adzuna.com/signup',
        docs: 'https://developer.adzuna.com/overview',
      },
    };
  });

  // POST /api/admin/adzuna-credentials — save Adzuna credentials
  app.post(
    '/api/admin/adzuna-credentials',
    {
      schema: {
        body: z.object({
          appId: z.string().min(1),
          appKey: z.string().min(1),
        }),
      },
    },
    async (request, reply) => {
      const { appId, appKey } = request.body as { appId: string; appKey: string };
      await settingsService.set(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_ID, appId, true);
      await settingsService.set(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_KEY, appKey, true);
      return reply.status(200).send({ ok: true });
    },
  );

  // DELETE /api/admin/adzuna-credentials — remove Adzuna credentials
  app.delete('/api/admin/adzuna-credentials', async (_request, reply) => {
    const appIdKey = `settings:${SETTINGS_SCOPE.ADZUNA}:${ADZUNA_SETTINGS.APP_ID}`;
    const appKeyKey = `settings:${SETTINGS_SCOPE.ADZUNA}:${ADZUNA_SETTINGS.APP_KEY}`;
    await prisma.setting.delete({ where: { key: appIdKey } }).catch(() => {});
    await prisma.setting.delete({ where: { key: appKeyKey } }).catch(() => {});
    return reply.status(200).send({ ok: true });
  });

  // GET /api/admin/jobs/status — queue counters
  app.get('/api/admin/jobs/status', async () => {
    const [collectionQueueStatus, processingQueueStatus] = await Promise.all([
      jobCollectionQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      processingQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    return {
      collection: collectionQueueStatus,
      processing: processingQueueStatus,
    };
  });

  // GET /api/admin/ai-runs — list AI operations
  app.get<{
    Querystring: { page?: string; limit?: string; type?: string };
  }>('/api/admin/ai-runs', async (request, reply) => {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20;

    // O filtro vivia como `type as any`: qualquer BESTA na query virava erro do
    // Prisma e a tela recebia 500 em vez de uma lista vazia.
    const parsedType = aiRunTypeSchema.safeParse(request.query.type);
    if (request.query.type && !parsedType.success) {
      return reply.status(400).send({
        error: `Filtro inválido. Use um de: ${AI_RUN_TYPES.join(', ')}`,
      });
    }

    const where = parsedType.success ? { type: aiRunTypeSchema.parse(parsedType.data) } : {};

    const [runs, total] = await Promise.all([
      prisma.aiRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aiRun.count({ where }),
    ]);

    const data = runs.map(serializeRun);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // GET /api/admin/ai-usage — custo e volume por tipo de operação
  //
  // É o que responde "quanto estou gastando com IA e com o quê". Sem isto, os
  // ai_runs existiam mas ninguém conseguia ver o total.
  app.get<{ Querystring: { days?: string } }>('/api/admin/ai-usage', async (request) => {
    const days = Math.min(Math.max(parseInt(request.query.days ?? '30', 10) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const grouped = await prisma.aiRun.groupBy({
      by: ['type'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        costUsd: true,
      },
    });

    const runs = await prisma.aiRun.findMany({
      where: { createdAt: { gte: since } },
      select: { promptTokens: true, completionTokens: true, model: true, costUsd: true },
    });

    const byType = grouped
      .map((g) => ({
        type: g.type,
        calls: g._count._all,
        promptTokens: g._sum.promptTokens ?? 0,
        completionTokens: g._sum.completionTokens ?? 0,
        costUsd: Number((g._sum.costUsd ?? 0).toFixed(6)),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    const totals = byType.reduce(
      (acc, t) => ({
        calls: acc.calls + t.calls,
        promptTokens: acc.promptTokens + t.promptTokens,
        completionTokens: acc.completionTokens + t.completionTokens,
        costUsd: Number((acc.costUsd + t.costUsd).toFixed(6)),
      }),
      { calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 },
    );

    // Registros gravados antes do custo passar a ser persistido têm tokens mas
    // custoUsd nulo. Sem isto o total viria com um buraco silencioso logo após a
    // mudança. Só as linhas sem custo entram na conta — estimar também as que já
    // têm valor contaria o mesmo gasto duas vezes, que foi a primeira versão
    // daqui e produzia total inflado.
    const estimatedMissingCostUsd = Number(
      runs
        .filter((run) => run.costUsd == null)
        .reduce(
          (acc, run) =>
            acc + estimateCostUsd(run.model, run.promptTokens ?? 0, run.completionTokens ?? 0),
          0,
        )
        .toFixed(6),
    );

    const models = [...new Set(runs.map((r) => r.model))].sort();

    return {
      days,
      totals,
      byType,
      models,
      // Só é diferente de zero enquanto existirem linhas antigas sem custo.
      estimatedMissingCostUsd,
    };
  });
}
