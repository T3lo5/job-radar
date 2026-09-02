import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { jobService } from '../services/job-service.js'
import { computeMatchScore } from '../services/matching/engine.js'

const jobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sourceId: z.string().optional(),
  status: z.enum(['RAW', 'EXTRACTING', 'MATCHING', 'ANALYZING', 'DONE', 'FAILED']).optional(),
  remote: z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN']).optional(),
  seniority: z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD', 'UNKNOWN']).optional(),
  search: z.string().min(1).max(100).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
})

const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  location: z.string().max(200).nullable().optional(),
  remote: z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN']).default('UNKNOWN'),
  seniority: z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD', 'UNKNOWN']).nullable().optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().max(10).nullable().optional(),
  url: z.string().url().max(2000),
  externalId: z.string().max(200).nullable().optional(),
  publishedAt: z.coerce.date().nullable().optional(),
  applicationStatus: z.enum([
    'FOUND',
    'INTERESTING',
    'CV_PREPARED',
    'APPLIED',
    'INTERVIEW',
    'REJECTED',
    'OFFER',
    'ARCHIVED',
  ]).nullable().optional(),
})

const matchJobSchema = z.object({
  jobId: z.string().cuid(),
})

const updateJobSchema = z.object({
  description: z.string().min(1).max(10000),
})

export async function jobsRoutes(app: FastifyInstance) {
  app.get(
    '/api/jobs',
    { schema: { querystring: jobsQuerySchema } },
    async (request) => {
      const query = request.query as z.infer<typeof jobsQuerySchema>
      return jobService.list(query)
    },
  )

  app.get(
    '/api/jobs/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const job = await jobService.getById(id)
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }
      return job
    },
  )

  app.post(
    '/api/jobs',
    { schema: { body: createJobSchema } },
    async (request, reply) => {
      const body = request.body as z.infer<typeof createJobSchema>
      const { applicationStatus, ...jobData } = body

      const job = await jobService.create({
        ...jobData,
        publishedAt: body.publishedAt ?? undefined,
      })

      let applicationId: string | undefined

      if (applicationStatus) {
        const profile = await prisma.profile.findFirst()
        if (!profile) {
          return reply.status(404).send({ error: 'Profile not found' })
        }

        const existing = await prisma.application.findUnique({
          where: {
            jobId_profileId: { jobId: job.id, profileId: profile.id },
          },
        })

        if (!existing) {
          const application = await prisma.application.create({
            data: {
              jobId: job.id,
              profileId: profile.id,
              status: applicationStatus,
            },
          })
          applicationId = application.id

          await prisma.applicationEvent.create({
            data: {
              applicationId: application.id,
              fromStatus: null,
              toStatus: applicationStatus,
              note: 'Manually added',
            },
          })
        }
      }

      return reply.status(201).send({ job, applicationId })
    },
  )

  app.get('/api/jobs/stats', async () => {
    return jobService.getStats()
  })

  app.post(
    '/api/match/evaluate',
    { schema: { body: matchJobSchema } },
    async (request, reply) => {
      const { jobId } = request.body as z.infer<typeof matchJobSchema>

      const [job, profile, allSkills] = await Promise.all([
        jobService.getJobWithSkills(jobId),
        jobService.getProfileWithSkills(),
        jobService.getAllSkills(),
      ])

      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' })
      }

      const result = computeMatchScore(job, profile, allSkills)

      await jobService.upsertMatch(job.id, profile.id, result)

      return result
    },
  )

  app.get('/api/match/results', async (_request, reply) => {
    const profile = await jobService.getProfileWithSkills()
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' })
    }
    return jobService.listMatches(profile.id)
  })

  app.patch(
    '/api/jobs/:id',
    { schema: { params: z.object({ id: z.string().cuid() }), body: updateJobSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { description } = request.body as z.infer<typeof updateJobSchema>

      const job = await jobService.getById(id)
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' })
      }

      const updated = await jobService.updateDescription(id, description)
      return updated
    },
  )
}
