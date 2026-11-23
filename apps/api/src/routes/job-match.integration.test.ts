import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { jobsRoutes } from './jobs.js';

/**
 * Ticket 18: o match de uma vaga não pode depender da lista paginada.
 *
 * Antes, o detalhe procurava o match no top 50 de `/api/match/results` e dizia
 * "ainda não avaliada" para qualquer vaga fora dele. O dashboard derivava a
 * contagem da mesma lista e subcontava.
 *
 * Os testes criam 60 matches — a vaga de menor score fica fora do top 50.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__match_por_vaga__';

let userId = '';
let profileId = '';
let sourceId = '';

/** Score 40..99: dez matches por faixa, média 69,5. */
const SCORES = Array.from({ length: 60 }, (_, i) => 40 + i);

let jobIds: string[] = [];

async function app() {
  const f = Fastify({ logger: false });
  f.setValidatorCompiler(validatorCompiler);
  f.setSerializerCompiler(serializerCompiler);
  f.addHook('preHandler', async (request) => {
    const id = request.headers['x-test-user'];
    if (typeof id !== 'string' || !id) return;
    const user = await prisma.user.findUnique({ where: { id } });
    (request as unknown as { user: typeof user }).user = user;
  });
  await f.register(jobsRoutes);
  return f;
}

async function limpar() {
  await prisma.jobMatch.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.job.deleteMany({ where: { hash: { startsWith: MARCA } } });
  await prisma.jobSource.deleteMany({ where: { name: { startsWith: MARCA } } });
}

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'Match' },
  });
  userId = user.id;

  const profile = await prisma.profile.create({
    data: { userId: user.id, title: 'Perfil match' },
  });
  profileId = profile.id;

  const source = await prisma.jobSource.findFirst();
  sourceId =
    source?.id ??
    (await prisma.jobSource.create({ data: { name: `${MARCA}fonte`, type: 'api' } })).id;

  jobIds = [];
  for (const [i, score] of SCORES.entries()) {
    const job = await prisma.job.create({
      data: {
        title: `Vaga ${i}`,
        company: MARCA,
        description: 'Descrição',
        url: `https://example.com/vaga-${i}`,
        hash: `${MARCA}${i}`,
        sourceId,
      },
    });
    jobIds.push(job.id);

    await prisma.jobMatch.create({
      data: {
        jobId: job.id,
        profileId,
        score,
        breakdown: { skills: score },
      },
    });
  }
}

const headers = () => ({ 'x-test-user': userId });

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
  await semear();
});

describe('GET /api/jobs/:id/match', () => {
  it('devolve o match da vaga fora do top 50', async () => {
    const f = await app();
    // SCORES[0] = 40, o menor: com a lista limitada a 50, ele fica de fora.
    const foraDoTop50 = jobIds[0];

    const res = await f.inject({
      method: 'GET',
      url: `/api/jobs/${foraDoTop50}/match`,
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    const { match } = res.json();
    expect(match).not.toBeNull();
    expect(match.score).toBe(40);
    expect(match.breakdown).toEqual({ skills: 40 });
    await f.close();
  });

  it('vaga existente sem match devolve match null com 200', async () => {
    const f = await app();
    const semMatch = await prisma.job.create({
      data: {
        title: 'Sem match',
        company: MARCA,
        description: 'Descrição',
        url: 'https://example.com/sem-match',
        hash: `${MARCA}sem-match`,
        sourceId,
      },
    });

    const res = await f.inject({
      method: 'GET',
      url: `/api/jobs/${semMatch.id}/match`,
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ match: null });
    await f.close();
  });

  it('vaga inexistente devolve 404', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs/clh1234567890abcdefghijkl/match',
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
    await f.close();
  });
});

describe('GET /api/match/results — lista limitada com total', () => {
  it('traz 50 itens e informa que existem 60', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/match/results',
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(50);
    expect(body.total).toBe(60);
    // Ordenado por score desc: o 50º é 50; o de 40 não aparece.
    expect(body.data[0].score).toBe(99);
    expect(body.data.at(-1).score).toBe(50);
    expect(body.data.some((m: { score: number }) => m.score === 40)).toBe(false);
    await f.close();
  });
});

describe('GET /api/match/stats', () => {
  it('conta as 60 vagas avaliadas, com média e distribuição completas', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/match/stats',
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    const stats = res.json();

    // A contagem real, não o tamanho da lista (50).
    expect(stats.total).toBe(60);
    expect(stats.averageScore).toBe(69.5);

    const porFaixa = Object.fromEntries(
      stats.distribution.map((d: { range: string; count: number }) => [d.range, d.count]),
    );
    expect(porFaixa).toEqual({
      '90+': 10,
      '80-89': 10,
      '70-79': 10,
      '60-69': 10,
      '50-59': 10,
      '<50': 10,
    });
    expect(stats.distribution.reduce((s: number, d: { count: number }) => s + d.count, 0)).toBe(60);
    await f.close();
  });

  it('sem matches, devolve zero sem divisão por zero', async () => {
    const f = await app();
    await prisma.jobMatch.deleteMany({ where: { profileId } });

    const res = await f.inject({
      method: 'GET',
      url: '/api/match/stats',
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      total: 0,
      averageScore: 0,
      distribution: [
        { range: '90+', count: 0 },
        { range: '80-89', count: 0 },
        { range: '70-79', count: 0 },
        { range: '60-69', count: 0 },
        { range: '50-59', count: 0 },
        { range: '<50', count: 0 },
      ],
    });
    await f.close();
  });
});
