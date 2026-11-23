import { prisma } from '../../db/prisma.js';
import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js';
import { ExtractionStep } from './extraction-step.js';
import { MatchingStep } from './matching-step.js';
import { AnalysisStep } from './analysis-step.js';
import { createJobExtractor, createJobAnalyzer } from '../ai/factory.js';
import { computeMatchScore } from '../matching/engine.js';

export interface PipelineDeps {
  enqueueJob: (name: string, data: Record<string, unknown>) => Promise<void>;
}

/**
 * Superfície do banco usada pela guarda de progresso do próprio orquestrador.
 *
 * Separada do `prismaAdapter` (que é passado aos steps) porque aqui é só o que
 * o retry precisa: ler o status, marcar FAILED e registrar em que estágio a
 * falha aconteceu. Nos testes, um objeto em memória substitui o Postgres sem
 * precisar do client.
 */
export interface PipelineProgressDb {
  job: {
    findUnique(args: {
      where: { id: string };
      select: { status: true };
    }): Promise<{ status: string } | null>;
    update(args: { where: { id: string }; data: { status: string } }): Promise<unknown>;
  };
  jobProcessingLog: {
    create(args: {
      data: {
        jobId: string;
        fromStatus: string | null;
        toStatus: string;
        message?: string;
      };
    }): Promise<unknown>;
    findFirst(args: {
      where: { jobId: string; toStatus: string; fromStatus: { not: null } };
      orderBy: { createdAt: 'desc' };
      select: { fromStatus: true };
    }): Promise<{ fromStatus: string | null } | null>;
  };
}

export interface PipelineOptions {
  /** Steps injetáveis: os testes trocam por fakes sem tocar no banco/IA. */
  steps?: Map<string, ProcessingStep>;
  /** Sobrescreve dependências dos steps (IA, matching, enfileiramento). */
  deps?: Partial<StepDependencies>;
  progressDb?: PipelineProgressDb;
}

/**
 * O step já foi aplicado? Cada stage é terminal quando chega no próximo.
 * O retry do BullMQ reapresenta o mesmo job, e sem esta guarda a IA seria
 * chamada de novo e paga de novo.
 *
 * `FAILED` NUNCA conta como concluído. Antes, a condição do extract era
 * `status !== 'RAW' && status !== 'EXTRACTING'`, então uma falha deixava a
 * extração "feita" e o retry era descartado em silêncio — a vaga ficava
 * FAILED para sempre.
 */
function isStepDone(status: string, stepName: string): boolean {
  if (status === 'FAILED') return false;

  switch (stepName) {
    case 'extract':
      return status !== 'RAW' && status !== 'EXTRACTING';
    case 'match':
      return status === 'ANALYZING' || status === 'DONE';
    case 'analyze':
      return status === 'DONE';
    default:
      return false;
  }
}

function defaultProgressDb(): PipelineProgressDb {
  return {
    job: {
      findUnique: (args) =>
        prisma.job.findUnique(args) as unknown as Promise<{ status: string } | null>,
      update: (args) => prisma.job.update(args as never) as unknown as Promise<unknown>,
    },
    jobProcessingLog: {
      create: (args) =>
        prisma.jobProcessingLog.create({
          data: { ...args.data, message: args.data.message },
        }),
      findFirst: (args) =>
        prisma.jobProcessingLog.findFirst(args) as unknown as Promise<{
          fromStatus: string | null;
        } | null>,
    },
  };
}

export class PipelineOrchestrator {
  private steps: Map<string, ProcessingStep>;
  private deps: StepDependencies;
  private readonly enqueueJob: PipelineDeps['enqueueJob'];
  private readonly progressDb: PipelineProgressDb;

  constructor(pipelineDeps: PipelineDeps, options: PipelineOptions = {}) {
    this.enqueueJob = pipelineDeps.enqueueJob;
    this.progressDb = options.progressDb ?? defaultProgressDb();

    this.steps =
      options.steps ??
      new Map<string, ProcessingStep>([
        ['extract', new ExtractionStep()],
        ['match', new MatchingStep()],
        ['analyze', new AnalysisStep()],
      ]);

    this.deps = {
      createJobExtractor: () => createJobExtractor(),
      createJobAnalyzer: () => createJobAnalyzer(),
      computeMatchScore: (job: unknown, profile: unknown) =>
        computeMatchScore(job as never, profile as never),
      enqueueNext: async (jobId: string, stepName: string) => {
        const jobName = stepName === 'match' ? 'match-job' : 'analyze-job';
        await this.enqueueJob(jobName, { jobId });
      },
      ...options.deps,
    };
  }

  async run(jobId: string, stepName: string): Promise<void> {
    const step = this.steps.get(stepName);
    if (!step) {
      console.warn(`Unknown pipeline step: ${stepName}`);
      return;
    }

    const ctx = {
      jobId,
      prisma: this.prismaAdapter(),
    };

    // Idempotência: um step já concluído não roda de novo. Sem isto, recoletar
    // a mesma vaga e rodar "processar todas" refazia a chamada de IA (custo) e
    // criava registros duplicados no JobProcessingLog.
    const status = await this.effectiveStatus(jobId);
    if (status === null) {
      console.warn(`[pipeline] vaga ${jobId} não encontrada; step ${stepName} ignorado`);
      return;
    }
    if (isStepDone(status, stepName)) {
      console.log(`[pipeline] ${stepName} ignorado para ${jobId}: status ${status}`);
      return;
    }

    try {
      await step.run(ctx, this.deps);
    } catch (err) {
      // Sem isto a vaga ficava travada em EXTRACTING/MATCHING/ANALYZING para
      // sempre: o job do BullMQ era dado como falho, mas o status no banco
      // nunca mudava, e o /stats contava "Com erro: 0" sempre.
      console.error(`[pipeline] step ${stepName} falhou para ${jobId}:`, err);

      // `fromStatus` é o progresso persistido: é ele que o retry lê para saber
      // qual etapa já tinha sido concluída. Sem gravar isto, FAILED apagava a
      // informação de onde a vaga parou.
      const failedAt = await this.progressDb.job
        .findUnique({ where: { id: jobId }, select: { status: true } })
        .catch(() => null);
      const fromStatus = failedAt && failedAt.status !== 'FAILED' ? failedAt.status : null;

      await this.progressDb.job
        .update({ where: { id: jobId }, data: { status: 'FAILED' } })
        .catch((updateErr) =>
          console.error(`[pipeline] erro ao marcar vaga ${jobId} como FAILED:`, updateErr),
        );
      await this.progressDb.jobProcessingLog
        .create({
          data: {
            jobId,
            fromStatus,
            toStatus: 'FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        })
        .catch((logErr) =>
          console.error(`[pipeline] erro ao registrar log de falha para ${jobId}:`, logErr),
        );

      // Repassa o erro para o retry do BullMQ continuar valendo.
      throw err;
    }
  }

  /**
   * Status que representa o progresso real da vaga.
   *
   * `FAILED` apaga o estágio em que a vaga estava, mas o log da falha guarda o
   * `fromStatus` (EXTRACTING/MATCHING/ANALYZING). O retry usa esse valor para
   * pular o que já foi feito e reprocessar só a etapa pendente. Vaga FAILED
   * antiga, sem log com `fromStatus`, é tratada como RAW: reprocessar do zero
   * é caro, mas é melhor do que nunca sair do FAILED.
   */
  private async effectiveStatus(jobId: string): Promise<string | null> {
    const job = await this.progressDb.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });

    if (!job) return null;
    if (job.status !== 'FAILED') return job.status;

    const failure = await this.progressDb.jobProcessingLog.findFirst({
      where: { jobId, toStatus: 'FAILED', fromStatus: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { fromStatus: true },
    });

    return failure?.fromStatus ?? 'RAW';
  }

  private prismaAdapter(): ProcessingContext['prisma'] {
    return {
      job: {
        findUnique: (args: Record<string, unknown>) => prisma.job.findUnique(args as never),
        update: (args: Record<string, unknown>) => prisma.job.update(args as never),
      },
      jobMatch: {
        upsert: (args: Record<string, unknown>) => prisma.jobMatch.upsert(args as never),
        findFirst: (args: Record<string, unknown>) => prisma.jobMatch.findFirst(args as never),
        findMany: (args: Record<string, unknown>) => prisma.jobMatch.findMany(args as never),
      },
      jobAnalysis: {
        upsert: (args: Record<string, unknown>) => prisma.jobAnalysis.upsert(args as never),
      },
      jobProcessingLog: {
        create: (args: Record<string, unknown>) => prisma.jobProcessingLog.create(args as never),
      },
      skill: {
        findFirst: (args: Record<string, unknown>) => prisma.skill.findFirst(args as never),
        create: (args: Record<string, unknown>) => prisma.skill.create(args as never),
        createMany: (args: Record<string, unknown>) => prisma.skill.createMany(args as never),
        findMany: (args: Record<string, unknown>) => prisma.skill.findMany(args as never),
      },
      jobSkill: {
        upsert: (args: Record<string, unknown>) => prisma.jobSkill.upsert(args as never),
        createMany: (args: Record<string, unknown>) => prisma.jobSkill.createMany(args as never),
      },
      profile: {
        findFirst: (args: Record<string, unknown>) => prisma.profile.findFirst(args as never),
        findMany: (args: Record<string, unknown>) => prisma.profile.findMany(args as never),
        findUnique: (args: Record<string, unknown>) => prisma.profile.findUnique(args as never),
      },
      user: {
        findFirst: (args: Record<string, unknown>) => prisma.user.findFirst(args as never),
      },
      resume: {
        findFirst: (args: Record<string, unknown>) => prisma.resume.findFirst(args as never),
      },
    };
  }
}
