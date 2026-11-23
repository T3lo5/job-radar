import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js';

export class MatchingStep implements ProcessingStep {
  name = 'matching';

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({
      where: { id: ctx.jobId },
      include: { skills: { include: { skill: true } } },
    });

    if (!job) return;

    const profiles = (await ctx.prisma.profile.findMany({
      include: {
        skills: { include: { skill: true } },
        languages: true,
      },
    })) as Array<{
      id: string;
      skills: Array<{ skill: { name: string } }>;
      languages: unknown;
    }>;

    if (profiles.length === 0) {
      await ctx.prisma.job.update({
        where: { id: ctx.jobId },
        data: { status: 'DONE' },
      });
      return;
    }

    for (const profile of profiles) {
      const result = deps.computeMatchScore(job, profile);

      await ctx.prisma.jobMatch.upsert({
        where: { jobId_profileId: { jobId: ctx.jobId, profileId: profile.id } },
        update: {
          score: result.score,
          breakdown: result.breakdown,
          computedAt: new Date(),
        },
        create: {
          jobId: ctx.jobId,
          profileId: profile.id,
          score: result.score,
          breakdown: result.breakdown,
        },
      });
    }

    await this.updateStatus(ctx, 'MATCHING', 'ANALYZING');
    await deps.enqueueNext(ctx.jobId, 'analyze');
  }

  private async updateStatus(ctx: ProcessingContext, from: string, to: string): Promise<void> {
    await ctx.prisma.job.update({
      where: { id: ctx.jobId },
      data: { status: to },
    });
    await ctx.prisma.jobProcessingLog.create({
      data: { jobId: ctx.jobId, fromStatus: from, toStatus: to },
    });
  }
}
