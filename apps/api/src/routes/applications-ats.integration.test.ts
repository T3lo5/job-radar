import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { applicationRoutes } from './applications.js';

/**
 * Ticket 12: o ATS escolhido na UI era validado e descartado no PATCH.
 *
 * O teste passa pelo HTTP de verdade (inject) para cobrir o caminho completo:
 * schema → service → Prisma → payload de leitura.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__ats_used__';

let userId = '';
let profileId = '';
let applicationId = '';

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
  await f.register(applicationRoutes);
  return f;
}

async function limpar() {
  await prisma.applicationEvent.deleteMany({
    where: { application: { profile: { user: { email: { contains: MARCA } } } } },
  });
  await prisma.application.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.job.deleteMany({ where: { hash: { startsWith: MARCA } } });
}

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'ATS' },
  });
  userId = user.id;

  const profile = await prisma.profile.create({
    data: { userId: user.id, title: 'Perfil ATS' },
  });
  profileId = profile.id;

  const source = await prisma.jobSource.findFirst();
  const sourceId =
    source?.id ??
    (await prisma.jobSource.create({ data: { name: `${MARCA}fonte`, type: 'api' } })).id;

  const job = await prisma.job.create({
    data: {
      title: 'Vaga ATS',
      company: 'Acme',
      description: 'Descrição',
      url: 'https://example.com/ats',
      hash: `${MARCA}hash`,
      sourceId,
    },
  });

  const application = await prisma.application.create({
    data: { jobId: job.id, profileId, status: 'APPLIED' },
  });
  applicationId = application.id;
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

describe('PATCH /api/applications/:id — atsUsed', () => {
  it('persiste um ATS do catálogo e devolve no GET seguinte', async () => {
    const f = await app();

    const patch = await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
      payload: { atsUsed: 'Workday' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().atsUsed).toBe('Workday');

    const get = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().atsUsed).toBe('Workday');

    const noBanco = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(noBanco.atsUsed).toBe('Workday');
    await f.close();
  });

  it('aceita "Outro" e limpa com null', async () => {
    const f = await app();

    await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
      payload: { atsUsed: 'Outro' },
    });

    const patch = await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
      payload: { atsUsed: null },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().atsUsed).toBeNull();

    const lista = await f.inject({
      method: 'GET',
      url: '/api/applications',
      headers: headers(),
    });
    expect(lista.statusCode).toBe(200);
    expect(lista.json().data[0].atsUsed).toBeNull();
    await f.close();
  });

  it('rejeita valor fora do catálogo com 400 e não altera o campo', async () => {
    const f = await app();

    const invalido = await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
      payload: { atsUsed: 'ATSInventado' },
    });
    expect(invalido.statusCode).toBe(400);

    const noBanco = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(noBanco.atsUsed).toBeNull();
    await f.close();
  });
});
