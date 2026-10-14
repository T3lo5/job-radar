import { prisma } from '../../db/prisma.js';
import { computeMatchScore, type MatchResult } from '../matching/engine.js';
import { ExtractionStep } from './extraction-step.js';
import { MatchingStep } from './matching-step.js';
import { AnalysisStep } from './analysis-step.js';
import type { ProcessingStep, StepDependencies } from './step.js';
import { createJobExtractor, createJobAnalyzer } from '../ai/factory.js';

export interface PipelineDeps {
  enqueueJob: (name: string, data: Record<string, unknown>) => Promise<void>;
}

/**
 * O step já foi aplicado? Cada stage é terminal quando chega no próximo.
 * O retry do BullMQ reapresenta o mesmo job, e sem esta guarda a IA seria
 * chamada de novo e paga de novo.
 */
function isStepDone(status: string, stepName: string): boolean {
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

export class PipelineOrchestrator {
  private steps: Map<string, ProcessingStep>;
  private deps: StepDependencies;
  private readonly enqueueJob: PipelineDeps['enqueueJob'];

  constructor(pipelineDeps: PipelineDeps) {
    this.enqueueJob = pipelineDeps.enqueueJob;

    this.steps = new Map<string, ProcessingStep>([
      ['extract', new ExtractionStep()],
      ['match', new MatchingStep()],
      ['analyze', new AnalysisStep()],
    ]);

    this.deps = {
      createJobExtractor: () => createJobExtractor(),
      createJobAnalyzer: () => createJobAnalyzer(),
      computeMatchScore: (job: any, profile: any, allSkills: any[]): MatchResult =>
        computeMatchScore(job, profile, allSkills),
      enqueueNext: async (jobId: string, stepName: string) => {
        const jobName = stepName === 'match' ? 'match-job' : 'analyze-job';
        await this.enqueueJob(jobName, { jobId });
      },
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
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (job && isStepDone(job.status, stepName)) {
      console.log(`[pipeline] ${stepName} ignorado para ${jobId}: status ${job.status}`);
      return;
    }

    try {
      await step.run(ctx, this.deps);
    } catch (err) {
      // Sem isto a vaga ficava travada em EXTRACTING/MATCHING/ANALYZING para
      // sempre: o job do BullMQ era dado como falho, mas o status no banco
      // nunca mudava, e o /stats contava "Com erro: 0" sempre.
      console.error(`[pipeline] step ${stepName} falhou para ${jobId}:`, err);
      await prisma.job.update({ where: { id: jobId }, data: { status: 'FAILED' } }).catch(() => {});
      await prisma.jobProcessingLog
        .create({
          data: {
            jobId,
            toStatus: 'FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => {});
      // Repassa o erro para o retry do BullMQ continuar valendo.
      throw err;
    }
  }

  private prismaAdapter() {
    return {
      job: {
        findUnique: (args: any) => prisma.job.findUnique(args),
        update: (args: any) => prisma.job.update(args),
      },
      jobMatch: {
        upsert: (args: any) => prisma.jobMatch.upsert(args),
        findFirst: (args: any) => prisma.jobMatch.findFirst(args),
      },
      jobAnalysis: {
        upsert: (args: any) => prisma.jobAnalysis.upsert(args),
      },
      jobProcessingLog: {
        create: (args: any) => prisma.jobProcessingLog.create(args),
      },
      skill: {
        findFirst: (args: any) => prisma.skill.findFirst(args),
        create: (args: any) => prisma.skill.create(args),
        findMany: (args: any) => prisma.skill.findMany(args),
      },
      jobSkill: {
        upsert: (args: any) => prisma.jobSkill.upsert(args),
      },
      profile: {
        findFirst: (args: any) => prisma.profile.findFirst(args),
      },
      user: {
        findFirst: (args: any) => prisma.user.findFirst(args),
      },
      resume: {
        findFirst: (args: any) => prisma.resume.findFirst(args),
      },
    };
  }
}
