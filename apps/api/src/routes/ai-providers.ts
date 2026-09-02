import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  listAiProviders,
  getActiveAiProvider,
  createAiProvider,
  updateAiProvider,
  deleteAiProvider,
  setActiveAiProvider,
} from '../services/ai-providers.js'
import { testConnection } from '../services/ai/factory.js'
import { prisma } from '../db/prisma.js'

const aiProviderSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  isActive: z.boolean().default(false),
})

const aiProviderUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
})

export async function aiProviderRoutes(app: FastifyInstance) {
  // GET /api/ai-providers — list all
  app.get('/api/ai-providers', async () => {
    const providers = await listAiProviders()
    return { providers }
  })

  // GET /api/ai-providers/active — get active provider
  app.get('/api/ai-providers/active', async () => {
    const provider = await getActiveAiProvider()
    return { provider }
  })

  // POST /api/ai-providers — create
  app.post(
    '/api/ai-providers',
    { schema: { body: aiProviderSchema } },
    async (request, reply) => {
      const data = request.body as z.infer<typeof aiProviderSchema>
      const provider = await createAiProvider(data)
      return reply.status(201).send(provider)
    },
  )

  // PUT /api/ai-providers/:id — update
  app.put(
    '/api/ai-providers/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        body: aiProviderUpdateSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const data = request.body as z.infer<typeof aiProviderUpdateSchema>

      try {
        const provider = await updateAiProvider(id, data)
        return provider
      } catch {
        return reply.status(404).send({ error: 'Provider not found' })
      }
    },
  )

  // POST /api/ai-providers/:id/activate — set active
  app.post(
    '/api/ai-providers/:id/activate',
    { schema: { params: z.object({ id: z.string().min(1) }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      try {
        const provider = await setActiveAiProvider(id)
        return provider
      } catch {
        return reply.status(404).send({ error: 'Provider not found' })
      }
    },
  )

  // POST /api/ai-providers/:id/test — test a saved provider
  app.post(
    '/api/ai-providers/:id/test',
    { schema: { params: z.object({ id: z.string().min(1) }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const provider = await prisma.aiProvider.findUnique({ where: { id } })
      if (!provider) {
        return reply.status(404).send({ error: 'Provider not found' })
      }

      const result = await testConnection({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
      })

      if (!result.ok) {
        return reply.status(422).send(result)
      }
      return result
    },
  )

  // DELETE /api/ai-providers/:id — delete
  app.delete(
    '/api/ai-providers/:id',
    { schema: { params: z.object({ id: z.string().min(1) }) } },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      try {
        await deleteAiProvider(id)
        return reply.status(204).send()
      } catch {
        return reply.status(404).send({ error: 'Provider not found' })
      }
    },
  )
}
