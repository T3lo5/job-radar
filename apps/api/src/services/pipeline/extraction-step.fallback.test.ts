import { describe, it, expect } from 'vitest';
import { ExtractionStep } from './extraction-step.js';

/**
 * `fallbackExtraction` é o caminho usado quando a IA falha, e é a única parte
 * da extração com casamento de texto escrito à mão — o resto do projeto casa
 * por normalização no motor ou por equality no banco.
 *
 * A regra de fronteira (`(?:^|[^a-z0-9+#])nome(?![a-z0-9+#])`) veio da Sprint D,
 * quando o casamento por substring puro klassava 'JavaScript' como 'Java' e 'R'
 * como qualquer palavra com 'r'. A regra nunca ganhou teste: ela só era
 * verificada por inspeção.
 *
 * Aqui a dupla de banco é mínima e o extrator de IA sempre falha, de propósito.
 */
function criarCtx(catalogo: Array<{ id: string; name: string }>, descricao: string) {
  const calls: string[] = [];
  const gravados: Array<{ hash: string }> = [];

  const step = new ExtractionStep();
  const job = {
    id: 'job-1',
    title: 'Vaga de teste',
    description: descricao,
    location: 'Remoto',
    remote: 'REMOTE',
    seniority: 'SENIOR',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
  };

  return {
    calls,
    gravados,
    async skillsExtraidas(): Promise<string[]> {
      const ctx = {
        jobId: 'job-1',
        prisma: {
          job: {
            findUnique: async () => {
              calls.push('job.findUnique');
              return job;
            },
            update: async () => {
              calls.push('job.update');
              return {};
            },
          },
          skill: {
            findMany: async () => {
              calls.push('skill.findMany');
              return catalogo;
            },
            createMany: async () => ({ count: 0 }),
            create: async () => ({}),
          },
          jobSkill: {
            createMany: async () => {
              calls.push('jobSkill.createMany');
              return { count: 0 };
            },
          },
          jobProcessingLog: { create: async () => ({}) },
        },
      };

      // O status da vaga revela quais skills foram resolvidas: o passo grava
      // em rawData o resultado da extração.
      let captured: { skills: string[] } | undefined;
      ctx.prisma.job.update = async (args?: any) => {
        if (args?.data?.rawData) captured = args.data.rawData;
        calls.push('job.update');
        return {};
      };

      await step.run(
        ctx as never,
        {
          createJobExtractor: async () => {
            throw new Error('sem chave de IA'); // força o fallback
          },
          enqueueNext: async () => {},
        } as never,
      );

      return captured ? captured.skills : [];
    },
  };
}

const catalogo = (...nomes: string[]) =>
  nomes.map((name, i) => ({ id: `s${i}`, name, aliases: [] }));

describe('fallbackExtraction — fronteira de palavra', () => {
  it('casa skill presente no texto', async () => {
    const ctx = criarCtx(catalogo('React'), 'Vaga que exige React e Node.');
    expect(await ctx.skillsExtraidas()).toEqual(['React']);
  });

  it('NÃO casa por substring: JavaScript não é Java', async () => {
    const ctx = criarCtx(catalogo('Java'), 'Vaga que exige JavaScript.');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('NÃO casa "Go" dentro de "Going"', async () => {
    const ctx = criarCtx(catalogo('Go'), 'Going to the office daily.');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('NÃO casa "R" dentro de "Terraform" (e o nome tem só 1 letra)', async () => {
    const ctx = criarCtx(catalogo('R'), 'Vaga com Terraform.');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('casa "Go" quando é a palavra inteira', async () => {
    const ctx = criarCtx(catalogo('Go'), 'Vaga que exige Go e Docker.');
    expect(await ctx.skillsExtraidas()).toEqual(['Go']);
  });

  it('casa no início e no fim do texto', async () => {
    const inicio = criarCtx(catalogo('Rust'), 'Rust é requisito.');
    expect(await inicio.skillsExtraidas()).toEqual(['Rust']);

    const fim = criarCtx(catalogo('Elixir'), 'Vaga que pede Elixir');
    expect(await fim.skillsExtraidas()).toEqual(['Elixir']);
  });

  it('respeita acentuação e caixa', async () => {
    const ctx = criarCtx(catalogo('TypeScript'), 'Vaga com TYPESCRIPT e typescript.');
    expect(await ctx.skillsExtraidas()).toEqual(['TypeScript']);
  });

  it('trata ponto como fronteira: casa "JS" em "Node.js"', async () => {
    // "." não está em [a-z0-9+#], então é fronteira. É o comportamento
    // desejado: quem lista Node.js conhece JS.
    const ctx = criarCtx(catalogo('JS'), 'Vaga com Node.js e TypeScript.');
    expect(await ctx.skillsExtraidas()).toEqual(['JS']);
  });

  it('trata + e # como parte do nome, não como fronteira', async () => {
    // É o que separa C++ de C: o lookahead-after falha em '+'.
    const comMais = criarCtx(catalogo('C++'), 'Vaga com C++ e C#.');
    expect(await comMais.skillsExtraidas()).toEqual(['C++']);

    const soC = criarCtx(catalogo('C'), 'Vaga com C++ e C#.');
    expect(await soC.skillsExtraidas()).toEqual([]);

    const comHash = criarCtx(catalogo('C#'), 'Vaga com C++ e C#.');
    expect(await comHash.skillsExtraidas()).toEqual(['C#']);
  });

  it('ignora skill de nome curto demais', async () => {
    const ctx = criarCtx(catalogo('R', 'a'), 'Vaga com R e a.');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('não casa skill vazia ou só com espaços', async () => {
    const ctx = criarCtx(catalogo('', '   ', 'React'), 'Vaga com React.');
    expect(await ctx.skillsExtraidas()).toEqual(['React']);
  });

  it('lê o catálogo uma vez e filtra em memória', async () => {
    const ctx = criarCtx(catalogo('React', 'Node', 'Python'), 'Vaga com React e Python.');
    const r = await ctx.skillsExtraidas();

    expect(r).toEqual(['React', 'Python']);
    expect(ctx.calls.filter((c) => c === 'skill.findMany')).toHaveLength(1);
  });
});

describe('fallbackExtraction — degradacao quando a IA falha', () => {
  it('devolve lista vazia de skills em vez de inventar', async () => {
    const ctx = criarCtx(catalogo('React', 'Node'), 'Descrição sem nenhuma skill conhecida.');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('devolve a descrição inteira sem skills em texto vazio', async () => {
    const ctx = criarCtx(catalogo('React'), '');
    expect(await ctx.skillsExtraidas()).toEqual([]);
  });

  it('nao cria skill nova a partir do fallback', async () => {
    // O fallback só REUTILIZA skills do catálogo. Criar aqui poluiria o
    // catálogo a cada falha de IA, sem revisão.
    const ctx = criarCtx(catalogo('React'), 'Vaga com React.');
    await ctx.skillsExtraidas();
    expect(ctx.calls).not.toContain('skill.createMany');
  });

  it('avança a vaga para MATCHING mesmo no fallback', async () => {
    const ctx = criarCtx(catalogo('React'), 'Vaga com React.');
    await ctx.skillsExtraidas();
    expect(ctx.calls).toContain('job.update');
    expect(ctx.calls).toContain('jobSkill.createMany');
  });

  it('usa o catalogo grande sem degradar o resultado', async () => {
    // O casamento é O(catalogo x descrição). O teste trava que o volume não
    // muda o RESULTADO, mesmo que mude o tempo.
    const grande = Array.from({ length: 800 }, (_, i) => ({ id: `g${i}`, name: `Skill${i}` }));
    const ctx = criarCtx([...grande, { id: 'r', name: 'React' }], 'Vaga que exige React.');
    expect(await ctx.skillsExtraidas()).toEqual(['React']);
  });
});
