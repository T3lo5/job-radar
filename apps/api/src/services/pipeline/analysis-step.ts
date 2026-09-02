import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js'

export interface AnalysisInput {
  score: number
  nivel_aderencia: string
  prioridade: string
  pontos_fortes: string[]
  requisitos_faltantes: string[]
  riscos: string[]
  modalidade: string
  senioridade: string
  tecnologias_match: string[]
  resumo_vaga: string
  recomendacao: string
}

export function mapRecomendacao(rec: string): 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP' {
  switch (rec) {
    case 'Candidatar': return 'STRONG_APPLY'
    case 'Avaliar': return 'CONSIDER'
    case 'Ignorar': return 'SKIP'
    default: return 'CONSIDER'
  }
}

export function generateBasicAnalysis(match: any): AnalysisInput {
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
    }
  }

  const breakdown = match.breakdown as Record<string, number>
  const strengths = Object.entries(breakdown)
    .filter(([, v]) => v >= 70)
    .map(([k]) => k)
  const gaps = Object.entries(breakdown)
    .filter(([, v]) => v < 50)
    .map(([k]) => k)

  return {
    score: match.score,
    nivel_aderencia: match.score >= 80 ? 'Alta' : match.score >= 60 ? 'Média' : 'Baixa',
    prioridade: match.score >= 80 ? 'alta' : match.score >= 60 ? 'media' : 'baixa',
    pontos_fortes: strengths,
    requisitos_faltantes: gaps,
    riscos: [],
    modalidade: 'nao_informado',
    senioridade: 'nao_informado',
    tecnologias_match: strengths,
    resumo_vaga: `Match score: ${match.score}. ${strengths.length > 0 ? `Strong in: ${strengths.join(', ')}.` : ''} ${gaps.length > 0 ? `Gaps: ${gaps.join(', ')}.` : ''}`,
    recomendacao: match.score >= 70 ? 'Candidatar' : match.score >= 50 ? 'Avaliar' : 'Ignorar',
  }
}

export class AnalysisStep implements ProcessingStep {
  name = 'analysis'

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({
      where: { id: ctx.jobId },
      include: { skills: { include: { skill: true } } },
    })

    if (!job) return

    const match = await ctx.prisma.jobMatch.findFirst({
      where: { jobId: ctx.jobId },
    })

    const profile = await ctx.prisma.profile.findFirst({
      include: { skills: { include: { skill: true } } },
    })

    let analysis: AnalysisInput

    if (profile) {
      try {
        const profileSkills = profile.skills.map((ps: { skill: { name: string } }) => ps.skill.name)
        const analyzer = await deps.createJobAnalyzer()
        analysis = await analyzer.analyze(
          job.title,
          job.description,
          profileSkills,
          profile.summary ?? undefined,
          profile.jobTypes,
          profile.focusStacks,
          profile.discardTerms,
        )
      } catch {
        analysis = generateBasicAnalysis(match)
      }
    } else {
      analysis = generateBasicAnalysis(match)
    }

    await ctx.prisma.jobAnalysis.upsert({
      where: { jobId_profileId: { jobId: ctx.jobId, profileId: match?.profileId ?? '' } },
      update: {
        summary: analysis.resumo_vaga,
        strengths: analysis.pontos_fortes,
        gaps: analysis.requisitos_faltantes,
        risks: analysis.riscos,
        recommendation: mapRecomendacao(analysis.recomendacao) as any,
        generatedAt: new Date(),
      },
      create: {
        jobId: ctx.jobId,
        profileId: match?.profileId ?? '',
        summary: analysis.resumo_vaga,
        strengths: analysis.pontos_fortes,
        gaps: analysis.requisitos_faltantes,
        risks: analysis.riscos,
        recommendation: mapRecomendacao(analysis.recomendacao) as any,
      },
    })

    await this.updateStatus(ctx, 'ANALYZING', 'DONE')
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
