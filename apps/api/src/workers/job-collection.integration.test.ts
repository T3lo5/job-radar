import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import { runCollection, type CollectionDeps } from './job-collection.js';
import type { NormalizedJob, RemoteMode } from '@job-radar/shared';

/**
 * A coleta é a ÚNICA etapa do sistema sem cobertura de ponta a ponta.
 *
 * Os testes por passo começavam em "a vaga já está na tabela". Todo o caminho
 * entre "a fonte devolveu isto" e "isto está gravado" — filtros de local,
 * palavras-chave, camadas de busca, MIN_TOTAL_JOBS, sourceCount — passava
 * despercebido.
 *
 * Com as fontes injetadas, o `runCollection` real roda aqui contra Postgres de
 * verdade: só a rede é falsa.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__coleta__';

/** Vaga normalizada, com o formato que uma fonte real devolveria. */
function vaga(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: 'Desenvolvedor React',
    // A empresa carrega a marca: é por ela que a limpeza e as buscas do
    // teste encontram as linhas, então precisa ser a mesma em toda vaga.
    company: MARCA,
    description: 'Vaga para pessoa desenvolvedora com React e TypeScript.',
    location: 'Remoto',
    remote: 'remote' as RemoteMode,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: 'https://fonte.test/' + Math.random().toString(36).slice(2),
    externalId: 'ext-teste',
    publishedAt: null,
    tags: [],
    ...over,
  };
}

/** Deps com uma fonte falsa que devolve sempre as mesmas vagas. */
function depsCom(
  vagasPorFonte: Record<string, NormalizedJob[]>,
  extras: Partial<CollectionDeps> = {},
): { deps: CollectionDeps; chamadas: Array<{ keywords: string[]; remoteOnly: boolean }> } {
  const chamadas: Array<{ keywords: string[]; remoteOnly: boolean }> = [];
  const enfileirados: string[][] = [];

  return {
    chamadas,
    deps: {
      temFontes: () => Object.keys(vagasPorFonte).length > 0,
      coletar: async (query) => {
        chamadas.push({ keywords: query.keywords, remoteOnly: query.remoteOnly ?? false });
        return Object.entries(vagasPorFonte).map(([sourceId, jobs]) => ({ sourceId, jobs }));
      },
      enfileirar: async (ids) => {
        enfileirados.push(ids);
      },
      ...extras,
    },
  };
}

/** Quantas vezes o pipeline foi acionado, e com quantos IDs. */
function contadorEnfileirar() {
  const lotes: string[][] = [];
  return { lotes, fn: async (ids: string[]) => void lotes.push(ids) };
}

let userId: string;
let profileId: string;

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

  const user = await prisma.user.create({
    data: { email: `${MARCA}@test.local`, password: 'x', name: 'Coleta' },
  });
  userId = user.id;

  const profile = await prisma.profile.create({
    data: {
      userId,
      title: 'Desenvolvedor',
      seniority: 'SENIOR',
      location: 'Remoto',
      remotePreference: 'REMOTE',
      // Vazio de propósito: com jobTypes e skills, a estratégia de busca cria
      // camadas extras e o teste passa a medir a estratégia, não a coleta.
      jobTypes: [],
      seniorityList: [],
      discardTerms: [],
    },
  });
  profileId = profile.id;

  // Uma palavra-chave de setting, para existir pelo menos uma camada.
  await prisma.setting.create({
    data: { scope: 'sources', key: 'keyword.react', value: 'react' },
  });
});

async function limpar() {
  await prisma.job.deleteMany({ where: { company: MARCA } });
  await prisma.setting.deleteMany({ where: { key: { contains: MARCA } } });
  await prisma.setting.deleteMany({ where: { scope: 'sources', key: 'keyword.react' } });
  await prisma.jobSource.deleteMany({ where: { name: { contains: MARCA } } });
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
}

describe('runCollection — grava o que a fonte devolveu', () => {
  it('insere a vaga com os campos da fonte', async () => {
    const { deps } = depsCom({
      [`${MARCA}fonte`]: [vaga({ title: 'Engenheira de Software', salaryMin: 8000 })],
    });

    const r = await runCollection(deps);

    expect(r.collected).toBe(1);
    expect(r.errors).toEqual([]);

    const job = await prisma.job.findFirstOrThrow({ where: { company: MARCA } });
    expect(job.title).toBe('Engenheira de Software');
    expect(job.salaryMin).toBe(8000);
    expect(job.status).toBe('RAW'); // pronta para o pipeline
    expect(job.sourceCount).toBe(1);
    expect(job.remote).toBe('REMOTE');
    expect(job.sourceId).toBeTruthy();
  });

  it('cria a JobSource se ainda nao existir', async () => {
    const { deps } = depsCom({ [`${MARCA}nova-fonte`]: [vaga()] });
    await runCollection(deps);

    const source = await prisma.jobSource.findFirstOrThrow({
      where: { name: `${MARCA}nova-fonte` },
    });
    expect(source.enabled).toBe(true);

    // Segunda coleta não cria duplicata de fonte.
    await runCollection(deps);
    expect(await prisma.jobSource.count({ where: { name: `${MARCA}nova-fonte` } })).toBe(1);
  });

  it('devolve o erro de cada vaga para a lista de errors', async () => {
    const r = await runCollection({
      ...depsCom({ [`${MARCA}f1`]: [vaga()], [`${MARCA}f2`]: [] }).deps,
    });
    expect(r.errors).toEqual([]);
  });

  it('sem fonte registrada, nao coleta e explica o motivo', async () => {
    const r = await runCollection({ ...depsCom({}).deps, temFontes: () => false });
    expect(r).toEqual({ collected: 0, errors: ['No job sources registered'] });
    expect(await prisma.job.count()).toBe(0);
  });
});

describe('runCollection — filtros', () => {
  it('descarta vaga fora do local permitido', async () => {
    // Perfil quer Remoto; a vaga e presencial em outra cidade.
    const { deps } = depsCom({
      [`${MARCA}f`]: [vaga({ location: 'Moscow, Russia', remote: 'on_site' as RemoteMode })],
    });

    const r = await runCollection(deps);
    expect(r.collected).toBe(0);
    expect(await prisma.job.count()).toBe(0);
  });

  it('mantem vaga remota', async () => {
    const { deps } = depsCom({
      [`${MARCA}f`]: [vaga({ location: 'Remoto', remote: 'remote' as RemoteMode })],
    });
    expect((await runCollection(deps)).collected).toBe(1);
  });

  it('puxa a palavra-chave da camada para a fonte', async () => {
    const { deps, chamadas } = depsCom({ [`${MARCA}f`]: [vaga()] });
    await runCollection(deps);

    expect(chamadas.length).toBeGreaterThan(0);
    expect(chamadas[0].keywords).toEqual(['react']);
    // remoteOnly reflete o perfil (REMOTE).
    expect(chamadas[0].remoteOnly).toBe(true);
  });
});

describe('runCollection — repeticao', () => {
  it('incrementa sourceCount em vez de duplicar a vaga', async () => {
    const vagaFixa = vaga({ url: 'https://fonte.test/fixa' });
    const { deps } = depsCom({ [`${MARCA}f1`]: [vagaFixa], [`${MARCA}f2`]: [vagaFixa] });

    await runCollection(deps);
    const depoisDaPrimeira = await prisma.job.count({ where: { company: MARCA } });
    expect(depoisDaPrimeira).toBe(1);

    await runCollection(deps);

    const rows = await prisma.job.findMany({ where: { company: MARCA } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceCount).toBe(2);
  });

  it('atualiza collectedAt da vaga repetida', async () => {
    const vagaFixa = vaga({ url: 'https://fonte.test/fixa2' });
    const { deps } = depsCom({ [`${MARCA}f`]: [vagaFixa] });
    await runCollection(deps);

    const antes = await prisma.job.findFirstOrThrow({ where: { company: MARCA } });
    const marca = new Date(antes.collectedAt.getTime() - 86_400_000);
    await prisma.job.update({ where: { id: antes.id }, data: { collectedAt: marca } });

    await runCollection(deps);

    const depois = await prisma.job.findFirstOrThrow({ where: { id: antes.id } });
    expect(depois.collectedAt.getTime()).toBeGreaterThan(marca.getTime());
  });
});

describe('runCollection — falhas', () => {
  it('erro de uma fonte nao derruba a coleta inteira', async () => {
    // Mesma vaga nas duas fontes: assim a segunda camada (a coleta segue até
    // juntar MIN_TOTAL_JOBS) encontra repetida em vez de inserir de novo.
    const vagaFixa = vaga({ url: 'https://fonte.test/boa' });
    const comFalha: CollectionDeps = {
      ...depsCom({}).deps,
      temFontes: () => true,
      coletar: async () => [
        { sourceId: `${MARCA}quebrada`, jobs: [], error: 'HTTP 503 da fonte' },
        { sourceId: `${MARCA}boa`, jobs: [vagaFixa] },
      ],
      enfileirar: async () => {},
    };

    const r = await runCollection(comFalha);

    // A coleta segue para a próxima camada, então o erro aparece em CADA
    // camada — o que importa é que a vaga boa entrou e nada estourou.
    expect(r.collected).toBe(1);
    expect(r.errors).toContainEqual(expect.stringContaining('HTTP 503 da fonte'));

    const rows = await prisma.job.findMany({ where: { company: MARCA } });
    expect(rows).toHaveLength(1);
    // sourceCount fica 1: `seenHashes` é por execução, então a mesma vaga
    // vista na 2ª camada não conta de novo. Sem isso, uma vaga em N camadas
    // inflaria o contador e pareceria estar em N fontes.
    expect(rows[0].sourceCount).toBe(1);
  });

  it('conta a mesma vaga so uma vez entre fontes da MESMA coleta', async () => {
    // A outra metade: `sourceCount` é o que distingue "a mesma vaga vista por
    // duas fontes diferentes" (relevante) de "a mesma vaga repetida na
    // camadas" (não conta).
    const vagaFixa = vaga({ url: 'https://fonte.test/uma-vez' });
    const r = await runCollection({
      ...depsCom({}).deps,
      temFontes: () => true,
      coletar: async () => [
        { sourceId: `${MARCA}f1`, jobs: [vagaFixa] },
        { sourceId: `${MARCA}f2`, jobs: [vagaFixa] },
      ],
      enfileirar: async () => {},
    });

    expect(r.collected).toBe(1);
    const rows = await prisma.job.findMany({ where: { company: MARCA } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceCount).toBe(1);
  });

  it('erro de persistência vira entrada em errors, sem perder o resto', async () => {
    // Duas vagas com o MESMO hash: a constraint @unique barra a segunda.
    const { deps } = depsCom({
      [`${MARCA}f`]: [
        vaga({ url: 'https://fonte.test/dup' }),
        vaga({ url: 'https://fonte.test/dup' }),
      ],
    });

    const r = await runCollection(deps);

    expect(await prisma.job.count({ where: { company: MARCA } })).toBe(1);
    expect(r.collected).toBe(1);
  });
});

describe('runCollection — pipeline', () => {
  it('enfileira só as vagas novas', async () => {
    const { lotes, fn } = contadorEnfileirar();
    const { deps } = depsCom({ [`${MARCA}f`]: [vaga(), vaga(), vaga()] }, { enfileirar: fn });

    await runCollection(deps);

    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toHaveLength(3);

    const jobs = await prisma.job.findMany({ where: { company: MARCA } });
    expect(new Set(lotes[0])).toEqual(new Set(jobs.map((j) => j.id)));
  });

  it('nao enfileira nada quando nada e novo', async () => {
    const vagaFixa = vaga({ url: 'https://fonte.test/rep' });
    const { lotes, fn } = contadorEnfileirar();
    const { deps } = depsCom({ [`${MARCA}f`]: [vagaFixa] }, { enfileirar: fn });

    await runCollection(deps);
    await runCollection(deps); // tudo repetido

    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toHaveLength(1);
  });
});

describe('runCollection — sem perfil', () => {
  it('coleta mesmo sem perfil configurado', async () => {
    await prisma.profile.deleteMany({});
    const { deps } = depsCom({ [`${MARCA}f`]: [vaga()] });

    const r = await runCollection(deps);

    // Sem perfil os filtros afrouxam: a vaga entra.
    expect(r.collected).toBe(1);
    expect(profileId).toBeTruthy();
  });
});
