import { z } from 'zod';
import { prisma } from '../db/prisma.js';

export interface AnalyticsOverview {
  period: { from: Date; to: Date };
  jobs: {
    collected: number;
    analyzed: number;
    byStatus: Record<string, number>;
  };
  applications: {
    total: number;
    applied: number;
    interviews: number;
    offers: number;
    rejected: number;
    byStatus: Record<string, number>;
  };
  rates: {
    responseRate: number;
    interviewRate: number;
    offerRate: number;
  };
  matches: {
    distribution: { range: string; count: number }[];
    averageScore: number;
  };
  skills: {
    mostFrequent: { name: string; count: number }[];
    biggestGaps: { name: string; jobCount: number }[];
  };
}

/**
 * Faixa aceita para `?days=`.
 *
 * Antes o parâmetro ia cru para o serviço: `?days=abc` virava NaN, `new
 * Date(NaN)` é Data Inválida, e o Prisma estourava com uma mensagem VAZIA —
 * 500 sem explicação. `?days=-5` era pior: produzia um período no futuro e
 * a tela mostrava "0 vagas" como se fosse um resultado de verdade.
 */
export const daysParamSchema = z.coerce
  .number()
  .int('days precisa ser um número inteiro')
  .min(1, 'days mínimo é 1')
  .max(365, 'days máximo é 365');

/** Nunca deixa passar valor fora da faixa, mesmo chamando direto. */
export function normalizarDays(valor: unknown): number {
  const resultado = daysParamSchema.safeParse(valor ?? 30);
  return resultado.success ? resultado.data : 30;
}

/** Quantos candidatos traz antes de cortar o top-N em memória. */
const TOP_N = 10;
/**
 * Quantos o banco devolve antes do corte.
 *
 * Não é 10: com empate de contagem, o banco pode devolver qualquer um dos
 * grupos empatados, e a ordem mudaria a cada execução — a mesma tela mostraria
 * skills diferentes sem nada ter mudado. Traz um bloco maior e desempata pelo
 * nome, que é estável.
 */
const CANDIDATOS = 50;

export async function getAnalyticsOverview(periodDays = 30): Promise<AnalyticsOverview> {
  const now = new Date();
  const dias = normalizarDays(periodDays);
  const from = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
  const naJanela = { collectedAt: { gte: from } };

  // Só os IDs das skills do perfil: o filtro de lacuna é por skillId, e
  // comparar por nome em SQL exigiria lower() sobre o índice.
  //
  // Fica FORA do Promise.all de baixo porque alimenta o `notIn` dele — em
  // paralelo, a consulta das lacunas rodaria com a lista ainda vazia e
  // devolveria as skills do perfil como "lacuna".
  const skillsDoPerfil: Array<{ skillId: string }> = await prisma.profileSkill.findMany({
    select: { skillId: true },
  });
  const idsDoPerfil = skillsDoPerfil.map((ps) => ps.skillId);

  // Tudo aqui é agregação no banco. A versão anterior carregava a tabela
  // inteira para contar em JavaScript: com 3.000 vagas e 9.000 job_skills a
  // chamada levava 171ms dentro de uma requisição síncrona.
  //
  // Agrupado por chave em vez de desestruturado de um array: com tipos
  // heterogêneos do Prisma, o TS colapsa a inferência da tupla e o resultado
  // saía como `number` onde deveria ser array.
  const [vagas, candidaturas, skills, matches] = await Promise.all([
    Promise.all([
      prisma.job.groupBy({ by: ['status'], where: naJanela, _count: { _all: true } }),
      prisma.job.count({ where: naJanela }),
      prisma.job.count({ where: { ...naJanela, status: 'DONE' } }),
    ]),
    prisma.application.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from } },
      _count: { _all: true },
    }),
    Promise.all([
      // `job: { collectedAt: ... }` filtra pela data da vaga RELACIONADA.
      // Antes o serviço buscava o id de todas as vagas da janela e montava
      // `jobId: { in: [...] }` — uma lista sem teto que, além de trafegar, estoura
      // o limite de 65.535 parâmetros do Postgres.
      prisma.jobSkill.groupBy({
        by: ['skillId'],
        where: { job: naJanela },
        // `_count` tem que ser pelo MESMO campo do orderBy: ordenando por
        // `_count.skillId`, o retorno vem `{ skillId: n }`, não `{ _all: n }`.
        _count: { skillId: true },
        orderBy: { _count: { skillId: 'desc' } },
        take: CANDIDATOS,
      }),
      prisma.jobSkill.groupBy({
        by: ['skillId'],
        // `notIn` com lista vazia: o Prisma omite a condição, que é o certo
        // aqui — sem skills no perfil, nada é excluído.
        where: { job: naJanela, skillId: { notIn: idsDoPerfil } },
        _count: { skillId: true },
        orderBy: { _count: { skillId: 'desc' } },
        take: CANDIDATOS,
      }),
    ]),
    // Histograma e média num statement só, em vez de uma linha por match.
    prisma.$queryRaw<Array<Record<string, number | null>>>`
      SELECT
        count(*) FILTER (WHERE score >= 90)::int AS "90+",
        count(*) FILTER (WHERE score >= 80 AND score < 90)::int AS "80-89",
        count(*) FILTER (WHERE score >= 70 AND score < 80)::int AS "70-79",
        count(*) FILTER (WHERE score >= 60 AND score < 70)::int AS "60-69",
        count(*) FILTER (WHERE score >= 50 AND score < 60)::int AS "50-59",
        count(*) FILTER (WHERE score < 50)::int              AS "<50",
        count(*)::int AS total,
        COALESCE(avg(score), 0) AS media
      FROM job_matches
      WHERE computed_at >= ${from}
    `,
  ]);

  const [jobsPorStatus, vagasTotal, vagasAnalisadas] = vagas;
  const [frequentesRaw, lacunasRaw] = skills;

  const jobsByStatus: Record<string, number> = {};
  for (const row of jobsPorStatus) jobsByStatus[row.status] = row._count._all;

  const appsByStatus: Record<string, number> = {};
  for (const row of candidaturas) appsByStatus[row.status] = row._count._all;

  const candidaturasTotal = Object.values(appsByStatus).reduce((a, b) => a + b, 0);
  const aplicadas = appsByStatus['APPLIED'] ?? 0;
  const entrevistas = appsByStatus['INTERVIEW'] ?? 0;
  const ofertas = appsByStatus['OFFER'] ?? 0;
  const rejeitadas = appsByStatus['REJECTED'] ?? 0;

  // Nomes das skills dos dois rankings, em uma query só.
  const idsDasSkills = [...new Set([...frequentesRaw, ...lacunasRaw].map((s) => s.skillId))];
  const nomesPorId = new Map(
    (
      await prisma.skill.findMany({
        where: { id: { in: idsDasSkills } },
        select: { id: true, name: true },
      })
    ).map((s) => [s.id, s.name]),
  );

  type LinhaGroupBy = { skillId: string; _count: { skillId: number } };

  const ordenar = (linhas: LinhaGroupBy[]): Array<{ nome: string; n: number }> =>
    linhas
      .map((l) => ({ nome: nomesPorId.get(l.skillId) ?? '—', n: l._count.skillId }))
      // Empate resolvido pelo nome: estável entre execuções.
      .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome))
      .slice(0, TOP_N);

  const maisFrequentes = ordenar(frequentesRaw).map(({ nome, n }) => ({ name: nome, count: n }));
  const maioresLacunas = ordenar(lacunasRaw).map(({ nome, n }) => ({
    name: nome,
    jobCount: n,
  }));

  const hist = matches[0] ?? ({} as Record<string, number | null>);
  const total = Number(hist.total ?? 0);
  const distribution = [
    { range: '90+', count: Number(hist['90+'] ?? 0) },
    { range: '80-89', count: Number(hist['80-89'] ?? 0) },
    { range: '70-79', count: Number(hist['70-79'] ?? 0) },
    { range: '60-69', count: Number(hist['60-69'] ?? 0) },
    { range: '50-59', count: Number(hist['50-59'] ?? 0) },
    { range: '<50', count: Number(hist['<50'] ?? 0) },
  ];

  return {
    period: { from, to: now },
    jobs: {
      collected: vagasTotal,
      analyzed: vagasAnalisadas,
      byStatus: jobsByStatus,
    },
    applications: {
      total: candidaturasTotal,
      applied: aplicadas,
      interviews: entrevistas,
      offers: ofertas,
      rejected: rejeitadas,
      byStatus: appsByStatus,
    },
    rates: {
      responseRate: candidaturasTotal > 0 ? aplicadas / candidaturasTotal : 0,
      interviewRate: aplicadas > 0 ? entrevistas / aplicadas : 0,
      offerRate: entrevistas > 0 ? ofertas / entrevistas : 0,
    },
    matches: {
      distribution,
      // Math.round para não devolver 82.66666666666667 no JSON.
      averageScore: total > 0 ? Math.round(Number(hist.media ?? 0) * 100) / 100 : 0,
    },
    skills: {
      mostFrequent: maisFrequentes,
      biggestGaps: maioresLacunas,
    },
  };
}
