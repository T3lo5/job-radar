import type { ProcessingContext, ProcessingStep, StepDependencies } from './step.js';
import type { JobExtraction } from '../ai/job-extractor.js';
import { resolveSkills } from './skill-resolver.js';

export class ExtractionStep implements ProcessingStep {
  name = 'extraction';

  async run(ctx: ProcessingContext, deps: StepDependencies): Promise<void> {
    const job = await ctx.prisma.job.findUnique({ where: { id: ctx.jobId } });
    if (!job) return;

    await this.updateStatus(ctx, 'RAW', 'EXTRACTING');

    const { extracted, skillIds } = await this.extract(ctx, job, deps);

    // Deduplica por skillId antes de gravar: dois nomes que caem na mesma skill
    // (React e react) virariam a mesma linha duas vezes, e o skipDuplicates do
    // jobSkill seguraria — mas mandar dado redundante para o banco e pedir
    // para ele limpar nao e o mesmo que mandar certo.
    if (skillIds.length > 0) {
      await ctx.prisma.jobSkill.createMany({
        data: skillIds.map((skillId) => ({ jobId: ctx.jobId, skillId })),
        skipDuplicates: true,
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

  /**
   * Extrai e devolve sempre os IDs das skills já resolvidos.
   *
   * A existência deste método é a correção da leitura duplicada: o fallback
   * carrega o catálogo inteiro para casar por texto e, antes, devolvia só
   * nomes — o `resolveSkills` aí embaixo lia o MESMO catálogo de novo para
   * transformar esses nomes em IDs. Duas leituras da mesma tabela, na mesma
   * chamada, no caminho que já é o degradado.
   *
   * Os dois caminhos agora saem com os IDs em mãos: a IA resolve por nome
   * (3 queries em lote, eram 2 por skill), o fallback reaproveita as linhas
   * que ele acabou de ler (zero query extra).
   */
  private async extract(
    ctx: ProcessingContext,
    job: {
      title: string;
      description: string;
      location: string | null;
      remote: string;
      salaryMin: number | null;
      salaryMax: number | null;
      salaryCurrency: string | null;
    },
    deps: StepDependencies,
  ): Promise<{ extracted: JobExtraction; skillIds: string[] }> {
    try {
      const extractor = await deps.createJobExtractor();
      const extracted = await extractor.extract(job.title, job.description);

      // Resolvido em lote: eram 2 queries por skill (findFirst + upsert), e
      // uma vaga com 20 skills virava 40 round-trips. Sao 3 no total,
      // independentes de quantas skills a vaga tiver.
      const resolvidas = await resolveSkills(ctx.prisma.skill, extracted.skills);
      return { extracted, skillIds: [...new Set([...resolvidas.values()].map((s) => s.id))] };
    } catch {
      const { extracted, skillIds } = await this.fallbackExtraction(ctx, job);
      return { extracted, skillIds };
    }
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

  private async fallbackExtraction(
    ctx: ProcessingContext,
    job: any,
  ): Promise<{ extracted: JobExtraction; skillIds: string[] }> {
    // `select` em vez de `findMany({})`: o casamento é por nome, então
    // `aliases`, `category` e `createdAt` vinham na rede sem uso. Com o
    // catálogo em ~700 skills isso são ~50KB de menos por vaga.
    const allSkills = await ctx.prisma.skill.findMany({
      select: { id: true, name: true },
    });
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

    const extracted: JobExtraction = {
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

    // Os IDs sao das linhas que acabaram de ser lidas. O fallback so
    // REUTILIZA skills do catalogo: ele nunca cria skill nova, senao cada
    // falha de IA poluiria o catalogo sem revisao.
    return {
      extracted,
      skillIds: [...new Set<string>(matchedSkills.map((s: any) => s.id as string))],
    };
  }
}
