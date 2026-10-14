import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  authenticate,
  createSession,
  hasAccount,
  hashPassword,
  isPasswordStrongEnough,
  listSessions,
  revokeSession,
  revokeSessionById,
  resolveSession,
  setupAccount,
  verifyPassword,
} from '../services/auth.js';
import { prisma } from '../db/prisma.js';

const emailSchema = z.string().email().max(200);

const passwordSchema = z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres').max(200);

const setupBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
});

function cookieOptions(expiresAt: Date) {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    // Secure exige HTTPS. Em dev (http://localhost) marcá-lo faria o browser
    // descartar o cookie e o login "funcionar" sem sessão.
    secure,
  };
}

function clientIp(request: FastifyRequest): string | undefined {
  return request.ip;
}

export async function authRoutes(app: FastifyInstance) {
  // GET /api/auth/status — o front Decide entre tela de login, wizard e app.
  // Pública: precisa responder antes de existir qualquer sessão.
  app.get('/api/auth/status', async () => {
    const accountExists = await hasAccount();
    return {
      setupComplete: false,
      accountExists,
      //Compatibilidade com o wizard antigo, que lia /api/setup/status
      needsSetup: !accountExists,
    };
  });

  // POST /api/auth/setup — cria a conta do primeiro boot. Só aceita requests
  // enquanto nenhuma conta existir; depois disso exige sessão válida (o guard
  // global bloqueia antes mesmo de chegar aqui).
  app.post('/api/auth/setup', { schema: { body: setupBodySchema } }, async (request, reply) => {
    const { email, password, confirmPassword } = request.body as z.infer<typeof setupBodySchema>;

    if (password !== confirmPassword) {
      return reply.status(400).send({ error: 'As senhas não coincidem' });
    }
    if (!isPasswordStrongEnough(password)) {
      return reply.status(400).send({ error: 'A senha precisa ter pelo menos 8 caracteres' });
    }

    if (await hasAccount()) {
      return reply.status(409).send({ error: 'Uma conta já foi criada' });
    }

    const { userId } = await setupAccount({ email, password });
    const { token, expiresAt } = await createSession(userId, {
      userAgent: request.headers['user-agent'],
      ip: clientIp(request),
    });

    // Já entra logado: o resto do wizard usa esta mesma sessão.
    return reply
      .setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
      .status(201)
      .send({ ok: true, user: { id: userId, email } });
  });

  // POST /api/auth/login
  app.post(
    '/api/auth/login',
    {
      schema: {
        body: z.object({ email: emailSchema, password: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };

      const user = await authenticate(email, password);
      if (!user) {
        // Mensagem genérica de propósito: não revelar se o email existe.
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      const { token, expiresAt } = await createSession(user.id, {
        userAgent: request.headers['user-agent'],
        ip: clientIp(request),
      });

      return reply
        .setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
        .send({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    },
  );

  // POST /api/auth/logout — revoga a sessão atual.
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (token) await revokeSession(token);
    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({ ok: true });
  });

  // GET /api/auth/me — quem está logado (usado pelo front para restaurar estado).
  app.get('/api/auth/me', async (request, reply) => {
    const token = request.cookies?.[SESSION_COOKIE];
    const resolved = await resolveSession(token);
    if (!resolved) {
      return reply.status(401).send({ error: 'Sessão inválida ou expirada' });
    }
    return {
      user: {
        id: resolved.user.id,
        email: resolved.user.email,
        name: resolved.user.name,
      },
      expiresAt: resolved.session.expiresAt,
    };
  });

  // GET /api/auth/sessions — dispositivos com sessão ativa.
  app.get('/api/auth/sessions', async (request, reply) => {
    const resolved = await requireSession(request, reply);
    if (!resolved) return;

    const sessions = await listSessions(resolved.user.id, request.cookies?.[SESSION_COOKIE]);
    return { sessions };
  });

  // DELETE /api/auth/sessions/:id — encerra um dispositivo específico.
  app.delete(
    '/api/auth/sessions/:id',
    { schema: { params: z.object({ id: z.string().min(1) }) } },
    async (request, reply) => {
      const resolved = await requireSession(request, reply);
      if (!resolved) return;

      const { id } = request.params as { id: string };
      const revoked = await revokeSessionById(resolved.user.id, id);
      if (!revoked) {
        return reply.status(404).send({ error: 'Sessão não encontrada' });
      }
      return { ok: true };
    },
  );

  // POST /api/auth/password — troca a própria senha.
  app.post(
    '/api/auth/password',
    {
      schema: {
        body: z.object({
          currentPassword: z.string().min(1),
          newPassword: passwordSchema,
        }),
      },
    },
    async (request, reply) => {
      const resolved = await requireSession(request, reply);
      if (!resolved) return;

      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!resolved.user.password || !verifyPassword(currentPassword, resolved.user.password)) {
        return reply.status(401).send({ error: 'Senha atual incorreta' });
      }
      if (currentPassword === newPassword) {
        return reply.status(400).send({ error: 'A nova senha deve ser diferente' });
      }

      await prisma.user.update({
        where: { id: resolved.user.id },
        data: { password: hashPassword(newPassword) },
      });

      // Senha trocada invalida as outras sessões: mantém só a atual.
      await prisma.session.updateMany({
        where: {
          userId: resolved.user.id,
          revokedAt: null,
          id: { not: resolved.session.id },
        },
        data: { revokedAt: new Date() },
      });

      return { ok: true };
    },
  );
}

// ── helpers internos ────────────────────────────────────────────────────────

async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const resolved = await resolveSession(request.cookies?.[SESSION_COOKIE]);
  if (!resolved) {
    reply.status(401).send({ error: 'Sessão inválida ou expirada' });
    return null;
  }
  return resolved;
}
