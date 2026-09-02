import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { CvOptimizationService } from '../services/cv-optimization-service.js'

export async function cvOptimizerRoutes(app: FastifyInstance) {
  const optimizationService = new CvOptimizationService()

  app.post<
    {
      Body: {
        resumeId?: string
        jobId?: string
        jobDescription?: string
      }
    }
  >(
    '/api/cv/optimize',
    {
      schema: {
        body: z.object({
          resumeId: z.string().cuid().optional(),
          jobId: z.string().cuid().optional(),
          jobDescription: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { resumeId, jobId, jobDescription } = request.body

      if (!jobId && !jobDescription) {
        return reply.status(400).send({ error: 'jobId or jobDescription is required' })
      }

      const targetResumeId = resumeId ?? (await prisma.resume.findFirst({
        where: { isDefault: true },
        orderBy: { createdAt: 'desc' },
      }))?.id

      if (!targetResumeId) {
        return reply.status(404).send({ error: 'No resume found. Please upload a CV first.' })
      }

      try {
        const result = await optimizationService.optimize({
          resumeId: targetResumeId,
          jobId,
          jobDescription,
        })

        return {
          resumeId: result.resumeId,
          jobId: result.jobId,
          optimizedText: result.optimizedText,
          changes: result.changes,
          keywordsAdded: result.keywordsAdded,
          summary: result.summary,
        }
      } catch (err) {
        return reply.status(422).send({
          error: `Failed to optimize CV: ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    },
  )
}
