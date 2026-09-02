import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { testTelegramConnection, sendNotification } from '../services/notifications.js'

const sendNotificationSchema = z.object({
  channel: z.string().default('telegram'),
  text: z.string().min(1).max(4000),
  parseMode: z.enum(['Markdown', 'HTML']).optional(),
})

export async function notificationRoutes(app: FastifyInstance) {
  // POST /api/notifications/test — test Telegram connection
  app.post('/api/notifications/test', async (_request, reply) => {
    const result = await testTelegramConnection()
    if (!result.ok) {
      return reply.status(422).send(result)
    }
    return result
  })

  // POST /api/notifications/send — send test notification
  app.post(
    '/api/notifications/send',
    { schema: { body: sendNotificationSchema } },
    async (request, reply) => {
      const { channel, text, parseMode } = request.body as z.infer<
        typeof sendNotificationSchema
      >

      const result = await sendNotification(channel, { text, parseMode })
      if (!result.success) {
        return reply.status(422).send(result)
      }
      return result
    },
  )
}
