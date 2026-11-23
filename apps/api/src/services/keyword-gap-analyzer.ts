import { prisma } from '../db/prisma.js';
import { computeMatchScore } from './matching/engine.js';

export interface KeywordGap {
  keyword: string;
  category: 'required' | 'nice-to-have';
  status: 'matched' | 'partial' | 'missing';
  suggestion?: string;
}

export interface KeywordGapReport {
  score: number;
  matched: string[];
  partial: string[];
  missing: string[];
  gaps: KeywordGap[];
  recommendation: string;
}

/**
 * Analisa o gap de keywords entre a vaga e o perfil do candidato.
 *
 * Baseado no guia: "Separe o que é obrigatório (Requirements, Must have)
 * do que é desejável (Nice to have, Bonus)" e "O recrutador filtra por
 * habilidades (skills)".
 */
export class KeywordGapAnalyzer {
  async analyze(jobId: string, userId: string): Promise<KeywordGapReport> {
    const [job, profile] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        include: { skills: { include: { skill: true } } },
      }),
      prisma.profile.findUnique({
        where: { userId },
        include: {
          skills: { include: { skill: true } },
          languages: true,
        },
      }),
    ]);

    if (!job) throw new Error('Job not found');
    if (!profile) throw new Error('Profile not found');

    const match = computeMatchScore(job as any, profile as any);

    // Keywords extraídas textualmente da descrição (além das skills estruturadas)
    const textKeywords = this.extractTextKeywords(job.description);

    const gaps: KeywordGap[] = [];
    const seen = new Set<string>();

    // Skills estruturadas da vaga (obrigatórias e desejáveis)
    for (const js of job.skills ?? []) {
      const name = js.skill.name;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const status = match.missingSkills.includes(name)
        ? 'missing'
        : match.partialSkills.includes(name)
          ? 'partial'
          : 'matched';

      gaps.push({
        keyword: name,
        category: js.required ? 'required' : 'nice-to-have',
        status,
        suggestion: this.suggestAction(status, js.required),
      });
    }

    // Keywords textuais que não estão nas skills estruturadas
    for (const kw of textKeywords) {
      if (seen.has(kw.toLowerCase())) continue;
      seen.add(kw.toLowerCase());
      const inProfile = this.keywordInProfile(kw, profile);
      gaps.push({
        keyword: kw,
        category: 'nice-to-have',
        status: inProfile ? 'matched' : 'missing',
      });
    }

    return {
      score: match.score,
      matched: match.matchedSkills,
      partial: match.partialSkills,
      missing: match.missingSkills,
      gaps,
      recommendation: match.recommendation,
    };
  }

  private extractTextKeywords(description: string): string[] {
    if (!description) return [];
    const techPatterns = [
      /\b(?:React|Vue|Angular|Next\.?js|Nuxt|Svelte)\b/g,
      /\b(?:Node\.?js|Express|Fastify|NestJS|Koa)\b/g,
      /\b(?:TypeScript|JavaScript|Python|Java|Go|Rust|C#|C\+\+|PHP|Ruby)\b/g,
      /\b(?:AWS|Azure|GCP|Google Cloud|Docker|Kubernetes|Terraform)\b/g,
      /\b(?:PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|SQL Server|Oracle)\b/g,
      /\b(?:GraphQL|REST|gRPC|WebSocket)\b/g,
      /\b(?:CI\/CD|Jenkins|GitHub Actions|GitLab CI)\b/g,
    ];
    const found = new Set<string>();
    for (const pattern of techPatterns) {
      const matches = description.match(pattern);
      if (matches) {
        for (const m of matches) found.add(m);
      }
    }
    return [...found];
  }

  private keywordInProfile(keyword: string, profile: any): boolean {
    const kw = keyword.toLowerCase();
    for (const ps of profile.skills ?? []) {
      if (ps.skill?.name?.toLowerCase() === kw) return true;
      if (ps.skill?.aliases?.some((a: string) => a.toLowerCase() === kw)) return true;
    }
    return false;
  }

  private suggestAction(status: string, required: boolean): string {
    if (status === 'matched') return '';
    if (status === 'partial') {
      return required
        ? 'Você tem experiência relacionada. Destaque no CV como skill principal.'
        : 'Considere listá-la se tiver experiência real.';
    }
    return required
      ? 'Skill obrigatória que você não possui. Avalie se a vaga é realista para o seu perfil.'
      : 'Skill desejável. Se tiver experiência, adicione ao perfil para melhorar o match.';
  }
}

export const keywordGapAnalyzer = new KeywordGapAnalyzer();
