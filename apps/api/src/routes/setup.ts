import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { settingsService } from '../services/settings-service.js'
import { AI_SETTINGS, TELEGRAM_SETTINGS, CRON_SETTINGS, SETTINGS_SCOPE } from '../services/settings-keys.js'

const setupAiSchema = z.object({
  provider: z.string().min(1),
  baseUrl: z.string().url().default('https://api.openai.com/v1'),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  customPrompt: z.string().optional(),
})

const setupTelegramSchema = z.object({
  botToken: z.string().min(1),
  chatId: z.string().min(1),
})

const setupCronSchema = z.object({
  jobCollectionCron: z.string().regex(/^[0-9*,-\s/]+$/),
  dailyReportCron: z.string().regex(/^[0-9*,-\s/]+$/).optional(),
})

export async function setupRoutes(app: FastifyInstance) {
  // GET /api/setup/status
  app.get('/api/setup/status', async () => {
    const completion = await settingsService.getCompletion()
    return completion
  })

  // POST /api/setup/ai
  app.post(
    '/api/setup/ai',
    { schema: { body: setupAiSchema } },
    async (request, reply) => {
      const { provider, baseUrl, apiKey, model, customPrompt } = request.body as z.infer<
        typeof setupAiSchema
      >
      await settingsService.set(SETTINGS_SCOPE.AI, AI_SETTINGS.PROVIDER, provider)
      await settingsService.set(SETTINGS_SCOPE.AI, AI_SETTINGS.BASE_URL, baseUrl)
      await settingsService.set(SETTINGS_SCOPE.AI, AI_SETTINGS.API_KEY, apiKey, true)
      await settingsService.set(SETTINGS_SCOPE.AI, AI_SETTINGS.MODEL, model)
      if (customPrompt) {
        await settingsService.set(SETTINGS_SCOPE.AI, AI_SETTINGS.CUSTOM_PROMPT, customPrompt)
      }
      return reply.status(204).send()
    },
  )

  // POST /api/setup/telegram
  app.post(
    '/api/setup/telegram',
    { schema: { body: setupTelegramSchema } },
    async (request, reply) => {
      const { botToken, chatId } = request.body as z.infer<
        typeof setupTelegramSchema
      >
      await settingsService.set(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.BOT_TOKEN, botToken, true)
      await settingsService.set(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.CHAT_ID, chatId)
      return reply.status(204).send()
    },
  )

  // POST /api/setup/cron
  app.post(
    '/api/setup/cron',
    { schema: { body: setupCronSchema } },
    async (request, reply) => {
      const { jobCollectionCron, dailyReportCron } = request.body as z.infer<
        typeof setupCronSchema
      >
      await settingsService.set(SETTINGS_SCOPE.CRON, CRON_SETTINGS.JOB_COLLECTION, jobCollectionCron)
      if (dailyReportCron) {
        await settingsService.set(SETTINGS_SCOPE.CRON, CRON_SETTINGS.DAILY_REPORT, dailyReportCron)
      }
      return reply.status(204).send()
    },
  )

  // POST /api/setup/complete
  app.post('/api/setup/complete', async (_request, reply) => {
    await settingsService.markCompleted()
    return reply.status(204).send()
  })
}
