import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { CvOptimizationService } from '../services/cv-optimization-service.js';
import { coverLetterGenerator } from '../services/cover-letter.js';
import { cvAtsChecker } from '../services/cv-ats-checker.js';
import { getCurrentProfileWithRelations, getCurrentUserId } from '../lib/current-user.js';

export async function cvOptimizerRoutes(app: FastifyInstance) {
  const optimizationService = new CvOptimizationService();

  app.post<{
    Body: {
      resumeId?: string;
      jobId?: string;
      jobDescription?: string;
    };
  }>(
    '/api/cv/optimize',
    {
      schema: {
        body: z.object({
          resumeId: z.string().cuid().optional(),
          jobId: z.string().cuid().optional(),
          jobDescription: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { resumeId, jobId, jobDescription } = request.body;
      const userId = getCurrentUserId(request);

      if (!jobId && !jobDescription) {
        return reply.status(400).send({ error: 'jobId or jobDescription is required' });
      }

      // Um resumeId explícito precisa pertencer à sessão. Antes, qualquer id
      // válido otimizava o CV de outra conta.
      if (resumeId) {
        const owned = await prisma.resume.findFirst({
          where: { id: resumeId, userId },
          select: { id: true },
        });
        if (!owned) {
          return reply.status(404).send({ error: 'Resume not found' });
        }
      }

      const targetResumeId =
        resumeId ??
        (
          await prisma.resume.findFirst({
            where: { userId, isDefault: true },
            orderBy: { createdAt: 'desc' },
          })
        )?.id;

      if (!targetResumeId) {
        return reply.status(404).send({ error: 'No resume found. Please upload a CV first.' });
      }

      try {
        const result = await optimizationService.optimize({
          resumeId: targetResumeId,
          jobId,
          jobDescription,
        });

        return {
          resumeId: result.resumeId,
          jobId: result.jobId,
          optimizedText: result.optimizedText,
          changes: result.changes,
          keywordsAdded: result.keywordsAdded,
          keywordsDropped: result.keywordsDropped,
          keywordEvidence: result.keywordEvidence,
          summary: result.summary,
          // Aviso de integridade (keywords que não existiam nas fontes)
          warning: result.warning,
        };
      } catch (err) {
        return reply.status(422).send({
          error: `Failed to optimize CV: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  app.post<{
    Body: {
      jobId: string;
      recruiterName?: string;
      language?: 'pt-BR' | 'en';
    };
  }>(
    '/api/cv/cover-letter',
    {
      schema: {
        body: z.object({
          jobId: z.string().cuid(),
          recruiterName: z.string().max(200).optional(),
          // Sem `language`, a API detecta o idioma da vaga.
          language: z.enum(['pt-BR', 'en']).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { jobId, recruiterName, language } = request.body;

      const [job, profile] = await Promise.all([
        prisma.job.findUnique({ where: { id: jobId } }),
        getCurrentProfileWithRelations(request),
      ]);

      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const profileContext = buildCoverLetterProfileContext(profile);

      // A integridade vale contra perfil E CV original: o perfil pode não ter
      // uma skill que está no CV, e vice-versa.
      const resume = await prisma.resume.findFirst({
        where: { userId: profile.userId },
        orderBy: { uploadedAt: 'desc' },
        select: { rawText: true },
      });

      try {
        const result = await coverLetterGenerator.generate({
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          profileContext,
          recruiterName,
          language,
          evidenceSources: [profileContext, resume?.rawText ?? ''],
        });

        return result;
      } catch (err) {
        return reply.status(422).send({
          error: `Failed to generate cover letter: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  );

  app.post<{
    Body: {
      text: string;
      jobId?: string;
    };
  }>(
    '/api/cv/ats-check',
    {
      schema: {
        body: z.object({
          text: z.string().min(10, 'Texto do CV muito curto'),
          jobId: z.string().cuid().optional(),
        }),
      },
    },
    async (request) => {
      const { text, jobId } = request.body;

      const result = cvAtsChecker.check(text);

      let keywordMatch: { matched: string[]; missing: string[]; score: number } | undefined;

      if (jobId) {
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: { description: true, title: true },
        });

        if (job) {
          const jobText = `${job.title} ${job.description}`.toLowerCase();
          const cvWords = text.toLowerCase().split(/\s+/).filter(Boolean);
          const commonTech = [
            'javascript',
            'typescript',
            'react',
            'node',
            'python',
            'java',
            'sql',
            'aws',
            'docker',
            'kubernetes',
            'git',
            'html',
            'css',
            'go',
            'rust',
            'c++',
            'c#',
            'php',
            'ruby',
            'swift',
            'kotlin',
            'scala',
            'r',
            'machine learning',
            'ai',
            'devops',
            'ci/cd',
            'agile',
            'scrum',
            'product owner',
            'scrum master',
            'ux',
            'ui',
            'figma',
            'aws',
            'gcp',
            'azure',
            'postgresql',
            'mongodb',
            'redis',
            'elasticsearch',
          ];
          const matched: string[] = [];
          const missing: string[] = [];
          for (const tech of commonTech) {
            if (jobText.includes(tech)) {
              if (cvWords.some((w) => w.includes(tech))) {
                matched.push(tech);
              } else {
                missing.push(tech);
              }
            }
          }
          keywordMatch = {
            matched,
            missing,
            score: (matched.length / Math.max(matched.length + missing.length, 1)) * 100,
          };
        }
      }

      return { resumeId: null, ...result, keywordMatch };
    },
  );
}

function buildCoverLetterProfileContext(profile: any): string {
  const lines: string[] = [];
  lines.push('=== USER PROFILE (SOURCE OF TRUTH) ===');
  lines.push('');

  if (profile.title) {
    lines.push(`Current/Desired Title: ${profile.title}`);
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
  lines.push('Work Experience:');
  for (const exp of profile.workExperiences ?? []) {
    lines.push(
      `- ${exp.role} at ${exp.company} (${exp.startDate ?? ''} - ${exp.current ? 'Present' : (exp.endDate ?? '')})`,
    );
    if (exp.description) lines.push(`  ${exp.description}`);
  }

  lines.push('');
  lines.push('Projects:');
  for (const project of profile.projects ?? []) {
    lines.push(`- ${project.name}: ${project.description}`);
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
