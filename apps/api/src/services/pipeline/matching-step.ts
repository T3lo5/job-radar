import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js'

export class MatchingStep implements ProcessingStep {
  name = 'matching'

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({
      where: { id: ctx.jobId },
      include: { skills: { include: { skill: true } } },
    })

    if (!job) return

    const profile = await ctx.prisma.profile.findFirst({
      include: {
        skills: { include: { skill: true } },
        languages: true,
      },
    })

    if (!profile) {
      await ctx.prisma.job.update({
        where: { id: ctx.jobId },
        data: { status: 'DONE' },
      })
      return
    }

    const allSkills = await ctx.prisma.skill.findMany({})
    const result = deps.computeMatchScore(job, profile, allSkills)

    await ctx.prisma.jobMatch.upsert({
      where: { jobId_profileId: { jobId: ctx.jobId, profileId: profile.id } },
      update: {
        score: result.score,
        breakdown: result.breakdown as any,
        computedAt: new Date(),
      },
      create: {
        jobId: ctx.jobId,
        profileId: profile.id,
        score: result.score,
        breakdown: result.breakdown as any,
      },
    })

    await this.updateStatus(ctx, 'MATCHING', 'ANALYZING')
    await deps.enqueueNext(ctx.jobId, 'analyze')
  }

  private async updateStatus(ctx: ProcessingContext, from: string, to: string): Promise<void> {
    await ctx.prisma.job.update({
      where: { id: ctx.jobId },
      data: { status: to as any },
    })
    await ctx.prisma.jobProcessingLog.create({
      data: { jobId: ctx.jobId, fromStatus: from, toStatus: to },
    })
  }
}
