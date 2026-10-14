import { describe, it, expect } from 'vitest';
import {
  persistSourceJobs,
  coerceRemoteMode,
  coerceSeniority,
  type JobCandidate,
} from './job-persistence.js';

/**
 * Dupla de Prisma que conta queries e tem semântica de banco.
 *
 * Existe por dois motivos:
 * 1. Provar que o número de queries não cresce com o número de vagas. É a
 *    garantia contra voltar ao N+1 — sem medir, um refactor futuro desfaz
 *    isso e o CI segue verde.
 * 2. Simular `skipDuplicates` na corrida entre duas coletas, algo que a
 *    dupla ingenua de "sempre retorna tudo" não exercitaria.
 */
type FakeJob = {
  findMany: (args: {
    where: { hash: { in: string[] } };
  }) => Promise<Array<{ id: string; hash?: string }>>;
  updateMany: (args: { where: { hash: { in: string[] } } }) => Promise<{ count: number }>;
  createMany: (args: {
    data: Array<{ hash: string }>;
    skipDuplicates?: boolean;
  }) => Promise<{ count: number }>;
};

function createCountingPrisma(existingHashes: string[] = []) {
  const calls: Array<{ op: string; hashCount: number }> = [];
  const persisted = new Set(existingHashes);

  const job: FakeJob = {
    findMany: async (args) => {
      const inList = args.where.hash.in;
      calls.push({ op: 'findMany', hashCount: inList.length });
      return inList.filter((h) => persisted.has(h)).map((hash) => ({ id: `id-${hash}`, hash }));
    },
    updateMany: async (args) => {
      calls.push({ op: 'updateMany', hashCount: args.where.hash.in.length });
      return { count: args.where.hash.in.length };
    },
    createMany: async (args) => {
      calls.push({ op: 'createMany', hashCount: args.data.length });
      let count = 0;
      for (const row of args.data) {
        if (persisted.has(row.hash)) continue; // skipDuplicates
        persisted.add(row.hash);
        count++;
      }
      return { count };
    },
  };

  return {
    job,
    prisma: { job } as never,
    calls,
    total: () => calls.length,
    /** Marca hashes como já gravados (simula o estado do banco). */
    seed(...hashes: string[]) {
      for (const hash of hashes) persisted.add(hash);
    },
  };
}

function makeCandidates(n: number, prefix = 'h'): JobCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Vaga ${i}`,
    company: 'Empresa',
    description: 'React e Node',
    location: 'São Paulo',
    remote: 'remote',
    seniority: 'SENIOR',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: `https://exemplo.com/vaga/${i}`,
    externalId: null,
    publishedAt: null,
    hash: `${prefix}${i}`,
  }));
}

describe('coerceRemoteMode', () => {
  it('mapeia o valor do shared para o enum do Prisma', () => {
    expect(coerceRemoteMode('remote')).toBe('REMOTE');
    expect(coerceRemoteMode('on_site')).toBe('ON_SITE');
    expect(coerceRemoteMode('hybrid')).toBe('HYBRID');
    expect(coerceRemoteMode('unknown')).toBe('UNKNOWN');
  });

  it('aceita valor ja em caixa alta', () => {
    expect(coerceRemoteMode('REMOTE')).toBe('REMOTE');
  });

  it('aceita ANY, que existe no enum mas nao no shared', () => {
    expect(coerceRemoteMode('any')).toBe('ANY');
  });

  it('cai para UNKNOWN em vez de estourar o enum do Postgres', () => {
    // Este e o ponto: antes era `.toUpperCase() as any`, que deixava valor
    // invalido chegar ao INSERT e derrubar o lote inteiro.
    expect(coerceRemoteMode('hibrido')).toBe('UNKNOWN');
    expect(coerceRemoteMode('')).toBe('UNKNOWN');
    expect(coerceRemoteMode(undefined as unknown as string)).toBe('UNKNOWN');
  });
});

describe('coerceSeniority', () => {
  it('mapeia os niveis validos', () => {
    expect(coerceSeniority('SENIOR')).toBe('SENIOR');
    expect(coerceSeniority('lead')).toBe('LEAD');
    expect(coerceSeniority('UNKNOWN')).toBe('UNKNOWN');
  });

  it('devolve null para nivel invalido (campo e opcional)', () => {
    expect(coerceSeniority('GURU')).toBeNull();
    expect(coerceSeniority('')).toBeNull();
    expect(coerceSeniority(null)).toBeNull();
    expect(coerceSeniority(undefined)).toBeNull();
  });
});

describe('persistSourceJobs — o numero de queries nao cresce com o lote', () => {
  it('1 vaga nova usa 3 queries', async () => {
    const db = createCountingPrisma();
    await persistSourceJobs({ prisma: db.prisma, sourceId: 'src', candidates: makeCandidates(1) });
    // findMany(quais existem) + createMany + findMany(IDs novos).
    // Sem updateMany porque não havia nenhuma vaga prévia.
    expect(db.calls.map((c) => c.op)).toEqual(['findMany', 'createMany', 'findMany']);
  });

  it('1 vaga repetida usa 2 queries e nenhuma escrita', async () => {
    const db = createCountingPrisma();
    db.seed('h0');
    await persistSourceJobs({ prisma: db.prisma, sourceId: 'src', candidates: makeCandidates(1) });
    // findMany + updateMany, e o createMany nem chega a ser chamado.
    expect(db.calls.map((c) => c.op)).toEqual(['findMany', 'updateMany']);
  });

  it('1000 vagas usam o MESMO numero de queries que 1', async () => {
    const pequena = createCountingPrisma();
    await persistSourceJobs({
      prisma: pequena.prisma,
      sourceId: 'src',
      candidates: makeCandidates(1),
    });
    const callsPequena = pequena.total();

    const grande = createCountingPrisma();
    await persistSourceJobs({
      prisma: grande.prisma,
      sourceId: 'src',
      candidates: makeCandidates(1000),
    });

    // Este e o teste que trava o N+1 de volta. Antes: 2000 queries.
    expect(grande.total()).toBe(callsPequena);
  });

  it('nao faz nenhuma query com lote vazio', async () => {
    const db = createCountingPrisma();
    const outcome = await persistSourceJobs({
      prisma: db.prisma,
      sourceId: 'src',
      candidates: [],
    });
    expect(db.total()).toBe(0);
    expect(outcome.inserted).toBe(0);
    expect(outcome.newJobIds).toEqual([]);
  });

  it('divide em lotes o IN quando passa de 1000 (limite do Postgres)', async () => {
    const db = createCountingPrisma();
    await persistSourceJobs({
      prisma: db.prisma,
      sourceId: 'src',
      candidates: makeCandidates(2500),
    });

    const maiores = db.calls.filter((c) => c.hashCount > 1000);
    expect(maiores).toEqual([]); // nenhum IN estourou o teto

    // 2500 = 3 blocos no createMany, 3 no updateMany e 3 na busca de IDs.
    const createLotes = db.calls.filter((c) => c.op === 'createMany');
    expect(createLotes.map((c) => c.hashCount)).toEqual([1000, 1000, 500]);
  });
});

describe('persistSourceJobs — comportamento', () => {
  it('insere todas as vagas novas e devolve os IDs', async () => {
    const db = createCountingPrisma();
    const outcome = await persistSourceJobs({
      prisma: db.prisma,
      sourceId: 'src',
      candidates: makeCandidates(3),
    });

    expect(outcome.inserted).toBe(3);
    expect(outcome.touched).toBe(0);
    expect(outcome.newJobIds).toEqual(['id-h0', 'id-h1', 'id-h2']);
  });

  it('incrementa sourceCount das que ja existem e nao reinsere', async () => {
    const db = createCountingPrisma();
    db.seed('h0', 'h2'); // h1 ainda nao existe

    const outcome = await persistSourceJobs({
      prisma: db.prisma,
      sourceId: 'src',
      candidates: makeCandidates(3),
    });

    expect(outcome.touched).toBe(2);
    expect(outcome.inserted).toBe(1);

    const update = db.calls.find((c) => c.op === 'updateMany');
    expect(update?.hashCount).toBe(2);
  });

  it('nao faz updateMany quando nada ja existe', async () => {
    const db = createCountingPrisma();
    await persistSourceJobs({ prisma: db.prisma, sourceId: 'src', candidates: makeCandidates(5) });
    expect(db.calls.filter((c) => c.op === 'updateMany')).toEqual([]);
  });

  it('deduplica hash repetido dentro do mesmo lote', async () => {
    const db = createCountingPrisma();
    const candidatos = [...makeCandidates(2), ...makeCandidates(2)]; // h0 e h1 duas vezes

    const outcome = await persistSourceJobs({
      prisma: db.prisma,
      sourceId: 'src',
      candidates: candidatos,
    });

    // Sem dedup, o hash violaria a constraint @unique no meio do lote.
    expect(outcome.inserted).toBe(2);
    const create = db.calls.find((c) => c.op === 'createMany');
    expect(create?.hashCount).toBe(2);
  });

  it('usa skipDuplicates para sobreviver a corrida entre coletas', async () => {
    const db = createCountingPrisma();
    const skipFlags: unknown[] = [];
    const spy = {
      job: {
        ...db.job,
        createMany: async (args: { data: unknown[]; skipDuplicates?: boolean }) => {
          skipFlags.push(args.skipDuplicates);
          return { count: args.data.length };
        },
      },
    };

    await persistSourceJobs({
      prisma: spy as never,
      sourceId: 'src',
      candidates: makeCandidates(2),
    });

    expect(skipFlags).toEqual([true]);
  });

  it('reporta duplicatas quando o banco pula linhas na corrida', async () => {
    const db = createCountingPrisma();
    const spy = {
      job: { ...db.job, createMany: async () => ({ count: 1 }) }, // das 3, aceitou 1
    };

    const outcome = await persistSourceJobs({
      prisma: spy as never,
      sourceId: 'src',
      candidates: makeCandidates(3),
    });

    expect(outcome.inserted).toBe(1);
    expect(outcome.duplicateCount).toBe(2);
  });

  it('grava remote e seniority pelo enum, sem `as any`', async () => {
    const db = createCountingPrisma();
    const gravados: Array<Record<string, unknown>> = [];
    const spy = {
      job: {
        ...db.job,
        createMany: async (args: { data: unknown[]; skipDuplicates?: boolean }) => {
          gravados.push(...(args.data as Array<Record<string, unknown>>));
          return { count: args.data.length };
        },
      },
    };

    await persistSourceJobs({
      prisma: spy as never,
      sourceId: 'src-1',
      candidates: [
        {
          ...makeCandidates(1)[0],
          remote: 'hibrido', // valor invalido de proposito
          seniority: 'GURU',
        },
      ],
    });

    expect(gravados[0].remote).toBe('UNKNOWN');
    expect(gravados[0].seniority).toBeNull();
    expect(gravados[0].sourceId).toBe('src-1');
    expect(gravados[0].status).toBe('RAW');
    expect(gravados[0].sourceCount).toBe(1);
  });

  it('preserva os campos da vaga no INSERT', async () => {
    const db = createCountingPrisma();
    const gravados: Array<Record<string, unknown>> = [];
    const spy = {
      job: {
        ...db.job,
        createMany: async (args: { data: unknown[]; skipDuplicates?: boolean }) => {
          gravados.push(...(args.data as Array<Record<string, unknown>>));
          return { count: args.data.length };
        },
      },
    };

    const publicado = new Date('2026-01-15T10:00:00Z');
    await persistSourceJobs({
      prisma: spy as never,
      sourceId: 'src',
      candidates: [
        {
          ...makeCandidates(1)[0],
          salaryMin: 5000,
          salaryMax: 8000,
          salaryCurrency: 'BRL',
          externalId: 'ext-99',
          publishedAt: publicado,
          location: 'Remoto',
        },
      ],
    });

    expect(gravados[0]).toMatchObject({
      title: 'Vaga 0',
      company: 'Empresa',
      salaryMin: 5000,
      salaryMax: 8000,
      salaryCurrency: 'BRL',
      externalId: 'ext-99',
      publishedAt: publicado,
      location: 'Remoto',
      hash: 'h0',
    });
  });
});
