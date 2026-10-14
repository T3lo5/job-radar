import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import { getAnalyticsOverview, normalizarDays } from './analytics.js';

/**
 * O analytics é a tela que responde "como estão as coisas". Se ela mentir —
 * período invertido, contagem errada, ranking instável — o usuário toma
 * decisão por um número falso, e nenhum erro aparece.
 *
 * Estes testes rodam contra Postgres porque o que mudou foi justamente a
 * agregação: antes contava em JavaScript depois de carregar a tabela, agora
 * pede GROUP BY. O comportamento precisa ser o mesmo.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__analytics__';

let sourceId: string;
const skillIds: Record<string, string> = {};

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}u@test.local`, password: 'x', name: 'A' },
  });
  const profile = await prisma.profile.create({
    data: { userId: user.id, title: 'Eng', seniority: 'SENIOR' },
  });
  const source = await prisma.jobSource.create({
    data: { name: `${MARCA}src`, type: 'api', enabled: true },
  });
  sourceId = source.id;

  for (const nome of ['React', 'Kubernetes', 'Rust', 'Elixir', 'Zig']) {
    const s = await prisma.skill.create({ data: { name: `${MARCA}${nome}`, aliases: [] } });
    skillIds[nome] = s.id;
  }

  // O perfil conhece React. As outras 4 são "lacunas" por definição.
  await prisma.profileSkill.create({
    data: { profileId: profile.id, skillId: skillIds.React, level: 'ADVANCED', yearsExp: 3 },
  });
}

/**
 * Contador para url/hash únicos.
 *
 * Sem ele, chamar `criarVagas(3, 'DONE', 1)` e depois `criarVagas(3, 'RAW', 1)`
 * geraria a mesma url e o mesmo hash, e a segunda chamada estouraria o @unique.
 */
let sequencia = 0;

/** Cria `n` vagas; `diasAtras` define se cai dentro ou fora da janela. */
async function criarVagas(
  n: number,
  status: 'RAW' | 'DONE' | 'MATCHING',
  diasAtras: number,
  skillsPorVaga: string[] = [],
) {
  for (let i = 0; i < n; i++) {
    const id = `${diasAtras}-${i}-${sequencia++}`;
    const job = await prisma.job.create({
      data: {
        title: `V ${id}`,
        company: 'C',
        description: 'd',
        location: null,
        remote: 'REMOTE',
        url: `https://a.test/${MARCA}${id}`,
        hash: `${MARCA}${id}`,
        status,
        sourceId,
        collectedAt: new Date(Date.now() - diasAtras * 86400000),
      },
    });
    for (const s of skillsPorVaga) {
      await prisma.jobSkill.create({ data: { jobId: job.id, skillId: skillIds[s] } });
    }
  }
}

async function limpar() {
  await prisma.job.deleteMany({ where: { url: { contains: MARCA } } });
  await prisma.application.deleteMany({ where: { notes: { contains: MARCA } } });
  await prisma.jobMatch.deleteMany({ where: { job: { url: { contains: MARCA } } } });
  await prisma.jobSource.deleteMany({ where: { name: { contains: MARCA } } });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.skill.deleteMany({ where: { name: { contains: MARCA } } });
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

describe('getAnalyticsOverview — contagens', () => {
  it('conta vagas por status dentro da janela', async () => {
    await criarVagas(3, 'DONE', 1);
    await criarVagas(2, 'RAW', 2);
    await criarVagas(9, 'MATCHING', 1);

    const r = await getAnalyticsOverview(30);
    expect(r.jobs.collected).toBe(14);
    expect(r.jobs.analyzed).toBe(3);
    expect(r.jobs.byStatus).toEqual({ DONE: 3, RAW: 2, MATCHING: 9 });
  });

  it('ignora vagas fora da janela', async () => {
    await criarVagas(5, 'DONE', 1);
    await criarVagas(50, 'DONE', 100); // 100 dias atrás, fora de 30

    const r = await getAnalyticsOverview(30);
    expect(r.jobs.collected).toBe(5);
  });

  it('periodo menor restringe a janela', async () => {
    await criarVagas(5, 'DONE', 1);
    await criarVagas(7, 'DONE', 20);

    expect((await getAnalyticsOverview(30)).jobs.collected).toBe(12);
    expect((await getAnalyticsOverview(7)).jobs.collected).toBe(5);
  });

  it('devolve zero com o banco vazio, sem quebrar', async () => {
    const r = await getAnalyticsOverview(30);
    expect(r.jobs.collected).toBe(0);
    expect(r.applications.total).toBe(0);
    expect(r.matches.averageScore).toBe(0);
    expect(r.rates.responseRate).toBe(0);
  });
});

describe('getAnalyticsOverview — skills', () => {
  it('conta frequência de skills entre as vagas da janela', async () => {
    await criarVagas(1, 'DONE', 1, ['React', 'Kubernetes', 'Rust']);
    await criarVagas(1, 'DONE', 1, ['React', 'Kubernetes']);
    await criarVagas(1, 'DONE', 1, ['React']);

    const r = await getAnalyticsOverview(30);
    const porNome = Object.fromEntries(r.skills.mostFrequent.map((s) => [s.name, s.count]));

    expect(porNome[`${MARCA}React`]).toBe(3);
    expect(porNome[`${MARCA}Kubernetes`]).toBe(2);
    expect(porNome[`${MARCA}Rust`]).toBe(1);
  });

  it('lacunas excluem as skills que o perfil ja tem', async () => {
    await criarVagas(2, 'DONE', 1, ['React', 'Rust']);

    const r = await getAnalyticsOverview(30);
    const lacunas = r.skills.biggestGaps.map((s) => s.name);

    expect(lacunas).toContain(`${MARCA}Rust`);
    // React está no perfil: não é lacuna.
    expect(lacunas).not.toContain(`${MARCA}React`);
    expect(r.skills.mostFrequent.map((s) => s.name)).toContain(`${MARCA}React`);
  });

  it('ordena por contagem decrescente', async () => {
    await criarVagas(5, 'DONE', 1, ['Zig']);
    await criarVagas(1, 'DONE', 1, ['Elixir']);

    const r = await getAnalyticsOverview(30);
    const contagens = r.skills.mostFrequent.map((s) => s.count);
    expect([...contagens].sort((a, b) => b - a)).toEqual(contagens);
  });

  it('ordem estavel quando ha empate de contagem', async () => {
    // Empate: o banco pode devolver qualquer um. O corte por nome deixa a
    // mesma tela aparecer sempre, em vez de oscilar entre execuções.
    await criarVagas(1, 'DONE', 1, ['Rust', 'Elixir', 'Zig']);

    const primeira = (await getAnalyticsOverview(30)).skills.mostFrequent.map((s) => s.name);
    const segunda = (await getAnalyticsOverview(30)).skills.mostFrequent.map((s) => s.name);
    expect(segunda).toEqual(primeira);
  });

  it('nao traz mais de 10 skills', async () => {
    await criarVagas(1, 'DONE', 1, ['React', 'Kubernetes', 'Rust', 'Elixir', 'Zig']);
    const r = await getAnalyticsOverview(30);
    expect(r.skills.mostFrequent.length).toBeLessThanOrEqual(10);
    expect(r.skills.biggestGaps.length).toBeLessThanOrEqual(10);
  });

  it('ignora skills de vagas fora da janela', async () => {
    await criarVagas(1, 'DONE', 1, ['Rust']);
    await criarVagas(20, 'DONE', 90, ['Zig']); // fora de 30 dias

    const r = await getAnalyticsOverview(30);
    const nomes = r.skills.mostFrequent.map((s) => s.name);
    expect(nomes).toContain(`${MARCA}Rust`);
    expect(nomes).not.toContain(`${MARCA}Zig`);
  });

  it('funciona sem nenhuma skill no perfil (notIn vazio)', async () => {
    // `skillId: { notIn: [] }` e um caso de borda do Prisma: se a condição
    // fosse malformada, nenhuma skill apareceria.
    await prisma.profileSkill.deleteMany({});
    await criarVagas(1, 'DONE', 1, ['Rust', 'Elixir']);

    const r = await getAnalyticsOverview(30);
    const lacunas = r.skills.biggestGaps.map((s) => s.name);
    expect(lacunas).toContain(`${MARCA}Rust`);
    expect(lacunas).toContain(`${MARCA}Elixir`);
  });
});

describe('normalizarDays', () => {
  it('aceita a faixa valida', () => {
    expect(normalizarDays(1)).toBe(1);
    expect(normalizarDays(30)).toBe(30);
    expect(normalizarDays(365)).toBe(365);
  });

  it('repara em entrada nao numerica', () => {
    expect(normalizarDays('abc')).toBe(30);
    expect(normalizarDays(undefined)).toBe(30);
    expect(normalizarDays(null)).toBe(30);
  });

  it('repara em zero e negativo', () => {
    // `days=-5` produzia um período no FUTURO: a tela mostrava "0 vagas"
    // como se fosse resultado de verdade.
    expect(normalizarDays(0)).toBe(30);
    expect(normalizarDays(-5)).toBe(30);
  });

  it('limita o teto', () => {
    expect(normalizarDays(99999)).toBe(30);
    expect(normalizarDays(1.5)).toBe(30);
  });

  it('nunca deixa passar valor que produza Data invalida', () => {
    for (const v of [NaN, Infinity, -Infinity, 'x', {}, [], -0]) {
      const dias = normalizarDays(v);
      const from = new Date(Date.now() - dias * 86400000);
      expect(isNaN(from.getTime())).toBe(false);
      expect(from.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });
});
