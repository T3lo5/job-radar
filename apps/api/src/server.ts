import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { matchLabelFor, MATCH_LABELS, type MatchScore } from '@job-radar/shared';
import { prisma } from './db/prisma.js';
import { redis } from './db/redis.js';
import { profileRoutes } from './routes/profile.js';
import { settingsRoutes } from './routes/settings.js';
import { setupRoutes } from './routes/setup.js';
import { settingsCompletionGate } from './plugins/settings-gate.js';
import { adminRoutes } from './routes/admin.js';
import { jobsRoutes } from './routes/jobs.js';
import { resumeRoutes } from './routes/resumes.js';
import { aiRoutes } from './routes/ai.js';
import { aiProviderRoutes } from './routes/ai-providers.js';
import { applicationRoutes } from './routes/applications.js';
import { notificationRoutes } from './routes/notifications.js';
import { reportRoutes } from './routes/reports.js';
import { analyticsRoutes } from './routes/analytics.js';
import { cvOptimizerRoutes } from './routes/cv-optimizer.js';
import { pdfExportRoutes } from './routes/pdf-export.js';
import { createJobCollectionWorker, setupCronSchedule } from './workers/job-collection.js';
import { createProcessingWorker } from './workers/processing.js';
import { startTelegramBot } from './services/telegram-bot.js';
import { getEnv } from './config/env.js';

const env = getEnv();

const matchLabelParams = z.object({
  score: z.coerce.number().int().min(0).max(100),
});

const PORT = env.APP_PORT;
const HOST = env.APP_HOST;

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    genReqId: () => `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  await app.register(profileRoutes);
  await app.register(settingsRoutes);
  await app.register(setupRoutes);
  await app.register(adminRoutes);
  await app.register(jobsRoutes);
  await app.register(resumeRoutes);
  await app.register(aiRoutes);
  await app.register(aiProviderRoutes);
  await app.register(applicationRoutes);
  await app.register(notificationRoutes);
  await app.register(reportRoutes);
  await app.register(analyticsRoutes);
  await app.register(cvOptimizerRoutes);
  await app.register(pdfExportRoutes);

  await settingsCompletionGate(app);

  app.get('/health', async () => ({
    status: 'ok',
    service: 'job-radar-api',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { ok: boolean; error?: string }> = {};

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { ok: true };
    } catch (err) {
      checks.postgres = { ok: false, error: (err as Error).message };
    }

    try {
      const pong = await redis.ping();
      checks.redis = { ok: pong === 'PONG' };
    } catch (err) {
      checks.redis = { ok: false, error: (err as Error).message };
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get(
    '/match/:score/label',
    {
      schema: {
        params: matchLabelParams,
      },
    },
    async (request) => {
      const { score } = request.params;
      const n = score as MatchScore;
      const label = matchLabelFor(n);
      const visual = MATCH_LABELS[label];
      return { score: n, label, labelText: visual.label, emoji: visual.emoji };
    },
  );

  return app;
}

async function main() {
  const app = await buildServer();

  const worker = createJobCollectionWorker();
  const processingWorker = createProcessingWorker();
  await setupCronSchedule();

  worker.on('error', (err) => {
    app.log.error({ err }, 'Job collection worker error');
  });

  processingWorker.on('error', (err) => {
    app.log.error({ err }, 'Processing worker error');
  });

  app.log.info('Job collection worker started');
  app.log.info('Processing worker started');

  // Start Telegram bot
  await startTelegramBot();

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
