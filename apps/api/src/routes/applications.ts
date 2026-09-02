import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { applicationService } from '../services/application-service.js'

const createApplicationSchema = z.object({
  jobId: z.string().cuid(),
  notes: z.string().max(5000).optional(),
})

const updateStatusSchema = z.object({
  status: z.enum([
    'FOUND',
    'INTERESTING',
    'CV_PREPARED',
    'APPLIED',
    'INTERVIEW',
    'REJECTED',
    'OFFER',
    'ARCHIVED',
  ]),
  note: z.string().max(1000).optional(),
})

const updateApplicationSchema = z.object({
  notes: z.string().max(5000).optional(),
  salary: z.number().int().min(0).nullable().optional(),
  result: z.string().max(500).optional(),
  contacts: z.record(z.string(), z.unknown()).optional(),
})

const listApplicationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
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
    .optional(),
  jobId: z.string().cuid().optional(),
})

export async function applicationRoutes(app: FastifyInstance) {
  app.post(
    '/api/applications',
    { schema: { body: createApplicationSchema } },
    async (request, reply) => {
      const { jobId, notes } = request.body as z.infer<typeof createApplicationSchema>
      const result = await applicationService.create({ jobId, notes })

      if (result === null) {
        return reply.status(404).send({ error: 'Job or profile not found' })
      }

      if ('conflict' in result) {
        return reply.status(409).send({
          error: 'Application already exists',
          applicationId: result.applicationId,
        })
      }

      return reply.status(201).send({ applicationId: result.applicationId })
    },
  )

  app.get(
    '/api/applications',
    { schema: { querystring: listApplicationsSchema } },
    async (request) => {
      const query = request.query as z.infer<typeof listApplicationsSchema>
      return applicationService.list(query)
    },
  )

  app.get(
    '/api/applications/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const application = await applicationService.getById(id)
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      return application
    },
  )

  app.patch(
    '/api/applications/:id/status',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: updateStatusSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { status, note } = request.body as z.infer<typeof updateStatusSchema>
      const result = await applicationService.updateStatus(id, status, note)
      if (!result) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      return result
    },
  )

  app.patch(
    '/api/applications/:id',
    {
      schema: {
        params: z.object({ id: z.string().cuid() }),
        body: updateApplicationSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const data = request.body as z.infer<typeof updateApplicationSchema>
      const updated = await applicationService.update(id, data)
      if (!updated) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      return updated
    },
  )

  app.delete(
    '/api/applications/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const deleted = await applicationService.delete(id)
      if (!deleted) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      return reply.status(204).send()
    },
  )
}
