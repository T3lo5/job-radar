import type { JobExtractor } from '../ai/job-extractor.js';
import type { JobAnalyzer } from '../ai/job-analyzer.js';
import type { MatchResult } from '../matching/engine.js';

/**
 * Argumentos de consulta do Prisma. Usamos `Record<string, unknown>` em vez
 * de `any` para evitar `no-explicit-any` enquanto mantemos a assinatura
 * flexível o suficiente para aceitar qualquer shape de args do Prisma.
 */
export type PrismaArgs = Record<string, unknown>;

export interface ProcessingContext {
  jobId: string;
  prisma: {
    job: {
      findUnique: (args: PrismaArgs) => Promise<unknown>;
      update: (args: PrismaArgs) => Promise<unknown>;
    };
    jobMatch: {
      upsert: (args: PrismaArgs) => Promise<unknown>;
      findFirst: (args: PrismaArgs) => Promise<unknown>;
      findMany: (args: PrismaArgs) => Promise<unknown>;
    };
    jobAnalysis: {
      upsert: (args: PrismaArgs) => Promise<unknown>;
    };
    jobProcessingLog: {
      create: (args: PrismaArgs) => Promise<unknown>;
    };
    skill: {
      findFirst: (args: PrismaArgs) => Promise<unknown>;
      create: (args: PrismaArgs) => Promise<unknown>;
      createMany: (args: PrismaArgs) => Promise<unknown>;
      findMany: (args: PrismaArgs) => Promise<unknown>;
    };
    jobSkill: {
      upsert: (args: PrismaArgs) => Promise<unknown>;
      createMany: (args: PrismaArgs) => Promise<unknown>;
    };
    profile: {
      findFirst: (args: PrismaArgs) => Promise<unknown>;
      findMany: (args: PrismaArgs) => Promise<unknown>;
      findUnique: (args: PrismaArgs) => Promise<unknown>;
    };
    user: {
      findFirst: (args: PrismaArgs) => Promise<unknown>;
    };
    resume: {
      findFirst: (args: PrismaArgs) => Promise<unknown>;
    };
  };
}

export interface StepDependencies {
  createJobExtractor: () => Promise<JobExtractor>;
  createJobAnalyzer: () => Promise<JobAnalyzer>;
  computeMatchScore: (job: unknown, profile: unknown) => MatchResult;
  enqueueNext: (jobId: string, stepName: string) => Promise<void>;
}

export interface ProcessingStep {
  name: string;
  run(ctx: ProcessingContext, deps: StepDependencies): Promise<void>;
}
