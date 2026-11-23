import { describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import {
  AUTH_RATE_LIMIT,
  CREDENTIAL_RATE_LIMIT,
  GLOBAL_RATE_LIMIT,
  authRateLimitFor,
  parseOrigins,
  parseTrustProxy,
  rateLimitErrorResponse,
  resolveCorsOrigins,
} from './http-security.js';

/**
 * Ticket 24: CORS, rate limit e proxy.
 *
 * Os testes de HTTP montam um app com exatamente os mesmos helpers que o
 * `server.ts` usa, na mesma ordem de registro — inclusive o `onRoute` antes do
 * `@fastify/rate-limit`, que é o que faz o limite por rota valer.
 */

async function montarApp(opcoes: {
  trustProxy?: string;
  corsOrigins?: string;
  nodeEnv?: string;
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: parseTrustProxy(opcoes.trustProxy),
  });

  await app.register(cors, {
    origin: resolveCorsOrigins(opcoes.corsOrigins, opcoes.nodeEnv ?? 'production'),
    credentials: true,
  });

  // Mesma ordem do server: o hook precisa existir antes do plugin.
  app.addHook('onRoute', (route) => {
    const rule = authRateLimitFor(route.url);
    if (!rule) return;
    route.config ??= {};
    route.config.rateLimit ??= rule;
  });

  await app.register(rateLimit, {
    ...GLOBAL_RATE_LIMIT,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => rateLimitErrorResponse(context),
  });

  app.post(
    '/api/auth/login',
    { config: { rateLimit: CREDENTIAL_RATE_LIMIT } },
    async (_request, reply) => reply.status(401).send({ error: 'Email ou senha incorretos' }),
  );
  app.get('/api/auth/me', async () => ({ user: null }));
  app.get('/api/jobs', async () => ({ data: [] }));

  await app.ready();
  return app;
}

const login = (app: FastifyInstance, ip: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-forwarded-for': ip },
    payload: { email: 'a@b.test', password: 'x' },
  });

describe('parseOrigins', () => {
  it('ignora espaços e entradas vazias', () => {
    expect(parseOrigins(' https://a.test , ,https://b.test/ ')).toEqual([
      'https://a.test',
      'https://b.test/',
    ]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe('resolveCorsOrigins', () => {
  it('falha o boot em produção sem CORS_ORIGINS', () => {
    expect(() => resolveCorsOrigins(undefined, 'production')).toThrow(/CORS_ORIGINS é obrigatório/);
    expect(() => resolveCorsOrigins('  ', 'production')).toThrow(/CORS_ORIGINS é obrigatório/);
  });

  it('em produção, aceita só a lista configurada', () => {
    expect(resolveCorsOrigins('https://app.test', 'production')).toEqual(['https://app.test']);
  });

  it('em dev, libera só localhost — nunca qualquer origem', () => {
    const origens = resolveCorsOrigins(undefined, 'development');
    const aceita = (origin: string) =>
      origens.some((o) => (o instanceof RegExp ? o.test(origin) : o === origin));

    expect(aceita('http://localhost:5173')).toBe(true);
    expect(aceita('http://127.0.0.1:5173')).toBe(true);
    expect(aceita('https://evil.test')).toBe(false);
    expect(aceita('http://localhost.evil.test')).toBe(false);
  });
});

describe('parseTrustProxy', () => {
  it('desliga por padrão', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
  });

  it('true confia em tudo (só para API não exposta direto)', () => {
    expect(parseTrustProxy('true')).toBe(true);
  });

  it('número de hops confia só nos N primeiros proxies', () => {
    const fn = parseTrustProxy('1');
    expect(typeof fn).toBe('function');
    const hopFn = fn as (address: string, hop: number) => boolean;

    expect(hopFn('10.0.0.1', 0)).toBe(true); // o nginx
    expect(hopFn('203.0.113.9', 1)).toBe(false); // o cliente
  });

  it('valor inválido falha com mensagem acionável', () => {
    expect(() => parseTrustProxy('abc')).toThrow(/TRUST_PROXY inválido/);
    expect(() => parseTrustProxy('11')).toThrow(/TRUST_PROXY inválido/);
    expect(() => parseTrustProxy('-1')).toThrow(/TRUST_PROXY inválido/);
  });
});

describe('authRateLimitFor', () => {
  it('credenciais têm limite próprio e backoff', () => {
    for (const url of ['/api/auth/login', '/api/auth/signup', '/api/auth/setup']) {
      expect(authRateLimitFor(url)).toEqual(CREDENTIAL_RATE_LIMIT);
    }
    expect(CREDENTIAL_RATE_LIMIT.max).toBeLessThan(AUTH_RATE_LIMIT.max);
    expect(CREDENTIAL_RATE_LIMIT.continueExceeding).toBe(true);
  });

  it('demais rotas de auth usam o limite de auth', () => {
    expect(authRateLimitFor('/api/auth/me')).toEqual(AUTH_RATE_LIMIT);
    expect(authRateLimitFor('/api/auth/sessions')).toEqual(AUTH_RATE_LIMIT);
  });

  it('rotas fora de auth não recebem regra (vale a global)', () => {
    expect(authRateLimitFor('/api/jobs')).toBeUndefined();
    expect(authRateLimitFor('/api/auth')).toBeUndefined();
  });
});

describe('CORS no HTTP', () => {
  it('origem listada recebe o header; origem estranha não', async () => {
    const app = await montarApp({ corsOrigins: 'https://app.test' });

    const permitida = await app.inject({
      method: 'OPTIONS',
      url: '/api/jobs',
      headers: {
        origin: 'https://app.test',
        'access-control-request-method': 'GET',
      },
    });
    expect(permitida.statusCode).toBeLessThan(400);
    expect(permitida.headers['access-control-allow-origin']).toBe('https://app.test');

    const negada = await app.inject({
      method: 'OPTIONS',
      url: '/api/jobs',
      headers: {
        origin: 'https://evil.test',
        'access-control-request-method': 'GET',
      },
    });
    expect(negada.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('não reflete origem arbitrária (sem `origin: true`)', async () => {
    const app = await montarApp({ corsOrigins: 'https://app.test' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs',
      headers: { origin: 'https://evil.test' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});

describe('rate limit no HTTP', () => {
  it('o 6º login no mesmo minuto recebe 429 com Retry-After', async () => {
    const app = await montarApp({ trustProxy: '1', corsOrigins: 'https://app.test' });

    for (let i = 0; i < 5; i++) {
      const res = await login(app, '203.0.113.10');
      expect(res.statusCode).toBe(401);
    }

    const sexto = await login(app, '203.0.113.10');
    expect(sexto.statusCode).toBe(429);
    expect(sexto.headers['retry-after']).toBeDefined();
    expect(sexto.json().message).toMatch(/Muitas requisições/);

    await app.close();
  });

  it('dois clientes atrás do nginx têm buckets independentes', async () => {
    const app = await montarApp({ trustProxy: '1', corsOrigins: 'https://app.test' });

    for (let i = 0; i < 5; i++) {
      expect((await login(app, '203.0.113.10')).statusCode).toBe(401);
    }
    expect((await login(app, '203.0.113.10')).statusCode).toBe(429);

    // Outro IP real continua passando: o bucket não é do proxy.
    expect((await login(app, '203.0.113.20')).statusCode).toBe(401);

    await app.close();
  });

  it('sem trustProxy, X-Forwarded-For não separa clientes', async () => {
    const app = await montarApp({ corsOrigins: 'https://app.test' });

    for (let i = 0; i < 5; i++) {
      expect((await login(app, `198.51.100.${i}`)).statusCode).toBe(401);
    }
    // IPs diferentes no header, mas todos vistos como o mesmo peer.
    expect((await login(app, '198.51.100.99')).statusCode).toBe(429);

    await app.close();
  });

  it('rotas /api/auth/* usam 20/min (não o global nem o de credenciais)', async () => {
    const app = await montarApp({ trustProxy: '1', corsOrigins: 'https://app.test' });

    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { 'x-forwarded-for': '203.0.113.30' },
      });
      expect(res.statusCode).toBe(200);
    }

    const vigesimaPrimeira = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { 'x-forwarded-for': '203.0.113.30' },
    });
    expect(vigesimaPrimeira.statusCode).toBe(429);

    await app.close();
  });
});
