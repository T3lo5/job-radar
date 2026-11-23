import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { jobService } from '../services/job-service.js';
import { keywordGapAnalyzer } from '../services/keyword-gap-analyzer.js';
import { computeMatchScore } from '../services/matching/engine.js';
import { getCurrentProfile, getCurrentUserId } from '../lib/current-user.js';
import { httpUrl } from '../utils/validation.js';

const jobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.string().optional(),
  status: z.enum(['RAW', 'EXTRACTING', 'MATCHING', 'ANALYZING', 'DONE', 'FAILED']).optional(),
  remote: z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN']).optional(),
  seniority: z
    .enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD', 'UNKNOWN'])
    .optional(),
  search: z.string().min(1).max(100).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  sort: z.enum(['date', 'match', 'title', 'salary']).default('date'),
  discarded: z.enum(['active', 'discarded', 'all']).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
  maxSalary: z.coerce.number().int().min(0).optional(),
  minConfidence: z.coerce.number().int().min(0).max(100).optional(),
  skill: z.string().min(1).max(100).optional(),
});

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  location: z.string().max(200).nullable().optional(),
  remote: z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN']).default('UNKNOWN'),
  seniority: z
    .enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD', 'UNKNOWN'])
    .nullable()
    .optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().max(10).nullable().optional(),
  url: httpUrl(2000),
  externalId: z.string().max(200).nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  applicationStatus: z
    .enum([
      'FOUND',
      'INTERESTING',
      'CV_PREPARED',
      'APPLIED',
      'INTERVIEW',
      'REJECTED',
      'OFFER',
      'ARCHIVED',
    ])
    .nullable()
    .optional(),
});

const matchJobSchema = z.object({
  jobId: z.string().cuid(),
});

const evaluateAllSchema = z.object({
  // Ids das vagas em tela. Vazio não avalia nada (a UI só manda o que carregou).
  jobIds: z.array(z.string().cuid()).max(500),
});

const updateJobSchema = z.object({
  description: z.string().min(1).max(10000),
});

export async function jobsRoutes(app: FastifyInstance) {
  app.get('/api/jobs', { schema: { querystring: jobsQuerySchema } }, async (request) => {
    const query = request.query as z.infer<typeof jobsQuerySchema>;
    // `sort=match`/`minScore` dependem do perfil da sessão; a lista em si é
    // global (todas as vagas), o score não.
    const profile = await getCurrentProfile(request);
    return jobService.list({ ...query, profileId: profile?.id });
  });

  app.get(
    '/api/jobs/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const job = await jobService.getById(id);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      return job;
    },
  );

  app.post('/api/jobs', { schema: { body: createJobSchema } }, async (request, reply) => {
    const body = request.body as z.infer<typeof createJobSchema>;
    const { applicationStatus, ...jobData } = body;

    const job = await jobService.create({
      ...jobData,
      publishedAt: body.publishedAt ?? undefined,
    });

    let applicationId: string | undefined;

    if (applicationStatus) {
      const profile = await prisma.profile.findUnique({
        where: { userId: getCurrentUserId(request) },
      });
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const existing = await prisma.application.findUnique({
        where: {
          jobId_profileId: { jobId: job.id, profileId: profile.id },
        },
      });

      if (!existing) {
        const application = await prisma.application.create({
          data: {
            jobId: job.id,
            profileId: profile.id,
            status: applicationStatus,
          },
        });
        applicationId = application.id;

        await prisma.applicationEvent.create({
          data: {
            applicationId: application.id,
            fromStatus: null,
            toStatus: applicationStatus,
            note: 'Manually added',
          },
        });
      }
    }

    return reply.status(201).send({ job, applicationId });
  });

  app.get('/api/jobs/stats', async () => {
    return jobService.getStats();
  });

  app.post('/api/match/evaluate', { schema: { body: matchJobSchema } }, async (request, reply) => {
    const { jobId } = request.body as z.infer<typeof matchJobSchema>;
    const userId = getCurrentUserId(request);

    // Antes eram três queries em paralelo, uma delas o catálogo inteiro de
    // skills — por requisição HTTP. O motor não precisa dele.
    const [job, profile] = await Promise.all([
      jobService.getJobWithSkills(jobId),
      jobService.getProfileWithSkills(userId),
    ]);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    const result = computeMatchScore(job, profile);

    await jobService.upsertMatch(job.id, profile.id, result);

    return result;
  });

  /**
   * Avalia o match de várias vagas de uma vez (as que estão em tela).
   *
   * Reaproveita o mesmo motor do `/api/match/evaluate`, mas lê o perfil uma
   * vez e busca todas as vagas num único `findMany` — sem N idas ao banco por
   * vaga. Devolve `{ jobId, score }` por vaga avaliada.
   */
  app.post('/api/match/evaluate-all', { schema: { body: evaluateAllSchema } }, async (request) => {
    const { jobIds } = request.body as z.infer<typeof evaluateAllSchema>;
    const userId = getCurrentUserId(request);

    const [jobs, profile] = await Promise.all([
      jobService.getManyWithSkills(jobIds),
      jobService.getProfileWithSkills(userId),
    ]);

    if (!profile) {
      return { evaluated: 0, results: [] as Array<{ jobId: string; score: number }> };
    }

    const results: Array<{ jobId: string; score: number }> = [];
    for (const job of jobs) {
      const result = computeMatchScore(job, profile);
      await jobService.upsertMatch(job.id, profile.id, result);
      results.push({ jobId: job.id, score: result.score });
    }

    return { evaluated: results.length, results };
  });

  app.get('/api/match/results', async (request, reply) => {
    const profile = await jobService.getProfileWithSkills(getCurrentUserId(request));
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }
    // A lista continua limitada (o top 50 é o que as telas consomem), mas
    // devolve o total junto: a UI precisa saber que há mais.
    return jobService.listMatches(profile.id);
  });

  app.get('/api/match/stats', async (request, reply) => {
    const profile = await jobService.getProfileWithSkills(getCurrentUserId(request));
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }
    return jobService.getMatchStats(profile.id);
  });

  /**
   * Match de uma vaga específica.
   *
   * `{ match: null }` com 200 quando a vaga existe mas ainda não foi avaliada:
   * é um estado normal da tela, não um erro. 404 fica reservado para vaga
   * inexistente.
   */
  app.get(
    '/api/jobs/:id/match',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      const profile = await jobService.getProfileWithSkills(getCurrentUserId(request));
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      return { match: await jobService.getMatchForJob(id, profile.id) };
    },
  );

  app.get(
    '/api/jobs/:id/keyword-gap',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profile = await jobService.getProfileWithSkills(getCurrentUserId(request));
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }
      try {
        const report = await keywordGapAnalyzer.analyze(id, profile.userId);
        return report;
      } catch (err) {
        return reply.status(404).send({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  app.patch(
    '/api/jobs/:id',
    { schema: { params: z.object({ id: z.string().cuid() }), body: updateJobSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { description } = request.body as z.infer<typeof updateJobSchema>;

      const job = await jobService.getById(id);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      const updated = await jobService.updateDescription(id, description);
      return updated;
    },
  );

  // Descartar: tira a vaga da lista geral e joga em "Descartes" (não exclui).
  app.post(
    '/api/jobs/:id/discard',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!(await jobService.getById(id))) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      const job = await jobService.discard(id);
      return { id: job.id, discardedAt: job.discardedAt };
    },
  );

  // Restaurar: desfaz o descarte e devolve a vaga para a lista geral.
  app.post(
    '/api/jobs/:id/restore',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!(await jobService.getById(id))) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      const job = await jobService.restore(id);
      return { id: job.id, discardedAt: job.discardedAt };
    },
  );
}
