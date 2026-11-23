import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { jobsRoutes } from './jobs.js';

/**
 * Ticket 19: ordenação e filtro de score no servidor, antes da paginação.
 *
 * A UI ordenava só a página carregada — com 3 páginas, "ordenar por match"
 * mostrava os melhores scores de cada página, não do conjunto.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__jobs_sort__';

let userId = '';
let profileId = '';
let sourceId = '';

const TOTAL = 45;

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

/**
 * 45 vagas com score 44..0. A ordem por match esperada é a ordem de criação;
 * a ordem por data é a inversa (cada vaga é criada um instante depois).
 */
async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'Sort' },
  });
  userId = user.id;

  const profile = await prisma.profile.create({
    data: { userId: user.id, title: 'Perfil sort' },
  });
  profileId = profile.id;

  sourceId = (await prisma.jobSource.create({ data: { name: `${MARCA}fonte`, type: 'api' } })).id;

  for (let i = 0; i < TOTAL; i++) {
    const job = await prisma.job.create({
      data: {
        title: `Vaga ${String(i).padStart(2, '0')}`,
        company: MARCA,
        description: 'Descrição',
        url: `https://example.com/sort-${i}`,
        hash: `${MARCA}${i}`,
        sourceId,
      },
    });
    await prisma.jobMatch.create({
      data: {
        jobId: job.id,
        profileId,
        score: TOTAL - 1 - i,
        breakdown: {},
      },
    });
  }
}

const headers = () => ({ 'x-test-user': userId });

async function pagina(f: Awaited<ReturnType<typeof app>>, page: number, extra = '') {
  const res = await f.inject({
    method: 'GET',
    url: `/api/jobs?page=${page}&limit=20&sort=match${extra}`,
    headers: headers(),
  });
  expect(res.statusCode).toBe(200);
  return res.json();
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
  await semear();
});

describe('GET /api/jobs — sort=match', () => {
  it('ordena o conjunto inteiro, não só cada página', async () => {
    const f = await app();

    const p1 = await pagina(f, 1);
    const p2 = await pagina(f, 2);
    const p3 = await pagina(f, 3);

    const scores = [...p1.data, ...p2.data, ...p3.data].map((j: { id: string }) => j.id);
    // Sem duplicatas entre páginas e com as 45 vagas cobertas.
    expect(new Set(scores).size).toBe(TOTAL);
    expect(scores).toHaveLength(TOTAL);

    // O servidor devolve na ordem de score desc; confere pelos matches.
    const matches = await prisma.jobMatch.findMany({
      where: { profileId },
      orderBy: { score: 'desc' },
      select: { jobId: true },
    });
    expect(scores).toEqual(matches.map((m) => m.jobId));

    expect(p1.pagination.total).toBe(TOTAL);
    expect(p1.pagination.totalPages).toBe(3);
    // A primeira página traz os 20 maiores; a última, os 5 menores.
    expect(p3.data).toHaveLength(5);
    await f.close();
  });

  it('minScore filtra antes de paginar', async () => {
    const f = await app();

    const p1 = await pagina(f, 1, '&minScore=30');
    expect(p1.pagination.total).toBe(15); // scores 44..30
    expect(p1.data).toHaveLength(15);
    expect(p1.pagination.totalPages).toBe(1);

    const scores = await Promise.all(
      p1.data.map(async (j: { id: string }) => {
        const m = await prisma.jobMatch.findFirstOrThrow({ where: { jobId: j.id, profileId } });
        return m.score;
      }),
    );
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(30);
    await f.close();
  });
});

describe('GET /api/jobs — sort=title e date', () => {
  it('ordena por título no servidor', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=50&sort=title',
      headers: headers(),
    });

    const titulos = res.json().data.map((j: { title: string }) => j.title);
    expect(titulos).toEqual([...titulos].sort((a, b) => a.localeCompare(b)));
    await f.close();
  });

  it('perfil sem matches: sort=match devolve vagas (NULLS LAST) em vez de quebrar', async () => {
    const f = await app();
    await prisma.jobMatch.deleteMany({ where: { profileId } });

    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=5&sort=match',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(5);
    await f.close();
  });
});

describe('GET /api/jobs — minConfidence', () => {
  it('filtra vagas com confiança abaixo do mínimo', async () => {
    const f = await app();

    // Vaga de alta confiança: fresca, 3 fontes, salário, descrição longa
    const alta = await prisma.job.create({
      data: {
        title: 'Vaga Alta Confiança',
        company: MARCA,
        description: 'A'.repeat(600),
        url: 'https://example.com/alta',
        hash: `${MARCA}alta`,
        sourceId,
        sourceCount: 3,
        salaryMin: 8000,
        salaryMax: 12000,
      },
    });
    await prisma.jobMatch.create({
      data: { jobId: alta.id, profileId, score: 90, breakdown: {} },
    });

    // Vaga de baixa confiança: antiga, 1 fonte, sem salário, descrição curta
    const baixa = await prisma.job.create({
      data: {
        title: 'Vaga Baixa Confiança',
        company: MARCA,
        description: 'Vaga',
        url: 'https://example.com/baixa',
        hash: `${MARCA}baixa`,
        sourceId,
        sourceCount: 1,
        salaryMin: null,
        salaryMax: null,
        collectedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.jobMatch.create({
      data: { jobId: baixa.id, profileId, score: 50, breakdown: {} },
    });

    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=50&minConfidence=70',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    const ids = data.map((j: { id: string }) => j.id);
    expect(ids).toContain(alta.id);
    expect(ids).not.toContain(baixa.id);

    // Confiança exibida em cada vaga
    const altaJob = data.find((j: { id: string }) => j.id === alta.id);
    expect(altaJob.confidence).toBeGreaterThanOrEqual(70);

    await f.close();
  });
});

describe('GET /api/jobs — matchScore por vaga', () => {
  it('devolve o score de cada vaga, não só o top 50', async () => {
    const f = await app();

    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=50&sort=date',
      headers: headers(),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Array<{ id: string; matchScore: number | null }>;

    // Cada vaga traz o próprio score (aqui todas têm match).
    for (const job of data) {
      const m = await prisma.jobMatch.findFirstOrThrow({ where: { jobId: job.id, profileId } });
      expect(job.matchScore).toBe(m.score);
    }
    await f.close();
  });

  it('vaga sem match vem com matchScore null', async () => {
    const f = await app();
    const semMatch = await prisma.job.create({
      data: {
        title: 'Vaga sem match',
        company: MARCA,
        description: 'Descrição',
        url: 'https://example.com/sem-match',
        hash: `${MARCA}sem-match`,
        sourceId,
      },
    });

    const res = await f.inject({
      method: 'GET',
      url: `/api/jobs?limit=100&sort=date`,
      headers: headers(),
    });
    const job = res.json().data.find((j: { id: string }) => j.id === semMatch.id);
    expect(job.matchScore).toBeNull();
    await f.close();
  });
});

describe('Descartar / restaurar vaga', () => {
  it('descartar tira da lista geral e leva para discarded=discarded', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=1&sort=date',
      headers: headers(),
    });
    const alvo = res.json().data[0] as { id: string };

    const desc = await f.inject({
      method: 'POST',
      url: `/api/jobs/${alvo.id}/discard`,
      headers: headers(),
    });
    expect(desc.statusCode).toBe(200);
    expect(desc.json().discardedAt).toBeTruthy();

    // Não aparece mais na lista ativa.
    const ativa = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=100',
      headers: headers(),
    });
    expect(ativa.json().data.map((j: { id: string }) => j.id)).not.toContain(alvo.id);

    // Aparece nos descartes.
    const descartes = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=100&discarded=discarded',
      headers: headers(),
    });
    expect(descartes.json().data.map((j: { id: string }) => j.id)).toContain(alvo.id);

    // Restaura e volta para a lista ativa.
    const rest = await f.inject({
      method: 'POST',
      url: `/api/jobs/${alvo.id}/restore`,
      headers: headers(),
    });
    expect(rest.statusCode).toBe(200);
    expect(rest.json().discardedAt).toBeNull();

    const ativa2 = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=100',
      headers: headers(),
    });
    expect(ativa2.json().data.map((j: { id: string }) => j.id)).toContain(alvo.id);
    await f.close();
  });

  it('descartar vaga inexistente devolve 404', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'POST',
      url: '/api/jobs/clh1234567890abcdefghijkl/discard',
      headers: headers(),
    });
    expect(res.statusCode).toBe(404);
    await f.close();
  });
});

describe('POST /api/match/evaluate-all', () => {
  it('avalia várias vagas de uma vez e persiste os scores', async () => {
    const f = await app();
    const res = await f.inject({
      method: 'GET',
      url: '/api/jobs?limit=10&sort=date',
      headers: headers(),
    });
    const ids = res
      .json()
      .data.slice(0, 5)
      .map((j: { id: string }) => j.id);

    const ev = await f.inject({
      method: 'POST',
      url: '/api/match/evaluate-all',
      headers: headers(),
      payload: { jobIds: ids },
    });
    expect(ev.statusCode).toBe(200);
    expect(ev.json().evaluated).toBe(ids.length);
    expect(ev.json().results).toHaveLength(ids.length);

    // Cada vaga avaliada tem score persistido.
    for (const id of ids) {
      const m = await prisma.jobMatch.findFirstOrThrow({ where: { jobId: id, profileId } });
      expect(m.score).toBeGreaterThanOrEqual(0);
    }
    await f.close();
  });

  it('lista vazia não avalia nada e não quebra', async () => {
    const f = await app();
    const ev = await f.inject({
      method: 'POST',
      url: '/api/match/evaluate-all',
      headers: headers(),
      payload: { jobIds: [] },
    });
    expect(ev.statusCode).toBe(200);
    expect(ev.json().evaluated).toBe(0);
    await f.close();
  });
});
