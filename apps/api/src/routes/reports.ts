import type { FastifyInstance } from 'fastify'
import { sendDailyReport } from '../services/daily-report.js'

export async function reportRoutes(app: FastifyInstance) {
  // POST /api/admin/send-daily-report — forçar envio do resumo diário
  app.post('/api/admin/send-daily-report', async (_request, reply) => {
    const result = await sendDailyReport()
    if (!result.success) {
      return reply.status(422).send(result)
    }
    return result
  })
}
