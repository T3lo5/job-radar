import type { FastifyInstance } from 'fastify';
import { getAnalyticsOverview, daysParamSchema } from '../services/analytics.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { days?: string };
  }>('/api/analytics/overview', async (request, reply) => {
    // Valida na borda. Sem isto, `?days=abc` virava NaN, `new Date(NaN)` é
    // Data Inválida, e o Prisma respondia 500 com a mensagem vazia. O
    // `?days=-5` produzia período no FUTURO e a tela mostrava "0 vagas" como
    // se fosse resultado.
    const parsed = daysParamSchema.safeParse(request.query.days ?? 30);

    if (!parsed.success) {
      return reply.status(400).send({
        error: `Parâmetro days inválido: ${parsed.error.issues[0]?.message ?? 'valor não aceito'}`,
      });
    }

    return getAnalyticsOverview(parsed.data);
  });
}
