import type { FastifyInstance } from 'fastify'
import { getAnalyticsOverview } from '../services/analytics.js'

export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { days?: string }
  }>('/api/analytics/overview', async (request) => {
    const days = request.query.days ? parseInt(request.query.days, 10) : 30
    return getAnalyticsOverview(days)
  })
}
