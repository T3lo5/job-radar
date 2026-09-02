import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { jobCollectionQueue, runCollection } from '../workers/job-collection.js'
import { processingQueue } from '../workers/processing.js'
import { enqueueJobPipeline } from '../workers/processing.js'
import { prisma } from '../db/prisma.js'
import { settingsService } from '../services/settings-service.js'
import { SETTINGS_SCOPE, APIFY_SETTINGS, APIFY_CONSOLE_URL, APIFY_SIGNUP_URL, APIFY_DOCS_URL, ADZUNA_SETTINGS, sourceEnabledKey } from '../services/settings-keys.js'
import { getAllSources } from '../sources/index.js'

const SOURCE_IDS = ['linkedin', 'remoteok', 'remotive', 'google-jobs', 'indeed', 'linkedin-apify', 'adzuna', 'jobicy', 'weworkremotely']

const apifyTokenSchema = z.object({
  token: z.string().min(1),
})

export async function adminRoutes(app: FastifyInstance) {
  // POST /api/admin/collect-now
  app.post('/api/admin/collect-now', async (_request, reply) => {
    const result = await runCollection()
    return reply.send(result)
  })

  // POST /api/admin/collect-async
  app.post('/api/admin/collect-async', async (_request, reply) => {
    await jobCollectionQueue.add('collect-jobs', {})
    return reply.status(202).send({ message: 'Collection job queued' })
  })

  // POST /api/admin/process-all — trigger processing for all RAW jobs
  app.post('/api/admin/process-all', async (_request, reply) => {
    const rawJobs = await prisma.job.findMany({
      where: { status: 'RAW' },
      select: { id: true },
    })

    if (rawJobs.length === 0) {
      return reply.send({ message: 'No RAW jobs to process', count: 0 })
    }

    await enqueueJobPipeline(rawJobs.map((j) => j.id))

    return reply.send({
      message: `Processing ${rawJobs.length} jobs`,
      count: rawJobs.length,
    })
  })

  // GET /api/admin/sources — list sources with enabled status
  app.get('/api/admin/sources', async () => {
    const sources = getAllSources()
    const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES)
    const sourcesWithStatus = sources.map((source) => ({
      id: source.id,
      name: source.name,
      description: source.description,
      enabled: settings[sourceEnabledKey(source.id)] !== 'false',
    }))

    return { sources: sourcesWithStatus }
  })

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
      const { sourceId } = request.params as { sourceId: string }
      const { enabled } = request.body as { enabled: boolean }

      if (!SOURCE_IDS.includes(sourceId)) {
        return reply.status(404).send({ error: 'Source not found' })
      }

      await settingsService.set(SETTINGS_SCOPE.SOURCES, sourceEnabledKey(sourceId), String(enabled))
      return { sourceId, enabled }
    },
  )

  // GET /api/admin/apify-token — check if token is configured
  app.get('/api/admin/apify-token', async () => {
    const token = await settingsService.get(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN)
    const envToken = process.env.APIFY_TOKEN
    return {
      configured: token !== null && token !== '********' || !!envToken,
      fromEnv: !!envToken,
      links: {
        console: APIFY_CONSOLE_URL,
        signup: APIFY_SIGNUP_URL,
        docs: APIFY_DOCS_URL,
      },
    }
  })

  // POST /api/admin/apify-token — save Apify token
  app.post(
    '/api/admin/apify-token',
    {
      schema: {
        body: apifyTokenSchema,
      },
    },
    async (request, reply) => {
      const { token } = request.body as z.infer<typeof apifyTokenSchema>
      await settingsService.set(SETTINGS_SCOPE.APIFY, APIFY_SETTINGS.TOKEN, token, true)
      return reply.status(200).send({ ok: true })
    },
  )

  // DELETE /api/admin/apify-token — remove Apify token
  app.delete('/api/admin/apify-token', async (_request, reply) => {
    const cacheKey = `settings:${SETTINGS_SCOPE.APIFY}:${APIFY_SETTINGS.TOKEN}`
    await prisma.setting.delete({ where: { key: cacheKey } }).catch(() => {})
    return reply.status(200).send({ ok: true })
  })

  // GET /api/admin/adzuna-credentials — check if credentials are configured
  app.get('/api/admin/adzuna-credentials', async () => {
    const appId = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_ID)
    const appKey = await settingsService.get(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_KEY)
    const envAppId = process.env.ADZUNA_APP_ID
    const envAppKey = process.env.ADZUNA_APP_KEY

    return {
      configured: !!(appId && appKey) || !!(envAppId && envAppKey),
      fromEnv: !!(envAppId && envAppKey),
      hasAppId: !!(appId && appId !== '********') || !!envAppId,
      hasAppKey: !!(appKey && appKey !== '********') || !!envAppKey,
      links: {
        signup: 'https://developer.adzuna.com/signup',
        docs: 'https://developer.adzuna.com/overview',
      },
    }
  })

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
      const { appId, appKey } = request.body as { appId: string; appKey: string }
      await settingsService.set(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_ID, appId, true)
      await settingsService.set(SETTINGS_SCOPE.ADZUNA, ADZUNA_SETTINGS.APP_KEY, appKey, true)
      return reply.status(200).send({ ok: true })
    },
  )

  // DELETE /api/admin/adzuna-credentials — remove Adzuna credentials
  app.delete('/api/admin/adzuna-credentials', async (_request, reply) => {
    const appIdKey = `settings:${SETTINGS_SCOPE.ADZUNA}:${ADZUNA_SETTINGS.APP_ID}`
    const appKeyKey = `settings:${SETTINGS_SCOPE.ADZUNA}:${ADZUNA_SETTINGS.APP_KEY}`
    await prisma.setting.delete({ where: { key: appIdKey } }).catch(() => {})
    await prisma.setting.delete({ where: { key: appKeyKey } }).catch(() => {})
    return reply.status(200).send({ ok: true })
  })

  // GET /api/admin/jobs/status — queue counters
  app.get('/api/admin/jobs/status', async () => {
    const [collectionQueueStatus, processingQueueStatus] = await Promise.all([
      jobCollectionQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      processingQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ])

    return {
      collection: collectionQueueStatus,
      processing: processingQueueStatus,
    }
  })

  // GET /api/admin/ai-runs — list AI operations
  app.get<{
    Querystring: { page?: string; limit?: string; type?: string }
  }>('/api/admin/ai-runs', async (request) => {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 20
    const type = request.query.type

    const where = type ? { type: type as any } : {}

    const [runs, total] = await Promise.all([
      prisma.aiRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.aiRun.count({ where }),
    ])

    // Calculate estimated cost (rough estimate based on tokens)
    const runsWithCost = runs.map((run) => {
      const promptTokens = run.promptTokens ?? 0
      const completionTokens = run.completionTokens ?? 0
      // Rough cost estimate: $0.01/1K prompt tokens, $0.03/1K completion tokens
      const estimatedCost = (promptTokens / 1000) * 0.01 + (completionTokens / 1000) * 0.03

      return {
        ...run,
        estimatedCostUsd: Number(estimatedCost.toFixed(6)),
      }
    })

    return {
      data: runsWithCost,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  })
}
