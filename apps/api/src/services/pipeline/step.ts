export interface ProcessingContext {
  jobId: string
  prisma: {
    job: {
      findUnique: (args: any) => Promise<any>
      update: (args: any) => Promise<any>
    }
    jobMatch: {
      upsert: (args: any) => Promise<any>
      findFirst: (args: any) => Promise<any>
    }
    jobAnalysis: {
      upsert: (args: any) => Promise<any>
    }
    jobProcessingLog: {
      create: (args: any) => Promise<any>
    }
    skill: {
      findFirst: (args: any) => Promise<any>
      create: (args: any) => Promise<any>
      findMany: (args: any) => Promise<any>
    }
    jobSkill: {
      upsert: (args: any) => Promise<any>
    }
    profile: {
      findFirst: (args: any) => Promise<any>
    }
  }
}

import type { JobExtractor } from '../ai/job-extractor.js'
import type { JobAnalyzer } from '../ai/job-analyzer.js'
import type { MatchResult } from '../matching/engine.js'

export interface StepDependencies {
  createJobExtractor: () => Promise<JobExtractor>
  createJobAnalyzer: () => Promise<JobAnalyzer>
  computeMatchScore: (job: any, profile: any, allSkills: any[]) => MatchResult
  enqueueNext: (jobId: string, stepName: string) => Promise<void>
}

export interface ProcessingStep {
  name: string
  run(ctx: ProcessingContext, deps: StepDependencies): Promise<void>
}
