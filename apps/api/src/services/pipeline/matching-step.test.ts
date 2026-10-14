import { describe, it, expect, vi } from 'vitest';
import { MatchingStep } from './matching-step.js';

/**
 * O que este passo verifica é simples e estrutural: `skill.findMany({})` não
 * é chamado.
 *
 * O recorte de skills fica dentro de `computeMatchScore`, que já recebe a vaga
 * e o perfil com suas skills. Passar o catálogo por fora seria uma chance a
 * mais de alguém reintroduzir a query — e ela voltaria em silêncio, sem erro
 * nenhum, só mais lenta.
 *
 * A dupla abaixo faz `skill.findMany` lançar. Se alguém voltar a chamá-lo, o
 * teste quebra em vez de ficar verde.
 */
function criarCtx(job: unknown, profile: unknown) {
  const skillFindMany = vi.fn(async () => {
    throw new Error('skill.findMany nao deve ser chamado pelo matching');
  });

  const upsert = vi.fn(
    async (_args: {
      create?: { score?: number; breakdown?: unknown };
      update?: { score?: number; computedAt?: Date };
      where?: unknown;
    }) => ({}),
  );
  const jobUpdate = vi.fn(async () => ({}));

  return {
    skillFindMany,
    upsert,
    jobUpdate,
    ctx: {
      jobId: 'job-1',
      prisma: {
        job: { findUnique: async () => job, update: jobUpdate },
        profile: { findFirst: async () => profile },
        // É aqui que mora a garantia.
        skill: { findMany: skillFindMany, create: vi.fn(), createMany: vi.fn() },
        jobSkill: { upsert: vi.fn(), createMany: vi.fn() },
        jobMatch: { upsert, findFirst: vi.fn() },
        jobProcessingLog: { create: async () => ({}) },
      },
    },
  };
}

const skill = (id: string, name: string, aliases: string[] = []) =>
  ({ id, name, aliases, category: null, createdAt: new Date() }) as never;

const vaga = (skills: unknown[]) =>
  ({
    id: 'job-1',
    title: 'Engenheiro de Software',
    company: 'X',
    description: 'React e Node',
    location: 'Remoto',
    remote: 'REMOTE',
    seniority: 'SENIOR',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: 'u',
    hash: 'h',
    status: 'MATCHING',
    skills: skills.map((s, i) => ({ id: `js${i}`, skill: s, required: true })),
  }) as never;

const perfil = (skills: unknown[]) =>
  ({
    id: 'p1',
    title: 'Engenheiro',
    yearsExp: 5,
    seniority: 'SENIOR',
    location: null,
    remotePreference: 'ANY',
    languages: [],
    skills: skills.map((s, i) => ({
      id: `ps${i}`,
      profileId: 'p1',
      skillId: (s as { id: string }).id,
      level: 'ADVANCED',
      yearsExp: 3,
      skill: s,
    })),
  }) as never;

const deps = (result: unknown) => ({
  createJobExtractor: vi.fn(),
  createJobAnalyzer: vi.fn(),
  computeMatchScore: vi.fn(() => result),
  enqueueNext: vi.fn(async () => {}),
});

describe('MatchingStep', () => {
  it('NAO le o catalogo de skills', async () => {
    const { ctx, skillFindMany } = criarCtx(
      vaga([skill('1', 'React')]),
      perfil([skill('1', 'React')]),
    );

    await new MatchingStep().run(ctx as never, deps({ score: 100, breakdown: {} }) as never);

    expect(skillFindMany).not.toHaveBeenCalled();
  });

  it('passa a vaga e o perfil sem catalogo para o motor', async () => {
    const job = vaga([skill('1', 'React')]);
    const profile = perfil([skill('1', 'React')]);
    const { ctx } = criarCtx(job, profile);
    const d = deps({ score: 100, breakdown: {} });

    await new MatchingStep().run(ctx as never, d as never);

    expect(d.computeMatchScore).toHaveBeenCalledWith(job, profile);
    // Dois argumentos. Com um terceiro (o catalogo) o teste quebraria.
    expect(d.computeMatchScore.mock.calls[0]).toHaveLength(2);
  });

  it('grava o match e avanca para ANALYZING', async () => {
    const { ctx, upsert, jobUpdate } = criarCtx(
      vaga([skill('1', 'React')]),
      perfil([skill('1', 'React')]),
    );
    const d = deps({ score: 88, breakdown: { technologies: 100 } });

    await new MatchingStep().run(ctx as never, d as never);

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0];
    expect(arg.create?.score).toBe(88);
    expect(arg.create?.breakdown).toEqual({ technologies: 100 });
    expect(jobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ANALYZING' } }),
    );
    expect(d.enqueueNext).toHaveBeenCalledWith('job-1', 'analyze');
  });

  it('atualiza o match existente em vez de duplicar', async () => {
    const { ctx, upsert } = criarCtx(vaga([skill('1', 'React')]), perfil([skill('1', 'React')]));

    await new MatchingStep().run(ctx as never, deps({ score: 70, breakdown: {} }) as never);

    // `upsert` do Prisma sempre recebe os dois ramos - e ele que decide entre
    // insert e update pelo `where`. O que prova o reuso e o `where` composto e
    // o score novo chegando no ramo de update.
    const arg = upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ jobId_profileId: { jobId: 'job-1', profileId: 'p1' } });
    expect(arg.update?.score).toBe(70);
    expect(arg.update?.computedAt).toBeInstanceOf(Date);
  });

  it('sem perfil, finaliza a vaga sem tentar casar', async () => {
    const { ctx, upsert, jobUpdate } = criarCtx(vaga([skill('1', 'React')]), null);
    const d = deps({ score: 0, breakdown: {} });

    await new MatchingStep().run(ctx as never, d as never);

    expect(d.computeMatchScore).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DONE' } }));
    expect(d.enqueueNext).not.toHaveBeenCalled();
  });

  it('vaga inexistente nao faz nada', async () => {
    const { ctx, upsert } = criarCtx(null, perfil([skill('1', 'React')]));
    const d = deps({ score: 0, breakdown: {} });

    await new MatchingStep().run(ctx as never, d as never);

    expect(d.computeMatchScore).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('funciona com a vaga sem nenhuma skill', async () => {
    const { ctx, skillFindMany, upsert } = criarCtx(vaga([]), perfil([skill('1', 'React')]));
    const d = deps({ score: 40, breakdown: {} });

    await new MatchingStep().run(ctx as never, d as never);

    expect(skillFindMany).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
