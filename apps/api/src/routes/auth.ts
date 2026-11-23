import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  SESSION_COOKIE,
  allowSignupEnabled,
  authenticate,
  createSession,
  hasAccount,
  hashPassword,
  isPasswordStrongEnough,
  isSignupAllowed,
  listSessions,
  revokeSession,
  revokeSessionById,
  resolveSession,
  setupAccount,
  signupAccount,
  verifyPassword,
} from '../services/auth.js';
import { prisma } from '../db/prisma.js';
import { deleteFile } from '../services/file-storage.js';
import { CREDENTIAL_RATE_LIMIT } from '../config/http-security.js';

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
      // O front só oferece "Criar conta" quando o cadastro está realmente
      // aberto. Sem isto, o link levava a uma tela que sempre dava 403.
      allowSignup: isSignupAllowed(accountExists, allowSignupEnabled()),
    };
  });

  // POST /api/auth/setup — cria a conta do primeiro boot. Só aceita requests
  // enquanto nenhuma conta existir; depois disso exige sessão válida (o guard
  // global bloqueia antes mesmo de chegar aqui).
  app.post(
    '/api/auth/setup',
    { schema: { body: setupBodySchema }, config: { rateLimit: CREDENTIAL_RATE_LIMIT } },
    async (request, reply) => {
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
    },
  );

  // POST /api/auth/signup — cadastro público de nova conta.
  //
  // Fechado por default (ticket 01 da auditoria 2026-10-28): com conta já
  // existente e sem ALLOW_SIGNUP=true, retorna 403. Antes, qualquer visitante
  // criava conta e as rotas sem escopo por userId mostravam os dados do dono.
  app.post(
    '/api/auth/signup',
    { schema: { body: setupBodySchema }, config: { rateLimit: CREDENTIAL_RATE_LIMIT } },
    async (request, reply) => {
      const accountExists = await hasAccount();
      if (!isSignupAllowed(accountExists, allowSignupEnabled())) {
        return reply.status(403).send({
          error: 'SIGNUP_DISABLED',
          message: 'O cadastro público está desativado nesta instalação.',
        });
      }

      const { email, password, confirmPassword } = request.body as z.infer<typeof setupBodySchema>;

      if (password !== confirmPassword) {
        return reply.status(400).send({ error: 'As senhas não coincidem' });
      }
      if (!isPasswordStrongEnough(password)) {
        return reply.status(400).send({ error: 'A senha precisa ter pelo menos 8 caracteres' });
      }

      let userId: string;
      try {
        ({ userId } = await signupAccount({ email, password }));
      } catch (err) {
        return reply.status(409).send({
          error: err instanceof Error ? err.message : 'Não foi possível criar a conta',
        });
      }

      const { token, expiresAt } = await createSession(userId, {
        userAgent: request.headers['user-agent'],
        ip: clientIp(request),
      });

      return reply
        .setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt))
        .status(201)
        .send({ ok: true, user: { id: userId, email } });
    },
  );

  // POST /api/auth/login
  app.post(
    '/api/auth/login',
    {
      schema: {
        body: z.object({ email: emailSchema, password: z.string().min(1) }),
      },
      config: { rateLimit: CREDENTIAL_RATE_LIMIT },
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
        role: resolved.user.role,
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

  // GET /api/auth/export/me — exporta todos os dados do usuário em JSON.
  // Inclui conta, perfil, currículos (texto e metadados), candidaturas,
  // matches e sessões. Não inclui senha nem tokens de sessão.
  app.get('/api/auth/export/me', async (request, reply) => {
    const resolved = await requireSession(request, reply);
    if (!resolved) return;

    const userId = resolved.user.id;

    const [user, profile, resumes, applications, sessions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
      prisma.profile.findUnique({
        where: { userId },
        include: {
          skills: { include: { skill: true } },
          projects: true,
          education: true,
          certifications: true,
          languages: true,
          workExperiences: true,
        },
      }),
      prisma.resume.findMany({
        where: { userId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          isDefault: true,
          uploadedAt: true,
          rawText: true,
          parsedJson: true,
        },
      }),
      prisma.application.findMany({
        where: { profile: { userId } },
        include: { job: { select: { id: true, title: true, company: true } } },
      }),
      prisma.session.findMany({
        where: { userId },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          lastUsedAt: true,
        },
      }),
    ]);

    const matches = profile
      ? await prisma.jobMatch.findMany({
          where: { profileId: profile.id },
          include: { job: { select: { id: true, title: true, company: true } } },
        })
      : [];

    const resumesWithIssues = resumes.map((r) => ({
      ...r,
      sensitiveIssues: (r.parsedJson as any)?.sensitiveIssues ?? [],
    }));

    return reply.send({
      exportedAt: new Date().toISOString(),
      user,
      profile,
      resumes: resumesWithIssues,
      applications,
      matches,
      sessions,
    });
  });

  // DELETE /api/auth/me — deleta a conta e todos os dados associados.
  // Remove: arquivos de currículo, currículos, candidaturas, matches,
  // perfil, sessões (todas revogadas) e o usuário. Irreversível.
  app.delete('/api/auth/me', async (request, reply) => {
    const resolved = await requireSession(request, reply);
    if (!resolved) return;

    const userId = resolved.user.id;

    // Deleta arquivos físicos dos currículos antes de apagar os registros.
    const resumes = await prisma.resume.findMany({
      where: { userId },
      select: { filename: true },
    });
    for (const resume of resumes) {
      await deleteFile(resume.filename).catch(() => {
        // Arquivo pode já não existir; segue a deleção lógica.
      });
    }

    // A exclusão do usuário roda em cascata (onDelete: Cascade) para
    // profile, resumes, sessions, jobs (criados por ele), applications,
    // matches, etc. O banco cuida das tabelas relacionadas.
    await prisma.user.delete({ where: { id: userId } });

    return reply.clearCookie(SESSION_COOKIE, { path: '/' }).send({ ok: true });
  });
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
