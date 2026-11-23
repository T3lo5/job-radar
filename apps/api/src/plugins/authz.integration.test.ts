import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { authGuard } from '../plugins/auth-guard.js';
import { SESSION_COOKIE, createSession } from '../services/auth.js';

/**
 * Cobertura do ticket 03 (auditoria 2026-10-28): sessão sozinha não basta.
 *
 * Antes, qualquer conta autenticada — inclusive uma criada pelo signup público
 * — podia trocar provedor/base URL de IA, token do Telegram e cron. O guarda
 * agora exige `role: ADMIN` para `/api/admin` e `/api/setup`.
 *
 * O teste monta rotas de mentira nesses prefixos: o que importa é o hook
 * global, não o handler. Assim os casos de 403 não tocam em settings nem em
 * credenciais.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__authz__';

let adminId = '';
let userId = '';
let adminToken = '';
let userToken = '';

async function app() {
  const f = Fastify({ logger: false });
  f.setValidatorCompiler(validatorCompiler);
  f.setSerializerCompiler(serializerCompiler);
  await f.register(cookie);
  // Direto, não `register`: plugin encapsula hooks, e o guard precisa valer
  // para as rotas registradas no mesmo escopo (é assim que o server faz).
  await authGuard(f);

  f.get('/api/admin/ping', async () => ({ ok: true }));
  f.post('/api/setup/ai', async () => ({ ok: true }));
  f.get('/api/setup/status', async () => ({ ok: true }));
  f.get('/api/profile', async () => ({ ok: true }));
  f.get('/api/auth/status', async () => ({ ok: true }));

  return f;
}

async function limpar() {
  await prisma.session.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
}

beforeAll(async () => {
  await prisma.$connect();
  await limpar();

  const [admin, user] = await Promise.all([
    prisma.user.create({
      data: { email: `${MARCA}admin@test.local`, password: 'x', role: 'ADMIN' },
    }),
    prisma.user.create({
      data: { email: `${MARCA}user@test.local`, password: 'x', role: 'USER' },
    }),
  ]);
  adminId = admin.id;
  userId = user.id;

  adminToken = (await createSession(adminId, {})).token;
  userToken = (await createSession(userId, {})).token;
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Sessões podem ter sido revogadas por um teste anterior, embora nenhum
  // teste aqui faça isso. Recriar mantém o arquivo independente.
  await prisma.session.deleteMany({ where: { userId: { in: [adminId, userId] } } });
  adminToken = (await createSession(adminId, {})).token;
  userToken = (await createSession(userId, {})).token;
});

function comSessao(token: string) {
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

describe('guarda de admin', () => {
  it('usuário comum recebe 403 em /api/admin', async () => {
    const f = await app();
    const r = await f.inject({
      method: 'GET',
      url: '/api/admin/ping',
      headers: comSessao(userToken),
    });

    expect(r.statusCode).toBe(403);
    await f.close();
  });

  it('usuário comum recebe 403 em /api/setup', async () => {
    const f = await app();
    const r = await f.inject({
      method: 'POST',
      url: '/api/setup/ai',
      headers: comSessao(userToken),
      payload: {},
    });

    expect(r.statusCode).toBe(403);
    await f.close();
  });

  it('admin acessa /api/admin e /api/setup', async () => {
    const f = await app();

    const admin = await f.inject({
      method: 'GET',
      url: '/api/admin/ping',
      headers: comSessao(adminToken),
    });
    expect(admin.statusCode).toBe(200);

    const setup = await f.inject({
      method: 'POST',
      url: '/api/setup/ai',
      headers: comSessao(adminToken),
      payload: {},
    });
    expect(setup.statusCode).toBe(200);

    await f.close();
  });

  it('rota protegida sem sessão continua 401', async () => {
    const f = await app();
    const r = await f.inject({ method: 'GET', url: '/api/profile' });

    expect(r.statusCode).toBe(401);
    await f.close();
  });

  it('status do setup e rotas de auth continuam públicas', async () => {
    const f = await app();

    const status = await f.inject({ method: 'GET', url: '/api/setup/status' });
    expect(status.statusCode).toBe(200);

    const auth = await f.inject({ method: 'GET', url: '/api/auth/status' });
    expect(auth.statusCode).toBe(200);

    await f.close();
  });
});

describe('URLs malformadas não pulam a guarda', () => {
  // Regressão do advisory do Fastify (ticket 09): bypass de autenticação por
  // URL malformada. Nenhuma variante pode chegar ao handler sem sessão.
  const urls = ['//api/profile', '/api//profile', '/api/profile/', '/%2e%2e/api/profile'];

  for (const url of urls) {
    it(`${url} não responde 200 sem sessão`, async () => {
      const f = await app();
      const r = await f.inject({ method: 'GET', url });

      expect(r.statusCode).not.toBe(200);
      await f.close();
    });
  }

  it('sessão USER não vira ADMIN por variação de URL', async () => {
    const f = await app();
    const r = await f.inject({
      method: 'GET',
      url: '//api/admin/ping',
      headers: comSessao(userToken),
    });

    expect(r.statusCode).not.toBe(200);
    await f.close();
  });
});
