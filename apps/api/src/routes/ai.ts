import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { testConnection, getConfig } from '../services/ai/factory.js'

const testSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
})

export async function aiRoutes(app: FastifyInstance) {
  // POST /api/ai/test — test AI connection (with optional body for testing before save)
  app.post(
    '/api/ai/test',
    { schema: { body: testSchema.optional() } },
    async (request, reply) => {
      const body = request.body as z.infer<typeof testSchema> | undefined

      if (body) {
        const result = await testConnection({ baseUrl: body.baseUrl, apiKey: body.apiKey, model: body.model })
        if (!result.ok) {
          return reply.status(422).send(result)
        }
        return result
      }

      try {
        const config = await getConfig()
        const result = await testConnection(config)
        if (!result.ok) {
          return reply.status(422).send(result)
        }
        return result
      } catch (err) {
        return reply.status(422).send({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
  )
}
