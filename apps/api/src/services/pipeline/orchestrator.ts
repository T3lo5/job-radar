import { prisma } from '../../db/prisma.js'
import { computeMatchScore, type MatchResult } from '../matching/engine.js'
import { ExtractionStep } from './extraction-step.js'
import { MatchingStep } from './matching-step.js'
import { AnalysisStep } from './analysis-step.js'
import type { ProcessingStep, StepDependencies } from './step.js'
import { createJobExtractor, createJobAnalyzer } from '../ai/factory.js'

export interface PipelineDeps {
  enqueueJob: (name: string, data: Record<string, unknown>) => Promise<void>
}

export class PipelineOrchestrator {
  private steps: Map<string, ProcessingStep>
  private deps: StepDependencies
  private readonly enqueueJob: PipelineDeps['enqueueJob']

  constructor(pipelineDeps: PipelineDeps) {
    this.enqueueJob = pipelineDeps.enqueueJob

    this.steps = new Map<string, ProcessingStep>([
      ['extract', new ExtractionStep()],
      ['match', new MatchingStep()],
      ['analyze', new AnalysisStep()],
    ])

    this.deps = {
      createJobExtractor: () => createJobExtractor(),
      createJobAnalyzer: () => createJobAnalyzer(),
      computeMatchScore: (job: any, profile: any, allSkills: any[]): MatchResult =>
        computeMatchScore(job, profile, allSkills),
      enqueueNext: async (jobId: string, stepName: string) => {
        const jobName = stepName === 'match' ? 'match-job' : 'analyze-job'
        await this.enqueueJob(jobName, { jobId })
      },
    }
  }

  async run(jobId: string, stepName: string): Promise<void> {
    const step = this.steps.get(stepName)
    if (!step) {
      console.warn(`Unknown pipeline step: ${stepName}`)
      return
    }

    const ctx = {
      jobId,
      prisma: this.prismaAdapter(),
    }

    await step.run(ctx, this.deps)
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
    }
  }
}
