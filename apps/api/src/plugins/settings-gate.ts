import type { FastifyInstance, FastifyRequest } from 'fastify';

const ALLOWED_PATHS = ['/health', '/health/ready', '/match'];

export async function settingsCompletionGate(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (_request: FastifyRequest) => {
    const url = _request.url;

    if (ALLOWED_PATHS.some((p) => url.startsWith(p))) {
      return;
    }

    if (url.startsWith('/api/setup') || url.startsWith('/api/settings')) {
      return;
    }
  });
}
