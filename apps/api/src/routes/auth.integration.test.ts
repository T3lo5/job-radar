import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { authRoutes } from './auth.js';
import { isSignupAllowed } from '../services/auth.js';

/**
 * Cobertura do ticket 01 (auditoria 2026-10-28): com conta já existente,
 * `/api/auth/signup` não pode criar outra. Sem isso, qualquer visitante
 * entrava e — via rotas sem escopo por userId — via os dados do dono.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__authrota__';

async function app() {
  const f = Fastify({ logger: false });
  f.setValidatorCompiler(validatorCompiler);
  f.setSerializerCompiler(serializerCompiler);
  await f.register(cookie);
  await f.register(authRoutes);
  return f;
}

async function limpar() {
  await prisma.session.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
}

beforeAll(async () => {
  await prisma.$connect();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpar();
});

afterEach(() => {
  delete process.env.ALLOW_SIGNUP;
});

const payload = {
  email: `${MARCA}novo@test.local`,
  password: 'senha-forte-123',
  confirmPassword: 'senha-forte-123',
};

describe('isSignupAllowed', () => {
  it('libera o bootstrap quando ainda não existe conta', () => {
    expect(isSignupAllowed(false, false)).toBe(true);
  });

  it('fecha quando já existe conta e a flag está desligada', () => {
    expect(isSignupAllowed(true, false)).toBe(false);
  });

  it('reabre com ALLOW_SIGNUP=true', () => {
    expect(isSignupAllowed(true, true)).toBe(true);
  });
});

describe('POST /api/auth/signup', () => {
  it('retorna 403 quando já existe conta e a flag está desligada', async () => {
    await prisma.user.create({
      data: { email: `${MARCA}existente@test.local`, password: 'hash-qualquer' },
    });

    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/signup', payload });

    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe('SIGNUP_DISABLED');
    expect(await prisma.user.count({ where: { email: payload.email } })).toBe(0);
    await f.close();
  });

  it('cria conta com papel USER quando ALLOW_SIGNUP=true', async () => {
    process.env.ALLOW_SIGNUP = 'true';
    await prisma.user.create({
      data: { email: `${MARCA}existente@test.local`, password: 'hash-qualquer' },
    });

    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/signup', payload });

    expect(r.statusCode).toBe(201);
    const criado = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
    expect(criado.role).toBe('USER');
    await f.close();
  });

  it('permite o primeiro cadastro (bootstrap) sem a flag', async () => {
    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/signup', payload });

    expect(r.statusCode).toBe(201);
    await f.close();
  });

  it('retorna 409 para email já usado em vez de estourar 500', async () => {
    process.env.ALLOW_SIGNUP = 'true';
    await prisma.user.create({
      data: { email: payload.email, password: 'hash-qualquer' },
    });

    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/signup', payload });

    expect(r.statusCode).toBe(409);
    await f.close();
  });
});

describe('GET/DELETE /api/auth/export-me e /api/auth/me — ticket 34 (PII)', () => {
  const payload = {
    email: `${MARCA}-export@test.local`,
    password: 'SenhaForte123',
    confirmPassword: 'SenhaForte123',
  };

  it('export devolve dados do usuário, delete apaga tudo e login falha depois', async () => {
    process.env.ALLOW_SIGNUP = 'true';

    // Cria conta
    const fCreate = await app();
    const rCreate = await fCreate.inject({
      method: 'POST',
      url: '/api/auth/signup',
      payload,
    });
    expect(rCreate.statusCode).toBe(201);
    await fCreate.close();

    // Faz login para obter cookie de sessão
    const fLogin = await app();
    const rLogin = await fLogin.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: payload.email, password: payload.password },
    });
    expect(rLogin.statusCode).toBe(200);
    const setCookie = rLogin.headers['set-cookie'];
    const cookieValue = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookieOnly = cookieValue?.split(';')[0] ?? '';
    const [cookieName, cookieVal] = cookieOnly.split('=');
    await fLogin.close();

    const cookies = { [cookieName]: cookieVal ?? '' };

    // Export devolve os dados do usuário
    const fExport = await app();
    const rExport = await fExport.inject({
      method: 'GET',
      url: '/api/auth/export/me',
      cookies,
    });
    expect(rExport.statusCode).toBe(200);
    const exportBody = rExport.json();
    expect(exportBody.user.email).toBe(payload.email);
    await fExport.close();

    // Delete apaga a conta
    const fDelete = await app();
    const rDelete = await fDelete.inject({
      method: 'DELETE',
      url: '/api/auth/me',
      cookies,
    });
    expect(rDelete.statusCode).toBe(200);
    await fDelete.close();

    // Depois do delete, o cookie de sessão não serve mais (usuário não existe)
    const fMe = await app();
    const rMe = await fMe.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    expect(rMe.statusCode).toBe(401);
    await fMe.close();

    // Usuário não existe mais no banco
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    expect(user).toBeNull();
  });
});
