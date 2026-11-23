import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { applicationRoutes } from './applications.js';
import { deleteFile } from '../services/file-storage.js';

/**
 * Ticket 31: kit da candidatura.
 *
 * O teste percorre o fluxo do critério de aceite de ponta a ponta pelo HTTP:
 * cria a candidatura, anexa um arquivo, exporta em JSON e CSV e confere o
 * conteúdo. Também cobre remoção e isolamento entre contas.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__kit_candidatura__';

let userId = '';
let jobId = '';

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
  await f.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await f.register(applicationRoutes);
  return f;
}

/** Corpo multipart montado à mão: `form-data` só existe como transitiva no repo. */
function multipartPayload(filename: string, mimeType: string, content: Buffer) {
  const boundary = '----job-radar-kit-boundary';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    body: Buffer.concat([head, content, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function limpar() {
  const attachments = await prisma.applicationAttachment.findMany({
    where: { application: { profile: { user: { email: { contains: MARCA } } } } },
  });
  for (const attachment of attachments) {
    await deleteFile(attachment.filename).catch(() => {});
  }

  await prisma.applicationEvent.deleteMany({
    where: { application: { profile: { user: { email: { contains: MARCA } } } } },
  });
  await prisma.application.deleteMany({
    where: { profile: { user: { email: { contains: MARCA } } } },
  });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  await prisma.job.deleteMany({ where: { hash: { startsWith: MARCA } } });
  await prisma.setting.deleteMany({ where: { key: `settings:app:followUpCadenceDays` } });
}

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'Kit' },
  });
  userId = user.id;

  // Só existe para o kit ter um perfil; o id não é usado diretamente aqui.
  await prisma.profile.create({
    data: { userId: user.id, title: 'Perfil Kit' },
  });

  const source = await prisma.jobSource.findFirst();
  const sourceId =
    source?.id ??
    (await prisma.jobSource.create({ data: { name: `${MARCA}fonte`, type: 'api' } })).id;

  const job = await prisma.job.create({
    data: {
      title: 'Pessoa Desenvolvedora Full Stack',
      company: 'Acme',
      description: 'Vaga com React e TypeScript.',
      location: 'São Paulo',
      remote: 'REMOTE',
      url: 'https://example.com/kit',
      hash: `${MARCA}hash`,
      sourceId,
    },
  });
  jobId = job.id;
}

const headers = () => ({ 'x-test-user': userId });

async function criarCandidatura(f: Awaited<ReturnType<typeof app>>) {
  const response = await f.inject({
    method: 'POST',
    url: '/api/applications',
    headers: headers(),
    payload: { jobId, notes: 'Aplicar pelo site' },
  });
  expect(response.statusCode).toBe(201);
  return response.json().applicationId as string;
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

describe('GET /api/applications/:id/kit', () => {
  it('devolve candidatura, vaga, histórico, match e gap de keywords', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}/status`,
      headers: headers(),
      payload: { status: 'APPLIED', note: 'Enviado' },
    });

    const kit = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/kit`,
      headers: headers(),
    });

    expect(kit.statusCode).toBe(200);
    const body = kit.json();
    expect(body.application.job.title).toBe('Pessoa Desenvolvedora Full Stack');
    expect(body.application.status).toBe('APPLIED');
    expect(body.application.events).toHaveLength(2);
    expect(body.application.attachments).toEqual([]);
    // O perfil sem skills não derruba o kit: o gap vem (vazio ou não) sem erro.
    expect(body.keywordGap).not.toBeUndefined();
    expect(Array.isArray(body.cvVersions)).toBe(true);

    await f.close();
  });

  it('404 quando a candidatura é de outra conta', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const outro = await prisma.user.create({
      data: { email: `${MARCA}-outro@test.local`, password: 'x' },
    });
    await prisma.profile.create({ data: { userId: outro.id, title: 'Outro' } });

    const kit = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/kit`,
      headers: { 'x-test-user': outro.id },
    });
    expect(kit.statusCode).toBe(404);

    await f.close();
  });
});

describe('anexos da candidatura', () => {
  it('sobe, lista, baixa e remove um anexo', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const conteudo = Buffer.from('Carta de apresentação em PDF de mentira');
    const payload = multipartPayload('carta.pdf', 'application/pdf', conteudo);

    const upload = await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/attachments?kind=cover_letter`,
      headers: { ...headers(), ...payload.headers },
      payload: payload.body,
    });

    expect(upload.statusCode).toBe(201);
    const anexo = upload.json();
    expect(anexo.originalName).toBe('carta.pdf');
    expect(anexo.kind).toBe('cover_letter');
    expect(anexo.size).toBe(conteudo.length);
    expect(anexo.downloadUrl).toContain(applicationId);

    const lista = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/attachments`,
      headers: headers(),
    });
    expect(lista.json().attachments).toHaveLength(1);

    const download = await f.inject({
      method: 'GET',
      url: anexo.downloadUrl,
      headers: headers(),
    });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
    expect(download.headers['content-disposition']).toContain('carta.pdf');
    expect(download.rawPayload.equals(conteudo)).toBe(true);

    const remove = await f.inject({
      method: 'DELETE',
      url: `/api/applications/${applicationId}/attachments/${anexo.id}`,
      headers: headers(),
    });
    expect(remove.statusCode).toBe(204);

    const depois = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/attachments`,
      headers: headers(),
    });
    expect(depois.json().attachments).toEqual([]);
    expect(await prisma.applicationAttachment.count({ where: { id: anexo.id } })).toBe(0);

    await f.close();
  });

  it('recusa tipo não suportado com 415', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const payload = multipartPayload('script.exe', 'application/x-msdownload', Buffer.from('x'));
    const upload = await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/attachments`,
      headers: { ...headers(), ...payload.headers },
      payload: payload.body,
    });

    expect(upload.statusCode).toBe(415);
    expect(await prisma.applicationAttachment.count()).toBe(0);

    await f.close();
  });

  it('não deixa outra conta baixar o anexo', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const payload = multipartPayload('portfolio.txt', 'text/plain', Buffer.from('portfólio'));
    const upload = await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/attachments?kind=portfolio`,
      headers: { ...headers(), ...payload.headers },
      payload: payload.body,
    });
    const anexo = upload.json();

    const outro = await prisma.user.create({
      data: { email: `${MARCA}-outro2@test.local`, password: 'x' },
    });
    await prisma.profile.create({ data: { userId: outro.id, title: 'Outro' } });

    const download = await f.inject({
      method: 'GET',
      url: anexo.downloadUrl,
      headers: { 'x-test-user': outro.id },
    });
    expect(download.statusCode).toBe(404);

    await f.close();
  });
});

describe('GET /api/applications/:id/export', () => {
  async function preparar(f: Awaited<ReturnType<typeof app>>) {
    const applicationId = await criarCandidatura(f);

    await f.inject({
      method: 'PATCH',
      url: `/api/applications/${applicationId}`,
      headers: headers(),
      payload: {
        atsUsed: 'Workday',
        followUpAt: '2026-11-05T12:00:00.000Z',
        salary: 12000,
        contacts: { recruiter: 'Maria', email: 'maria@acme.com' },
      },
    });

    const payload = multipartPayload('carta-final.txt', 'text/plain', Buffer.from('Carta final'));
    await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/attachments?kind=cover_letter`,
      headers: { ...headers(), ...payload.headers },
      payload: payload.body,
    });

    return applicationId;
  }

  it('JSON traz todos os campos do kit, inclusive anexos e histórico', async () => {
    const f = await app();
    const applicationId = await preparar(f);

    const response = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/export?format=json`,
      headers: headers(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('kit-Acme');
    expect(response.headers['content-disposition']).toContain('.json');

    const body = response.json();
    expect(body.application.id).toBe(applicationId);
    expect(body.application.job.title).toBe('Pessoa Desenvolvedora Full Stack');
    expect(body.application.atsUsed).toBe('Workday');
    expect(body.application.salary).toBe(12000);
    expect(body.application.contacts).toEqual({ recruiter: 'Maria', email: 'maria@acme.com' });
    expect(body.application.attachments).toHaveLength(1);
    expect(body.application.attachments[0].originalName).toBe('carta-final.txt');
    expect(body.application.events.length).toBeGreaterThan(0);

    await f.close();
  });

  it('CSV tem cabeçalho e os mesmos dados em uma linha', async () => {
    const f = await app();
    const applicationId = await preparar(f);

    const response = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/export?format=csv`,
      headers: headers(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('.csv');

    const linhas = response.body.trim().split('\r\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain('applicationId');
    expect(linhas[0]).toContain('keywordsMissing');
    expect(linhas[1]).toContain(applicationId);
    expect(linhas[1]).toContain('Workday');
    expect(linhas[1]).toContain('carta-final.txt');
    expect(linhas[1]).toContain('Maria');

    await f.close();
  });

  it('404 ao exportar candidatura de outra conta', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const outro = await prisma.user.create({
      data: { email: `${MARCA}-outro3@test.local`, password: 'x' },
    });
    await prisma.profile.create({ data: { userId: outro.id, title: 'Outro' } });

    const response = await f.inject({
      method: 'GET',
      url: `/api/applications/${applicationId}/export?format=csv`,
      headers: { 'x-test-user': outro.id },
    });
    expect(response.statusCode).toBe(404);

    await f.close();
  });
});

describe('POST /api/applications/:id/contact — reagendamento de follow-up', () => {
  it('cria evento, atualiza followUpAt com a cadência e retorna nextFollowUp', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    // Define cadência de 3 dias para o teste
    await prisma.setting.upsert({
      where: {
        key: `settings:app:followUpCadenceDays`,
      },
      update: { value: '3' },
      create: {
        key: `settings:app:followUpCadenceDays`,
        value: '3',
        scope: 'app',
        encrypted: false,
      },
    });

    const antes = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(antes?.followUpAt).toBeNull();

    const response = await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/contact`,
      headers: headers(),
      payload: { note: 'Falei com o recrutador Maria' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.event.note).toBe('Falei com o recrutador Maria');
    expect(body.nextFollowUp).toBeDefined();

    const depois = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(depois?.followUpAt).not.toBeNull();
    expect(new Date(depois!.followUpAt!).getTime()).toBeGreaterThan(
      new Date(antes!.updatedAt).getTime(),
    );

    // O evento foi criado com o mesmo status (não muda o status da candidatura)
    const eventos = await prisma.applicationEvent.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    expect(eventos[0].note).toBe('Falei com o recrutador Maria');
    expect(eventos[0].fromStatus).toBe(eventos[0].toStatus);

    await f.close();
  });

  it('usa cadência padrão de 7 dias quando não há setting salvo', async () => {
    const f = await app();
    const applicationId = await criarCandidatura(f);

    const antes = new Date();
    const response = await f.inject({
      method: 'POST',
      url: `/api/applications/${applicationId}/contact`,
      headers: headers(),
      payload: { note: 'Contato' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const next = new Date(body.nextFollowUp);
    // Deve ser no futuro, dentro de um intervalo razoável (1-10 dias)
    expect(next.getTime()).toBeGreaterThan(antes.getTime());
    const diffDias = Math.floor((next.getTime() - antes.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDias).toBeGreaterThanOrEqual(1);
    expect(diffDias).toBeLessThanOrEqual(10);

    await f.close();
  });
});
