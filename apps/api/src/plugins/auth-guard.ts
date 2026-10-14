import type { FastifyInstance } from 'fastify';
import { SESSION_COOKIE, hasAccount, resolveSession } from '../services/auth.js';

/**
 * Guarda de autenticação.
 *
 * Substitui o antigo `settings-gate.ts`, que registrava um hook `onRequest`
 * que não fazia nada — a ADR-0005 prometia bloquear `/api/*` até o setup estar
 * completo e isso nunca foi implementado.
 *
 * Regra: enquanto nenhuma conta existir, só as rotas de auth, health e o status
 * do setup respondem. Depois que a conta existe, qualquer outra rota exige
 * sessão válida. O wizard cria a conta e já devolve a sessão, então os passos
 * seguintes dele passam a rodar autenticados.
 */
const PUBLIC_PREFIXES = ['/health', '/health/ready', '/match/', '/api/auth/'];

/** Metadado não sensível usado pelo front para decidir entre login e wizard. */
function isPublic(url: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix)) || url === '/api/setup/status';
}

export async function authGuard(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    if (isPublic(request.url)) return;

    if (!(await hasAccount())) {
      // Sem conta ainda: só o setup pode liberar o resto.
      return reply.status(423).send({
        error: 'setup_required',
        message: 'Crie sua conta para começar',
      });
    }

    const token = request.cookies?.[SESSION_COOKIE];
    const resolved = await resolveSession(token);

    if (!resolved) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Sessão inválida ou expirada',
      });
    }

    // Disponibiliza o usuário para os handlers, sem mudar a assinatura deles.
    (request as unknown as { user: typeof resolved.user }).user = resolved.user;
  });
}

export { SESSION_COOKIE };
