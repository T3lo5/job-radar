import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { profileRoutes } from './profile.js';
import { applicationRoutes } from './applications.js';
import { resumeRoutes } from './resumes.js';
import { cvOptimizerRoutes } from './cv-optimizer.js';

/**
 * Prova do ticket 02 (auditoria 2026-10-28): duas contas não se enxergam.
 *
 * O guard global não é registrado aqui — o hook abaixo simula o que ele faz,
 * anexando `request.user` a partir do header. É de propósito: o teste mede o
 * escopo das queries, não a sessão. Antes, `profile.findFirst()` fazia o
 * usuário B receber o perfil, os CVs e as candidaturas do usuário A.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__isolamento__';

let userA = '';
let userB = '';
let profileA = '';
let profileB = '';
let jobId = '';
let appA = '';
let appB = '';
let resumeA = '';

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
  await f.register(profileRoutes);
  await f.register(applicationRoutes);
  await f.register(resumeRoutes);
  await f.register(cvOptimizerRoutes);
  return f;
}

async function limpar() {
  await prisma.applicationEvent.deleteMany({
    where: { application: { profile: { user: { email: { contains: MARCA } } } } },
  });
  await prisma.application.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.resume.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.job.deleteMany({ where: { hash: { startsWith: MARCA } } });
}

async function semear() {
  const [a, b] = await Promise.all([
    prisma.user.create({ data: { email: `${MARCA}a@test.local`, password: 'x', name: 'A' } }),
    prisma.user.create({ data: { email: `${MARCA}b@test.local`, password: 'x', name: 'B' } }),
  ]);
  userA = a.id;
  userB = b.id;

  const [pa, pb] = await Promise.all([
    prisma.profile.create({ data: { userId: a.id, title: 'Perfil A' } }),
    prisma.profile.create({ data: { userId: b.id, title: 'Perfil B' } }),
  ]);
  profileA = pa.id;
  profileB = pb.id;

  const source = await prisma.jobSource.findFirst();
  const sourceId =
    source?.id ??
    (await prisma.jobSource.create({ data: { name: `${MARCA}fonte`, type: 'api' } })).id;

  const job = await prisma.job.create({
    data: {
      title: 'Vaga de teste',
      company: 'Acme',
      description: 'Descrição',
      url: 'https://example.com/vaga',
      hash: `${MARCA}hash`,
      sourceId,
    },
  });
  jobId = job.id;

  const [aa, ab] = await Promise.all([
    prisma.application.create({
      data: { jobId, profileId: pa.id, status: 'APPLIED' },
    }),
    prisma.application.create({
      data: { jobId, profileId: pb.id, status: 'INTERESTING' },
    }),
  ]);
  appA = aa.id;
  appB = ab.id;

  const r = await prisma.resume.create({
    data: {
      userId: a.id,
      filename: 'curriculo-a.pdf',
      mimeType: 'application/pdf',
      rawText: 'Currículo confidencial de A',
      isDefault: true,
    },
  });
  resumeA = r.id;
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

describe('isolamento entre contas', () => {
  it('GET /api/profile devolve o perfil da sessão, não o primeiro do banco', async () => {
    const f = await app();

    const ra = await f.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { 'x-test-user': userA },
    });
    expect(ra.statusCode).toBe(200);
    expect(ra.json().id).toBe(profileA);

    const rb = await f.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { 'x-test-user': userB },
    });

    expect(rb.statusCode).toBe(200);
    expect(rb.json().id).toBe(profileB);
    expect(rb.json().title).toBe('Perfil B');
    await f.close();
  });

  it('GET /api/applications lista só as candidaturas da sessão', async () => {
    const f = await app();

    const rb = await f.inject({
      method: 'GET',
      url: '/api/applications',
      headers: { 'x-test-user': userB },
    });

    expect(rb.statusCode).toBe(200);
    expect(rb.json().pagination.total).toBe(1);
    expect(rb.json().data[0].id).toBe(appB);
    await f.close();
  });

  it('B não lê nem altera a candidatura de A', async () => {
    const f = await app();

    const get = await f.inject({
      method: 'GET',
      url: `/api/applications/${appA}`,
      headers: { 'x-test-user': userB },
    });
    expect(get.statusCode).toBe(404);

    const patch = await f.inject({
      method: 'PATCH',
      url: `/api/applications/${appA}/status`,
      headers: { 'x-test-user': userB },
      payload: { status: 'REJECTED' },
    });
    expect(patch.statusCode).toBe(404);

    const intacta = await prisma.application.findUniqueOrThrow({ where: { id: appA } });
    expect(intacta.status).toBe('APPLIED');
    await f.close();
  });

  it('B não lista, não lê o texto e não apaga o CV de A', async () => {
    const f = await app();
    const headers = { 'x-test-user': userB };

    const list = await f.inject({ method: 'GET', url: '/api/resumes', headers });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([]);

    const text = await f.inject({ method: 'GET', url: `/api/resumes/${resumeA}/text`, headers });
    expect(text.statusCode).toBe(404);

    const del = await f.inject({ method: 'DELETE', url: `/api/resumes/${resumeA}`, headers });
    expect(del.statusCode).toBe(404);
    expect(await prisma.resume.count({ where: { id: resumeA } })).toBe(1);
    await f.close();
  });

  it('B não otimiza o CV de A passando o id explicitamente', async () => {
    const f = await app();

    const r = await f.inject({
      method: 'POST',
      url: '/api/cv/optimize',
      headers: { 'x-test-user': userB },
      payload: { resumeId: resumeA, jobDescription: 'Vaga qualquer' },
    });

    expect(r.statusCode).toBe(404);
    await f.close();
  });

  it('B não consegue editar nem apagar itens do perfil de A', async () => {
    const f = await app();
    const expA = await prisma.workExperience.create({
      data: { profileId: profileA, company: 'Acme A', role: 'Dev' },
    });

    const put = await f.inject({
      method: 'PUT',
      url: `/api/profile/work-experiences/${expA.id}`,
      headers: { 'x-test-user': userB },
      payload: { company: 'Invadida', role: 'Dev', current: false, skills: [] },
    });
    expect(put.statusCode).toBe(404);

    const del = await f.inject({
      method: 'DELETE',
      url: `/api/profile/work-experiences/${expA.id}`,
      headers: { 'x-test-user': userB },
    });
    expect(del.statusCode).toBe(404);

    const intacta = await prisma.workExperience.findUniqueOrThrow({ where: { id: expA.id } });
    expect(intacta.company).toBe('Acme A');
    await f.close();
  });
});
