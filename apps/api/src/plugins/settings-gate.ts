import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { settingsService } from '../services/settings-service.js'

const ALLOWED_PATHS = ['/health', '/health/ready', '/match']

export async function settingsCompletionGate(
  app: FastifyInstance,
): Promise<void> {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url

    // Always allow health checks and match label
    if (ALLOWED_PATHS.some((p) => url.startsWith(p))) {
      return
    }

    // Allow setup and settings routes
    if (url.startsWith('/api/setup') || url.startsWith('/api/settings')) {
      return
    }

    // Check completion
    const { completed } = await settingsService.getCompletion()
    if (!completed) {
      return reply.status(503).send({
        error: 'Setup not completed',
        message: 'Please complete the setup wizard at /setup first',
        setupUrl: '/setup',
      })
    }
  })
}
