import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { resumeService } from '../services/resume-service.js'

export async function resumeRoutes(app: FastifyInstance) {
  app.post('/api/resumes', async (request, reply) => {
    const file = await request.file()
    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    try {
      const result = await resumeService.upload({
        filename: file.filename,
        mimetype: file.mimetype,
        toBuffer: file.toBuffer.bind(file),
      })
      return reply.status(201).send(result)
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/api/resumes', async () => {
    return resumeService.list()
  })

  app.get(
    '/api/resumes/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = await resumeService.getById(id)
      if (!result) {
        return reply.status(404).send({ error: 'Resume not found' })
      }
      reply.header('Content-Type', result.resume.mimeType)
      reply.header('Content-Disposition', `attachment; filename="${result.resume.filename}"`)
      return reply.send(result.stream)
    },
  )

  app.get(
    '/api/resumes/:id/text',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const resume = await resumeService.getText(id)
      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }
      return { id: resume.id, text: resume.rawText }
    },
  )

  app.delete(
    '/api/resumes/:id',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const deleted = await resumeService.delete(id)
      if (!deleted) {
        return reply.status(404).send({ error: 'Resume not found' })
      }
      return reply.status(204).send()
    },
  )

  app.post(
    '/api/resumes/:id/extract',
    { schema: { params: z.object({ id: z.string().cuid() }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      try {
        const result = await resumeService.extract(id)
        if (!result) {
          return reply.status(404).send({ error: 'Resume not found' })
        }
        return result
      } catch (err) {
        return reply.status(422).send({
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )
}
