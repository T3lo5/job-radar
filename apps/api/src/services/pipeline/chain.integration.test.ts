import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma/index.js';
import { PipelineOrchestrator } from './orchestrator.js';
import type { StepDependencies } from './step.js';

/**
 * A cadeia inteira, contra Postgres de verdade.
 *
 * Os testes por passo (extraction, matching, analysis) verificam cada passo com
 * a entrada feita à mão. Isso não pega o problema que mais importa aqui: um
 * passo produzir um shape que o próximo não espera.
 *
 * Exemplo concreto do que já passou: a extração passou a devolver os IDs das
 * skills já resolvidas, e o matching deixou de receber o catálogo. Nenhum dos
 * dois testes unitários teria notado se o primeiro parasse de popular
 * `job_skills` — o matching leria vazio e pontuaria NEUTRAL, e ambos os testes
 * continuariam verdes.
 *
 * Aqui a vaga entra como a COLETA a entrega (linha crua, status RAW, sem
 * skill nenhuma) e sai no fim como DONE, com score e análise. É o contrato
 * entre as três metades do sistema.
 */

const prisma = new PrismaClient();
const MARCA = '__e2e_cadeia__';

/** As mesmas que a extração devolve. Perfil e vaga precisam casar por nome. */
const SKILLS = ['React', 'TypeScript', 'Node.js'];

/** Skills criadas pelo seed, para a limpeza ser por id. */
let skillIdsCriados: string[] = [];

// Fila real, sem Redis: o teste não quer depender de broker.
const enfileirados: Array<{ name: string; data: Record<string, unknown> }> = [];

/** Extração determinística, sem chamar a IA. */
const EXTRACAO = {
  title: 'Engenheiro Full Stack',
  seniority: 'SENIOR',
  skills: ['React', 'TypeScript', 'Node.js'],
  experienceYears: '5',
  languages: ['Inglês'],
  location: 'Remoto',
  remote: 'REMOTE',
  salary: { min: 8000, max: 12000, currency: 'BRL' },
  requiredRequirements: ['React'],
  niceToHave: ['Kubernetes'],
} as const;

function criarOrchestrator(overrides: Partial<StepDependencies> = {}) {
  const orq = new PipelineOrchestrator({
    enqueueJob: async (name, data) => {
      enfileirados.push({ name, data });
    },
  });

  // deps é privado no tipo, mas substituível em runtime: é assim que se
  // desliga a IA sem tocar na rede.
  (orq as unknown as { deps: StepDependencies }).deps = {
    createJobExtractor: async () => ({ extract: async () => ({ ...EXTRACAO }) }) as never,
    createJobAnalyzer: async () =>
      ({
        analyze: async () => ({
          score: 82,
          nivel_aderencia: 'Alta',
          prioridade: 'alta',
          pontos_fortes: ['React', 'TypeScript'],
          requisitos_faltantes: ['Kubernetes'],
          riscos: [],
          modalidade: 'remoto',
          senioridade: 'senior',
          tecnologias_match: ['React', 'TypeScript', 'Node.js'],
          resumo_vaga: 'Boa aderência técnica.',
          recomendacao: 'Candidatar',
        }),
      }) as never,
    computeMatchScore: (orq as unknown as { deps: StepDependencies }).deps.computeMatchScore,
    // Só registra. Na vida real isto joga no BullMQ e o worker puxa depois;
    // encadear aqui dentro transformaria o teste em outra coisa e esconderia
    // justamente a separação entre passos que ele existe para verificar.
    enqueueNext: async (jobId, stepName) => {
      await orq.enqueueJob(stepName === 'match' ? 'match-job' : 'analyze-job', { jobId });
    },
    ...overrides,
  };

  return orq;
}

let userId: string;
let profileId: string;
let sourceId: string;

async function semear() {
  const user = await prisma.user.create({
    data: { email: `${MARCA}user@test.local`, password: 'x', name: 'Teste E2E' },
  });
  userId = user.id;

  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
      title: 'Engenheiro',
      seniority: 'SENIOR',
      location: 'Remoto',
      remotePreference: 'REMOTE',
      summary: 'Engenheiro com 5 anos de experiencia.',
      jobTypes: ['CLT'],
      focusStacks: [],
      discardTerms: [],
    },
  });
  profileId = profile.id;

  // Skills com o NOME DE VERDADE, não marcados. A extração cria a skill com o
  // nome que a IA devolveu, e o fallback casa por texto: se o perfil tivesse
  // '__e2e__React', a vaga com 'React' nunca casaria com nada e o teste
  // mediria o nada.
  //
  // O banco de teste é separado (jobradar_test), então usar os nomes reais é
  // seguro. A limpeza é por id, não por prefixo.
  // `upsert` e não `create`: a própria extração cria essas skills quando a IA
  // devolve os nomes, então numa segunda execução elas já existem. Criar de
  // novo estourava o @unique de skills.name e derrubava todos os testes —
  // e o vazamento ficava no banco, levando a próxima execução a falhar igual.
  for (const nome of SKILLS) {
    const existentes = await prisma.skill.findUnique({ where: { name: nome } });
    const skill = existentes ?? (await prisma.skill.create({ data: { name: nome, aliases: [] } }));
    if (!existentes) skillIdsCriados.push(skill.id);

    await prisma.profileSkill.create({
      data: { profileId: profile.id, skillId: skill.id, level: 'ADVANCED', yearsExp: 4 },
    });
  }

  const source = await prisma.jobSource.create({
    data: { name: `${MARCA}source`, type: 'api', enabled: true },
  });
  sourceId = source.id;
}

async function novaVaga(suffix = ''): Promise<string> {
  const job = await prisma.job.create({
    data: {
      title: 'Engenheiro Full Stack',
      company: 'Empresa E2E',
      description: 'Vaga com React, TypeScript e Node.js. Remoto.',
      location: 'Remoto',
      remote: 'REMOTE',
      seniority: 'SENIOR',
      url: `https://e2e.test/${MARCA}${suffix}${Date.now()}${Math.random()}`,
      hash: `${MARCA}hash-${suffix}${Date.now()}${Math.random()}`,
      status: 'RAW',
      sourceId,
    },
  });
  return job.id;
}

async function limpar() {
  await prisma.job.deleteMany({ where: { url: { contains: MARCA } } });
  await prisma.jobMatch.deleteMany({ where: { job: { url: { contains: MARCA } } } });
  await prisma.jobAnalysis.deleteMany({ where: { job: { url: { contains: MARCA } } } });
  await prisma.jobProcessingLog.deleteMany({ where: { job: { url: { contains: MARCA } } } });
  await prisma.jobSource.deleteMany({ where: { name: { contains: MARCA } } });
  // ProfileSkill e JobSkill saem por cascade junto de profile e job.
  await prisma.profile.deleteMany({ where: { user: { email: { contains: MARCA } } } });
  await prisma.user.deleteMany({ where: { email: { contains: MARCA } } });
  // Só as skills que ESTE teste criou. As do catálogo real ficam intactas.
  if (skillIdsCriados.length > 0) {
    await prisma.skill.deleteMany({ where: { id: { in: skillIdsCriados } } });
    skillIdsCriados = [];
  }
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
  enfileirados.length = 0;
  await limpar();
  await semear();
});

describe('cadeia completa: extrair -> casar -> analisar', () => {
  it('leva a vaga de RAW a DONE atravessando os tres passos', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    const inicial = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(inicial.status).toBe('RAW');

    await orq.run(jobId, 'extract');
    expect((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('MATCHING');

    await orq.run(jobId, 'match');
    expect((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('ANALYZING');

    await orq.run(jobId, 'analyze');
    expect((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('DONE');
  });

  it('o matching usa as skills que a extracao criou', async () => {
    // Este é o contrato que os testes por passo não pegam. A extração
    // popula job_skills; o matching as lê. Se um dos dois mudar o shape,
    // o score cai para NEUTRAL e o teste falha aqui.
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    await orq.run(jobId, 'extract');

    const jobSkills = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
    });
    expect(jobSkills.map((js) => js.skill.name).sort()).toEqual(['Node.js', 'React', 'TypeScript']);

    await orq.run(jobId, 'match');

    const match = await prisma.jobMatch.findFirstOrThrow({ where: { jobId } });
    // Perfil e vaga tem as mesmas 3 skills => technologies = 100.
    // Se o matching não enxergasse as skills, cairia para NEUTRAL (50).
    const breakdown = match.breakdown as Record<string, number>;
    expect(breakdown.technologies).toBe(100);
    expect(match.profileId).toBe(profileId);
  });

  it('a analise usa o match que o matching gravou', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    await orq.run(jobId, 'extract');
    await orq.run(jobId, 'match');
    await orq.run(jobId, 'analyze');

    const analysis = await prisma.jobAnalysis.findFirstOrThrow({ where: { jobId } });
    // A análise vem da IA falsa (recomendacao Candidatar), não do fallback.
    expect(analysis.recommendation).toBe('STRONG_APPLY');
    expect(analysis.summary).toBe('Boa aderência técnica.');
    expect(analysis.strengths).toEqual(['React', 'TypeScript']);
    expect(analysis.gaps).toEqual(['Kubernetes']);
    // profileId vem do match. Gravar '' aqui estouraria a FK e a vaga ficaria
    // travada em ANALYZING.
    expect(analysis.profileId).toBe(profileId);
  });

  it('grava o log de transicoes de status', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    await orq.run(jobId, 'extract');
    await orq.run(jobId, 'match');
    await orq.run(jobId, 'analyze');

    const logs = await prisma.jobProcessingLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });
    const transicoes = logs.map((l) => `${l.fromStatus ?? '-'}>${l.toStatus}`);

    expect(transicoes).toEqual([
      'RAW>EXTRACTING',
      'EXTRACTING>MATCHING',
      'MATCHING>ANALYZING',
      'ANALYZING>DONE',
    ]);
  });

  it('enfileira o proximo passo, com o nome certo', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    await orq.run(jobId, 'extract');

    expect(enfileirados).toContainEqual({ name: 'match-job', data: { jobId } });
  });
});

describe('cadeia completa — reprocessamento', () => {
  it('rodar a cadeia inteira de novo nao duplica nada', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    for (const passo of ['extract', 'match', 'analyze']) await orq.run(jobId, passo);
    const depois = await contagem(jobId);

    // Reprocessa tudo. A guarda de status deve barrar os tres passos.
    for (const passo of ['extract', 'match', 'analyze']) await orq.run(jobId, passo);
    const final = await contagem(jobId);

    expect(final).toEqual(depois);
    expect(final.jobSkills).toBe(3);
    expect(final.matches).toBe(1);
    expect(final.analyses).toBe(1);
  });

  it('match sem extract roda, mas com technologies neutro', async () => {
    // A guarda de status NÃO impede passo fora de ordem — ela impede
    // REPROCESSAR passo já concluído. Sem extract, a vaga não tem skills e o
    // technologies vai a NEUTRAL (50), não a 100.
    //
    // Documentado porque a primeira versão deste teste esperava 0 matches e
    // falhou: o comportamento real é pontuar, e é o certo — o resto dos
    // critérios (experiência, senioridade, localização) ainda vale.
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    await orq.run(jobId, 'match');

    const match = await prisma.jobMatch.findFirstOrThrow({ where: { jobId } });
    expect((match.breakdown as Record<string, number>).technologies).toBe(50);
    expect((await prisma.job.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('ANALYZING');
  });
});

describe('cadeia completa — degradacao', () => {
  it('IA de extracao fora: o fallback assume e a cadeia termina em DONE', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator({
      createJobExtractor: async () => {
        throw new Error('provedor sem chave');
      },
    });

    await orq.run(jobId, 'extract');
    await orq.run(jobId, 'match');
    await orq.run(jobId, 'analyze');

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('DONE');

    // O fallback casa por TEXTO, e a descrição nomeia as três skills. Então
    // ele encontra as mesmas que a IA teria devolvido — e a cadeia fecha com
    // o mesmo resultado.
    //
    // A primeira versão deste teste esperava 0 skills, achando que o
    // fallback degradado não encontraria nada. Errado: perder a IA não
    // significa perder a extração, só a revisão semântica dela.
    const jobSkills = await prisma.jobSkill.findMany({
      where: { jobId },
      include: { skill: true },
    });
    expect(jobSkills.map((js) => js.skill.name).sort()).toEqual(['Node.js', 'React', 'TypeScript']);

    const match = await prisma.jobMatch.findFirstOrThrow({ where: { jobId } });
    expect((match.breakdown as Record<string, number>).technologies).toBe(100);
    expect(await prisma.jobAnalysis.count({ where: { jobId } })).toBe(1);
  });

  it('IA de analise fora: a analise basica assume e a vaga fecha em DONE', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator({
      createJobAnalyzer: async () => {
        throw new Error('provedor sem chave');
      },
    });

    await orq.run(jobId, 'extract');
    await orq.run(jobId, 'match');
    await orq.run(jobId, 'analyze');

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('DONE');

    // generateBasicAnalysis deriva do match, então o score alto gera
    // STRONG_APPLY mesmo sem IA.
    const analysis = await prisma.jobAnalysis.findFirstOrThrow({ where: { jobId } });
    expect(analysis.recommendation).toBe('STRONG_APPLY');
  });

  it('erro de banco no meio marca FAILED e devolve o erro', async () => {
    const jobId = await novaVaga();
    const orq = criarOrchestrator();

    // Injeta uma falha depois da extração, no matching: simula o tipo de
    // erro que antes deixava a vaga travada para sempre.
    const deps = (orq as unknown as { deps: StepDependencies }).deps;
    deps.createJobExtractor = async () => ({ extract: async () => ({ ...EXTRACAO }) }) as never;
    deps.createJobAnalyzer = async () => {
      throw new Error('deveria nem chegar aqui');
    };
    const original = deps.computeMatchScore;
    deps.computeMatchScore = () => {
      throw new Error('boom no matching');
    };

    await expect(orq.run(jobId, 'extract')).resolves.toBeUndefined();
    // extract passou; agora o match estoura.
    await expect(orq.run(jobId, 'match')).rejects.toThrow('boom no matching');

    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe('FAILED');

    const log = await prisma.jobProcessingLog.findFirst({
      where: { jobId, toStatus: 'FAILED' },
    });
    expect(log?.message).toContain('boom no matching');

    deps.computeMatchScore = original;
  });
});

async function contagem(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { skills: true },
  });
  return {
    status: job.status,
    jobSkills: job.skills.length,
    matches: await prisma.jobMatch.count({ where: { jobId } }),
    analyses: await prisma.jobAnalysis.count({ where: { jobId } }),
    logs: await prisma.jobProcessingLog.count({ where: { jobId } }),
  };
}
