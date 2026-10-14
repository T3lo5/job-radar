import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js';
import type { JobExtraction } from '../ai/job-extractor.js';

export class ExtractionStep implements ProcessingStep {
  name = 'extraction';

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({ where: { id: ctx.jobId } });
    if (!job) return;

    await this.updateStatus(ctx, 'RAW', 'EXTRACTING');

    let extracted: JobExtraction;
    try {
      const extractor = await deps.createJobExtractor();
      extracted = await extractor.extract(job.title, job.description);
    } catch {
      extracted = await this.fallbackExtraction(ctx, job);
    }

    for (const skillName of extracted.skills) {
      let skill = await ctx.prisma.skill.findFirst({
        where: { name: { equals: skillName, mode: 'insensitive' } },
      });

      if (!skill) {
        skill = await ctx.prisma.skill.create({
          data: { name: skillName, aliases: [] },
        });
      }

      await ctx.prisma.jobSkill.upsert({
        where: { jobId_skillId: { jobId: ctx.jobId, skillId: skill.id } },
        update: {},
        create: { jobId: ctx.jobId, skillId: skill.id },
      });
    }

    await ctx.prisma.job.update({
      where: { id: ctx.jobId },
      data: {
        rawData: extracted as any,
        status: 'MATCHING',
      },
    });

    await this.updateStatus(ctx, 'EXTRACTING', 'MATCHING');
    await deps.enqueueNext(ctx.jobId, 'match');
  }

  private async updateStatus(ctx: ProcessingContext, from: string, to: string): Promise<void> {
    await ctx.prisma.job.update({
      where: { id: ctx.jobId },
      data: { status: to as any },
    });
    await ctx.prisma.jobProcessingLog.create({
      data: { jobId: ctx.jobId, fromStatus: from, toStatus: to },
    });
  }

  private async fallbackExtraction(ctx: ProcessingContext, job: any): Promise<JobExtraction> {
    const allSkills = await ctx.prisma.skill.findMany({});
    const descriptionLower = job.description.toLowerCase();

    // Casar por substring puro fazia 'JavaScript' casar com a skill 'Java' e
    // 'R' casar com qualquer palavra contendo 'r' — poluindo o catálogo de
    // skills da vaga, que alimenta todo o matching. Agora exige fronteira de
    // palavra (o \b do regex) e nenhuma skill seria casada -> lista vazia, que
    // o matcher trata como "sem sinal" em vez de inventar Requirement.
    const matchedSkills = allSkills.filter((skill: any) => {
      const name = (skill.name ?? '').toLowerCase().trim();
      if (name.length < 2) return false;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?![a-z0-9+#])`, 'i').test(descriptionLower);
    });

    return {
      title: job.title,
      seniority: null,
      skills: matchedSkills.map((s: any) => s.name),
      experienceYears: null,
      languages: [],
      location: job.location,
      remote: job.remote,
      salary: { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency },
      requiredRequirements: [],
      niceToHave: [],
    };
  }
}
