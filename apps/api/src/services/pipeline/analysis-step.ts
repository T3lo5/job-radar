import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js';

export function generateBasicAnalysis(match: unknown): AnalysisInput {
  if (!match) {
    return {
      score: 0,
      nivel_aderencia: 'Muito baixa',
      prioridade: 'baixa',
      pontos_fortes: [],
      requisitos_faltantes: [],
      riscos: [],
      modalidade: 'nao_informado',
      senioridade: 'nao_informado',
      tecnologias_match: [],
      resumo_vaga: 'No match data available',
      recomendacao: 'Ignorar',
    };
  }

  const m = match as { score: number; breakdown?: Record<string, unknown> };
  const criterionScores = Object.entries((m.breakdown ?? {}) as Record<string, unknown>).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );

  const strengths = criterionScores.filter(([, v]) => v >= 70).map(([k]) => k);
  const gaps = criterionScores.filter(([, v]) => v < 50).map(([k]) => k);

  return {
    score: m.score,
    nivel_aderencia: m.score >= 80 ? 'Alta' : m.score >= 60 ? 'Média' : 'Baixa',
    prioridade: m.score >= 80 ? 'alta' : m.score >= 60 ? 'media' : 'baixa',
    pontos_fortes: strengths,
    requisitos_faltantes: gaps,
    riscos: [],
    modalidade: 'nao_informado',
    senioridade: 'nao_informado',
    tecnologias_match: strengths,
    resumo_vaga: `Match score: ${m.score}. ${strengths.length > 0 ? `Strong in: ${strengths.join(', ')}.` : ''} ${gaps.length > 0 ? `Gaps: ${gaps.join(', ')}.` : ''}`,
    recomendacao: m.score >= 70 ? 'Candidatar' : m.score >= 50 ? 'Avaliar' : 'Ignorar',
  };
}

export type AnalysisRecommendation = 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP';

export interface AnalysisInput {
  score: number;
  nivel_aderencia: string;
  prioridade: string;
  pontos_fortes: string[];
  requisitos_faltantes: string[];
  riscos: string[];
  modalidade: string;
  senioridade: string;
  tecnologias_match: string[];
  resumo_vaga: string;
  recomendacao: string;
}

export function mapRecomendacao(rec: string, score?: number): AnalysisRecommendation {
  switch (rec.trim().toLowerCase()) {
    case 'candidatar':
      return typeof score === 'number' && score >= 85 ? 'STRONG_APPLY' : 'APPLY';
    case 'avaliar':
      return 'CONSIDER';
    case 'ignorar':
      return 'SKIP';
    default:
      console.warn(`[analysis] recomendação desconhecida da IA: "${rec}" — usando CONSIDER`);
      return 'CONSIDER';
  }
}

export class AnalysisStep implements ProcessingStep {
  name = 'analysis';

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({
      where: { id: ctx.jobId },
      include: { skills: { include: { skill: true } } },
    });

    if (!job) return;

    const matches = await ctx.prisma.jobMatch.findMany({
      where: { jobId: ctx.jobId },
      orderBy: { score: 'desc' },
    });

    if (!Array.isArray(matches) || matches.length === 0) {
      await ctx.prisma.job.update({
        where: { id: ctx.jobId },
        data: { status: 'DONE' },
      });
      return;
    }

    for (const match of matches) {
      const profile = await ctx.prisma.profile.findUnique({
        where: { id: (match as { profileId: string }).profileId },
        include: {
          skills: { include: { skill: true } },
          workExperiences: true,
          education: true,
          certifications: true,
        },
      });

      let analysis: AnalysisInput;

      if (profile) {
        try {
          const profileSkills = (
            profile as { skills: Array<{ skill: { name: string } }> } & {
              focusStacks?: string[];
              jobTypes?: string[];
              discardTerms?: string[];
              userId: string;
              summary?: string;
            }
          ).skills.map((ps) => ps.skill.name);
          const focusStacksRaw = (profile as { focusStacks?: string[] }).focusStacks;
          const focusStacks =
            focusStacksRaw != null && focusStacksRaw.length > 0 ? focusStacksRaw : profileSkills;

          const resume = await ctx.prisma.resume.findFirst({
            where: { userId: (profile as { userId: string }).userId },
            orderBy: { uploadedAt: 'desc' },
          });
          const resumeText = (resume as { rawText?: string } | null)?.rawText ?? undefined;

          const analyzer = await deps.createJobAnalyzer();
          analysis = await analyzer.analyze(
            (job as { title: string; description: string }).title,
            (job as { title: string; description: string }).description,
            profileSkills,
            resumeText ?? (profile as { summary?: string }).summary ?? undefined,
            (profile as { jobTypes?: string[] }).jobTypes,
            focusStacks,
            (profile as { discardTerms?: string[] }).discardTerms,
          );
        } catch {
          analysis = generateBasicAnalysis(match);
        }
      } else {
        analysis = generateBasicAnalysis(match);
      }

      const recommendation = mapRecomendacao(analysis.recomendacao, analysis.score) as string;

      await ctx.prisma.jobAnalysis.upsert({
        where: {
          jobId_profileId: {
            jobId: ctx.jobId,
            profileId: (match as { profileId: string }).profileId,
          },
        },
        update: {
          summary: analysis.resumo_vaga,
          strengths: analysis.pontos_fortes,
          gaps: analysis.requisitos_faltantes,
          risks: analysis.riscos,
          recommendation,
          generatedAt: new Date(),
        },
        create: {
          jobId: ctx.jobId,
          profileId: (match as { profileId: string }).profileId,
          summary: analysis.resumo_vaga,
          strengths: analysis.pontos_fortes,
          gaps: analysis.requisitos_faltantes,
          risks: analysis.riscos,
          recommendation,
        },
      });
    }

    await this.updateStatus(ctx, 'ANALYZING', 'DONE');
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
