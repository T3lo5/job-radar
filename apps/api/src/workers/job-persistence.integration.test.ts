import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import { persistSourceJobs, type JobCandidate } from './job-persistence.js';

/**
 * Teste contra Postgres de verdade.
 *
 * A dupla de `job-persistence.test.ts` prova o número de queries e a lógica,
 * mas não prova nada que só o banco sabe: se `remote` gravado passa no enum,
 * se `skipDuplicates` segura a corrida, se `sourceCount` incrementa certo.
 *
 * É exatamente aqui que o N+1 podia "passar no teste" e quebrar em produção:
 * `createMany` e `updateMany` têm semântica própria que a dupla não reproduz.
 */

// Cliente próprio: o `prisma` do app aponta para o banco de desenvolvimento,
// e estes testes apagam vagas.
// Sem log de query: com os testes de integração, cada statement virava
// ruído na saída e enterrava a asserção que falhou.
const prisma = new PrismaClient({ log: ['error'] });

const SOURCE_A = 'test-lote-a';
const SOURCE_B = 'test-lote-b';

async function ensureSource(name: string): Promise<string> {
  const source = await prisma.jobSource.upsert({
    where: { name },
    update: {},
    create: { name, type: 'api', enabled: true },
  });
  return source.id;
}

function makeCandidates(n: number, prefix: string): JobCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Vaga de teste ${prefix}${i}`,
    company: 'Empresa Teste',
    description: 'Desenvolvimento com React e Node.js',
    location: 'São Paulo',
    remote: 'remote',
    seniority: 'SENIOR',
    salaryMin: 5000,
    salaryMax: 8000,
    salaryCurrency: 'BRL',
    url: `https://exemplo.test/${prefix}/${i}`,
    externalId: null,
    publishedAt: null,
    hash: `${prefix}-hash-${i}`,
  }));
}

beforeAll(async () => {
  await prisma.$connect();
  const ok = await prisma.jobSource.findFirst({ where: { name: SOURCE_A } });
  if (!ok) {
    // Sem as tabelas, o erro vira "relation jobs does not exist", que parece
    // bug do teste. Vale a mensagem pointing para o migrate.
    // Cast para text: to_regclass devolve o tipo `regclass`, que o Prisma não
    // sabe desserializar — e o erro que ele lança vem sem mensagem.
    const existe = await prisma.$queryRaw`SELECT to_regclass('public.jobs')::text AS tabela`.catch(
      () => null,
    );
    const achou = (existe as Array<{ tabela: string | null }> | null)?.[0]?.tabela;
    if (!achou) {
      throw new Error(
        'Banco de teste sem as tabelas. Rode:\n' +
          '  docker compose exec -T postgres psql -U jobradar -d postgres -c "CREATE DATABASE jobradar_test"\n' +
          '  DATABASE_URL=postgresql://jobradar:jobradar@localhost:5432/jobradar_test pnpm exec prisma migrate deploy',
      );
    }
  }
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

beforeEach(cleanup);

async function cleanup() {
  await prisma.job.deleteMany({
    where: { url: { startsWith: 'https://exemplo.test/' } },
  });
  await prisma.jobSource.deleteMany({
    where: { name: { in: [SOURCE_A, SOURCE_B] } },
  });
}

describe('persistSourceJobs contra Postgres', () => {
  it('grava as vagas com o enum correto (remote e seniority)', async () => {
    const sourceId = await ensureSource(SOURCE_A);

    const outcome = await persistSourceJobs({
      prisma,
      sourceId,
      candidates: makeCandidates(3, 'enum'),
    });

    expect(outcome.inserted).toBe(3);

    const rows = await prisma.job.findMany({
      where: { hash: { startsWith: 'enum-hash-' } },
      orderBy: { hash: 'asc' },
    });

    expect(rows).toHaveLength(3);
    // 'remote' do shared precisa virar REMOTE do Prisma. Antes passava por
    // `.toUpperCase() as any`; se o mapeamento sumisse, o banco rejeitaria.
    expect(rows[0].remote).toBe('REMOTE');
    expect(rows[0].seniority).toBe('SENIOR');
    expect(rows[0].status).toBe('RAW');
    expect(rows[0].sourceCount).toBe(1);
    expect(rows[0].salaryCurrency).toBe('BRL');
  });

  it('valor de remote invalido vira UNKNOWN em vez de derrubar o lote', async () => {
    const sourceId = await ensureSource(SOURCE_A);
    const candidatos = makeCandidates(4, 'invalido');
    candidatos[2].remote = 'hibrido' as never; // nem existe no enum
    candidatos[3].seniority = 'GURU';

    const outcome = await persistSourceJobs({ prisma, sourceId, candidates: candidatos });

    // As 4 entraram: uma linha ruim não pode custar o resto do lote.
    expect(outcome.inserted).toBe(4);

    const rows = await prisma.job.findMany({
      where: { hash: { startsWith: 'invalido-hash-' } },
      orderBy: { hash: 'asc' },
    });
    expect(rows[2].remote).toBe('UNKNOWN');
    expect(rows[3].seniority).toBeNull();
  });

  it('segunda coleta incrementa sourceCount sem duplicar a vaga', async () => {
    const sourceA = await ensureSource(SOURCE_A);
    const sourceB = await ensureSource(SOURCE_B);
    const candidatos = makeCandidates(5, 'reinc');

    const primeira = await persistSourceJobs({
      prisma,
      sourceId: sourceA,
      candidates: candidatos,
    });
    expect(primeira.inserted).toBe(5);
    expect(primeira.touched).toBe(0);

    // Mesma vaga, outra fonte: o comportamento antigo era sourceCount + 1.
    const segunda = await persistSourceJobs({
      prisma,
      sourceId: sourceB,
      candidates: candidatos,
    });
    expect(segunda.inserted).toBe(0);
    expect(segunda.touched).toBe(5);

    const rows = await prisma.job.findMany({
      where: { hash: { startsWith: 'reinc-hash-' } },
    });
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.sourceCount === 2)).toBe(true);

    // sourceId continua o da primeira inserção: a vaga não é "movida".
    expect(rows.every((r) => r.sourceId === sourceA)).toBe(true);
  });

  it('aumenta collectedAt na vaga repetida', async () => {
    const sourceA = await ensureSource(SOURCE_A);
    const candidatos = makeCandidates(1, 'coleta');
    await persistSourceJobs({ prisma, sourceId: sourceA, candidates: candidatos });

    const antes = await prisma.job.findFirstOrThrow({ where: { hash: candidatos[0].hash } });
    const marca = new Date(antes.collectedAt.getTime() - 60_000);
    await prisma.job.update({
      where: { id: antes.id },
      data: { collectedAt: marca },
    });

    await persistSourceJobs({
      prisma,
      sourceId: await ensureSource(SOURCE_B),
      candidates: candidatos,
      now: new Date(),
    });

    const depois = await prisma.job.findFirstOrThrow({ where: { id: antes.id } });
    expect(depois.collectedAt.getTime()).toBeGreaterThan(marca.getTime());
  });

  it('deduplica hash repetido dentro do mesmo lote', async () => {
    const sourceId = await ensureSource(SOURCE_A);
    const candidatos = makeCandidates(3, 'dup');
    const comDuplicatas = [...candidatos, candidatos[0], candidatos[1]];

    // Sem dedup, o hash violaria a constraint @unique e o lote inteiro cairia.
    const outcome = await persistSourceJobs({
      prisma,
      sourceId,
      candidates: comDuplicatas,
    });

    expect(outcome.inserted).toBe(3);
    expect(await prisma.job.count({ where: { hash: { startsWith: 'dup-hash-' } } })).toBe(3);
  });

  it('duas coletas simultaneas nao criam vaga duplicada', async () => {
    const sourceA = await ensureSource(SOURCE_A);
    const sourceB = await ensureSource(SOURCE_B);
    const candidatos = makeCandidates(20, 'corrida');

    // As duas veem as 20 como novas ao mesmo tempo: é exatamente a janela em
    // que o `findUnique` + `create` original estourava a constraint @unique.
    const [a, b] = await Promise.all([
      persistSourceJobs({ prisma, sourceId: sourceA, candidates: candidatos }),
      persistSourceJobs({ prisma, sourceId: sourceB, candidates: candidatos }),
    ]);

    const total = await prisma.job.count({ where: { hash: { startsWith: 'corrida-hash-' } } });
    expect(total).toBe(20); // nem 40 (duplicado) nem 0 (tudo barrado)
    expect(a.inserted + b.inserted).toBe(20);

    // Cada vaga é contada exatamente uma vez por cada lado: a que já existia vira touched,
    // nova entra em inserted, e o que o banco pulou na corrida entra em
    // duplicateCount. Essa soma fecha em 20 nos dois lados, tenha a corrida
    // serializado ou não.
    //
    // Não dá para afirmar `duplicateCount === 0`: se uma execução terminar o
    // findMany antes da outra começar, a segunda vê tudo como repetida e sai
    // antes do createMany. Afirmar zero deixaria o teste instável.
    for (const lado of [a, b]) {
      expect(lado.inserted + lado.touched + lado.duplicateCount).toBe(20);
    }
  });

  it('insere lote grande sem estourar o limite de parametros', async () => {
    const sourceId = await ensureSource(SOURCE_A);

    const outcome = await persistSourceJobs({
      prisma,
      sourceId,
      candidates: makeCandidates(2500, 'grande'),
    });

    expect(outcome.inserted).toBe(2500);
    expect(outcome.newJobIds).toHaveLength(2500);
    expect(await prisma.job.count({ where: { hash: { startsWith: 'grande-hash-' } } })).toBe(2500);
  });

  it('lote com mistura de novas e repetidas conta as duas coisas certo', async () => {
    const sourceA = await ensureSource(SOURCE_A);
    const existentes = makeCandidates(10, 'mistura');
    await persistSourceJobs({ prisma, sourceId: sourceA, candidates: existentes });

    const novas = makeCandidates(4, 'mistura-nova');
    const repetidas = makeCandidates(10, 'mistura');
    const lote = [...novas, ...repetidas];

    const outcome = await persistSourceJobs({
      prisma,
      sourceId: await ensureSource(SOURCE_B),
      candidates: lote,
    });

    expect(outcome.inserted).toBe(4);
    expect(outcome.touched).toBe(10);
    expect(outcome.newJobIds).toHaveLength(4);
    expect(
      await prisma.job.count({ where: { url: { startsWith: 'https://exemplo.test/mistura' } } }),
    ).toBe(14);
  });

  it('nao deixa lixo: ids novos apontam para linhas reais', async () => {
    const sourceId = await ensureSource(SOURCE_A);
    const outcome = await persistSourceJobs({
      prisma,
      sourceId,
      candidates: makeCandidates(7, 'ids'),
    });

    const encontrados = await prisma.job.findMany({
      where: { id: { in: outcome.newJobIds } },
      select: { id: true, hash: true },
    });

    expect(encontrados).toHaveLength(7);
    expect(new Set(encontrados.map((r) => r.id)).size).toBe(7);
  });
});
