import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { profileRoutes } from './profile.js';

/**
 * Prova em nível HTTP dos bugs de edição do perfil.
 *
 * Os testes de unidade cobrem os schemas e os helpers do front, mas o que o
 * usuário sentia era o 400 na rota: editar experiência importada do CV (sem
 * datas) falhava, adicionar certificado sem datas falhava, e adicionar skill
 * com caixa diferente duplicava o catálogo.
 *
 * Registra só o módulo de rotas, sem o hook global de auth — o que está em
 * teste é a validação e a persistência, não a sessão.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__perfilrota__';

async function app() {
  const f = Fastify({ logger: false });
  f.setValidatorCompiler(validatorCompiler);
  f.setSerializerCompiler(serializerCompiler);
  await f.register(profileRoutes);
  return f;
}

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'Rota' },
  });
  await prisma.profile.create({ data: { userId: user.id, title: 'Dev' } });
}

async function limpar() {
  await prisma.profileSkill.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.workExperience.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.certification.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  // `mode: 'insensitive'` de propósito: o teste cria de caso pensado uma
  // skill em CAIXA ALTA, e um startsWith case-sensitive não a enxergaria na
  // limpeza — ela vazaria para a próxima execução e quebraria a contagem.
  await prisma.skill.deleteMany({ where: { name: { startsWith: MARCA, mode: 'insensitive' } } });
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

describe('PUT work-experience com datas vazias', () => {
  it('editar experiência importada (sem datas) salva em vez de 400', async () => {
    const f = await app();

    // Experiência como a importação do CV cria: sem datas.
    const profile = await prisma.profile.findFirstOrThrow({
      where: { user: { email: { contains: MARCA } } },
    });
    const exp = await prisma.workExperience.create({
      data: { profileId: profile.id, company: 'Acme', role: 'Dev', description: 'x' },
    });

    // O front manda '' para os inputs date vazios — era exatamente isto que
    // voltava 400 com "Invalid date".
    const r = await f.inject({
      method: 'PUT',
      url: `/api/profile/work-experiences/${exp.id}`,
      payload: {
        company: 'Acme Editada',
        role: 'Dev Senior',
        description: 'x',
        startDate: '',
        endDate: '',
        current: false,
        skills: [],
      },
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().company).toBe('Acme Editada');
    // Datas continuam nulas, não viraram lixo.
    expect(r.json().startDate).toBeNull();
    await f.close();
  });

  it('editar com datas reais preserva as datas', async () => {
    const f = await app();
    const profile = await prisma.profile.findFirstOrThrow({
      where: { user: { email: { contains: MARCA } } },
    });
    const exp = await prisma.workExperience.create({
      data: {
        profileId: profile.id,
        company: 'Acme',
        role: 'Dev',
        startDate: new Date('2020-01-15'),
        endDate: new Date('2022-06-30'),
      },
    });

    const r = await f.inject({
      method: 'PUT',
      url: `/api/profile/work-experiences/${exp.id}`,
      payload: {
        company: 'Acme',
        role: 'Dev Pleno',
        startDate: '2020-01-15',
        endDate: '2022-06-30',
        current: false,
        skills: ['React'],
      },
    });

    expect(r.statusCode).toBe(200);
    expect(new Date(r.json().startDate).toISOString()).toContain('2020-01-15');
    expect(r.json().role).toBe('Dev Pleno');
    await f.close();
  });
});

describe('POST certification sem datas', () => {
  it('adicionar certificado sem datas salva em vez de 400', async () => {
    const f = await app();

    const r = await f.inject({
      method: 'POST',
      url: '/api/profile/certifications',
      payload: { name: `${MARCA} AWS`, issuedAt: '', expiresAt: '' },
    });

    // 201 de criado — o ponto é não ser 400.
    expect(r.statusCode).toBe(201);
    expect(r.json().issuedAt).toBeNull();
    await f.close();
  });
});

describe('POST skill com caixa diferente', () => {
  it('reaproveita a skill existente em vez de duplicar', async () => {
    const f = await app();
    await prisma.skill.create({ data: { name: `${MARCA}React`, aliases: [] } });

    const r = await f.inject({
      method: 'POST',
      url: '/api/profile/skills',
      payload: {
        // mesma skill, outra caixa — o upsert pelo nome exato criava duplicata
        skillName: `${MARCA.toUpperCase()}REACT`,
        level: 'ADVANCED',
      },
    });

    expect(r.statusCode).toBe(201);
    expect(
      await prisma.skill.count({ where: { name: { startsWith: MARCA, mode: 'insensitive' } } }),
    ).toBe(1);
    await f.close();
  });
});
