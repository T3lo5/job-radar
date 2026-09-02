import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { settingsService } from '../services/settings-service.js'

const settingSetSchema = z.object({
  scope: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
  value: z.string(),
  isSecret: z.boolean().default(false),
})

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings/:scope
  app.get(
    '/api/settings/:scope',
    {
      schema: {
        params: z.object({ scope: z.string().min(1).max(50) }),
      },
    },
    async (request) => {
      const { scope } = request.params as { scope: string }
      const settings = await settingsService.getAll(scope)
      return { scope, settings }
    },
  )

  // POST /api/settings
  app.post(
    '/api/settings',
    {
      schema: {
        body: settingSetSchema,
      },
    },
    async (request, reply) => {
      const { scope, key, value, isSecret } = request.body as z.infer<
        typeof settingSetSchema
      >
      await settingsService.set(scope, key, value, isSecret)
      return reply.status(204).send()
    },
  )
}
