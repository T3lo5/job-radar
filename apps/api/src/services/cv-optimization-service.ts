import { prisma } from '../db/prisma.js';
import { CvOptimizer } from './ai/cv-optimizer.js';
import { createAiClient } from './ai/factory.js';
import { checkCvIntegrity, fabricationErrorMessage } from './cv-integrity.js';

export interface CvOptimizationRequest {
  resumeId: string;
  jobId?: string;
  jobDescription?: string;
}

export interface CvOptimizationResult {
  resumeId: string;
  jobId: string | null;
  optimizedText: string;
  changes: Array<{
    type: 'reorder' | 'rewrite' | 'keyword_add' | 'summary';
    section: string;
    description: string;
  }>;
  keywordsAdded: string[];
  summary: string;
  /**
   * Aviso de integridade: keywords que a IA declarou mas que não existem no
   * perfil nem no CV original. Já vêm removidas de `keywordsAdded` — o aviso
   * existe para o usuário saber que aquilo foi barrado.
   */
  warning?: string;
}

export class CvOptimizationService {
  async optimize(request: CvOptimizationRequest): Promise<CvOptimizationResult> {
    const { resumeId, jobId, jobDescription } = request;

    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: { user: { include: { profile: true } } },
    });
    if (!resume) {
      throw new Error('Resume not found');
    }

    const profile = resume.user?.profile;
    if (!profile) {
      throw new Error('User profile not found. Please complete your profile first.');
    }

    let jobTitle = '';
    let finalJobDescription = jobDescription ?? '';

    if (jobId && !finalJobDescription) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });
      if (!job) {
        throw new Error('Job not found');
      }
      jobTitle = job.title;
      finalJobDescription = job.description;
    } else if (jobId && finalJobDescription) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });
      jobTitle = job?.title ?? '';
    }

    if (!finalJobDescription.trim()) {
      throw new Error('Job description is required');
    }

    const profileContext = this.buildProfileContext(profile);

    const ai = await createAiClient();
    const optimizer = new CvOptimizer(ai);
    const result = await optimizer.optimizeWithProfile(
      resume.rawText,
      jobTitle,
      finalJobDescription,
      profileContext,
    );

    // Regra de Ouro verificada de verdade: o prompt pede, mas quem garante é
    // esta checagem contra as fontes. Sem ela, um termo inventado pelo modelo
    // chegaria ao PDF enviado ao recrutador.
    const integrity = checkCvIntegrity({
      skillsClaimed: result.skillsClaimed,
      keywordsAdded: result.keywordsAdded,
      sources: [resume.rawText, profileContext],
    });

    if (integrity.fabricatedSkills.length > 0) {
      throw new Error(fabricationErrorMessage(integrity.fabricatedSkills));
    }

    return {
      resumeId,
      jobId: jobId ?? null,
      optimizedText: result.optimizedText,
      changes: result.changes,
      keywordsAdded: integrity.keywordsAdded,
      summary: result.summary,
      warning: integrity.warning,
    };
  }

  private buildProfileContext(profile: any): string {
    const lines: string[] = [];

    lines.push('=== USER PROFILE (SOURCE OF TRUTH) ===');
    lines.push('');

    if (profile.title) {
      lines.push(`Desired Title: ${profile.title}`);
    }
    if (profile.summary) {
      lines.push(`Professional Summary: ${profile.summary}`);
    }

    lines.push('');
    lines.push('Skills:');
    for (const skill of profile.skills ?? []) {
      const level = skill.level ? ` (${skill.level})` : '';
      const years = skill.yearsExp ? ` - ${skill.yearsExp} years` : '';
      lines.push(`- ${skill.skill?.name ?? skill.name}${level}${years}`);
    }

    lines.push('');
    lines.push('Experience/Projects:');
    for (const project of profile.projects ?? []) {
      lines.push(`- ${project.name}: ${project.description}`);
      if (project.skills?.length > 0) {
        lines.push(`  Technologies: ${project.skills.join(', ')}`);
      }
    }

    lines.push('');
    lines.push('Education:');
    for (const edu of profile.education ?? []) {
      lines.push(`- ${edu.degree} in ${edu.field} at ${edu.institution}`);
    }

    lines.push('');
    lines.push('Certifications:');
    for (const cert of profile.certifications ?? []) {
      lines.push(`- ${cert.name} (${cert.issuer})`);
    }

    lines.push('');
    lines.push('Languages:');
    for (const lang of profile.languages ?? []) {
      lines.push(`- ${lang.language}: ${lang.level}`);
    }

    lines.push('');
    lines.push('=== END OF PROFILE ===');

    return lines.join('\n');
  }
}
