import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';

const skillLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);
const senioritySchema = z.enum(['INTERN', 'JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD']);
const remoteModeSchema = z.enum(['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN']);

const profileUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  seniority: senioritySchema.optional(),
  seniorityList: z.array(senioritySchema).optional(),
  location: z.string().max(200).nullable().optional(),
  remotePreference: remoteModeSchema.optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().length(3).optional(),
  summary: z.string().max(5000).nullable().optional(),
  jobTypes: z.array(z.string()).optional(),
  focusStacks: z.array(z.string()).optional(),
  discardTerms: z.array(z.string()).optional(),
});

const addSkillSchema = z.object({
  skillName: z.string().min(1).max(100),
  level: skillLevelSchema,
  yearsExp: z.number().int().min(0).max(50).nullable().optional(),
});

const preferencesSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location: z.string().max(200).nullable().optional(),
  remotePreference: remoteModeSchema.optional(),
  salaryMin: z.number().int().min(0).nullable().optional(),
  salaryMax: z.number().int().min(0).nullable().optional(),
  salaryCurrency: z.string().length(3).optional(),
});

const cuidSchema = z.object({ id: z.string().cuid() });

const educationSchema = z.object({
  degree: z.string().min(1).max(200),
  field: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const languageSchema = z.object({
  language: z.string().min(1).max(100),
  level: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED', 'FLUENT', 'NATIVE']),
});

const certificationSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).nullable().optional(),
  issuedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  credentialId: z.string().max(200).nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
});

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
  skills: z.array(z.string()).max(20).optional(),
});

const workExperienceSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  current: z.boolean().default(false),
  skills: z.array(z.string()).max(20).optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get('/api/profile', async (_request, reply) => {
    const profile = await prisma.profile.findFirst({
      include: {
        skills: {
          include: { skill: true },
          orderBy: { skill: { name: 'asc' } },
        },
        education: true,
        certifications: true,
        projects: true,
        languages: true,
      },
    });

    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    return profile;
  });

  app.put('/api/profile', { schema: { body: profileUpdateSchema } }, async (request, reply) => {
    const body = request.body as z.infer<typeof profileUpdateSchema>;

    const existing = await prisma.profile.findFirst();
    if (!existing) {
      // Create profile if none exists
      const user = await prisma.user.findFirst();
      if (!user) {
        return reply.status(400).send({ error: 'No user found. Please seed the database first.' });
      }
      const created = await prisma.profile.create({
        data: {
          userId: user.id,
          ...body,
          seniorityList: body.seniorityList ?? [],
          jobTypes: body.jobTypes ?? [],
          focusStacks: body.focusStacks ?? [],
          discardTerms: body.discardTerms ?? [],
        },
        include: {
          skills: { include: { skill: true } },
          education: true,
          certifications: true,
          projects: true,
          languages: true,
        },
      });
      return reply.status(201).send(created);
    }

    const updated = await prisma.profile.update({
      where: { id: existing.id },
      data: {
        ...body,
        seniorityList: body.seniorityList ?? existing.seniorityList,
        jobTypes: body.jobTypes ?? existing.jobTypes,
        focusStacks: body.focusStacks ?? existing.focusStacks,
        discardTerms: body.discardTerms ?? existing.discardTerms,
      },
      include: {
        skills: { include: { skill: true } },
        education: true,
        certifications: true,
        projects: true,
        languages: true,
      },
    });

    return updated;
  });

  app.post('/api/profile/skills', { schema: { body: addSkillSchema } }, async (request, reply) => {
    const { skillName, level, yearsExp } = request.body as z.infer<typeof addSkillSchema>;

    const profile = await prisma.profile.findFirst();
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    const skill = await prisma.skill.upsert({
      where: { name: skillName },
      update: {},
      create: { name: skillName, aliases: [], category: null },
    });

    const profileSkill = await prisma.profileSkill.upsert({
      where: {
        profileId_skillId: {
          profileId: profile.id,
          skillId: skill.id,
        },
      },
      update: { level, yearsExp },
      create: {
        profileId: profile.id,
        skillId: skill.id,
        level,
        yearsExp,
      },
      include: { skill: true },
    });

    return reply.status(201).send(profileSkill);
  });

  app.delete(
    '/api/profile/skills/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const profileSkill = await prisma.profileSkill.findUnique({
        where: { id },
      });

      if (!profileSkill) {
        return reply.status(404).send({ error: 'Profile skill not found' });
      }

      await prisma.profileSkill.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  app.put(
    '/api/profile/preferences',
    { schema: { body: preferencesSchema } },
    async (request, reply) => {
      const existing = await prisma.profile.findFirst();
      if (!existing) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const body = request.body as z.infer<typeof preferencesSchema>;
      const updated = await prisma.profile.update({
        where: { id: existing.id },
        data: body,
        include: {
          skills: { include: { skill: true } },
          education: true,
          certifications: true,
          projects: true,
          languages: true,
        },
      });

      return updated;
    },
  );

  // Education endpoints
  app.post(
    '/api/profile/education',
    { schema: { body: educationSchema } },
    async (request, reply) => {
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const data = request.body as z.infer<typeof educationSchema>;
      const education = await prisma.education.create({
        data: {
          profileId: profile.id,
          ...data,
        },
      });

      return reply.status(201).send(education);
    },
  );

  app.put(
    '/api/profile/education/:id',
    { schema: { params: cuidSchema, body: educationSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;
      const data = request.body as z.infer<typeof educationSchema>;

      const existing = await prisma.education.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Education not found' });
      }

      const education = await prisma.education.update({
        where: { id },
        data,
      });

      return education;
    },
  );

  app.delete(
    '/api/profile/education/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const existing = await prisma.education.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Education not found' });
      }

      await prisma.education.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // Language endpoints
  app.post(
    '/api/profile/languages',
    { schema: { body: languageSchema } },
    async (request, reply) => {
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const data = request.body as z.infer<typeof languageSchema>;
      const language = await prisma.profileLanguage.create({
        data: {
          profileId: profile.id,
          ...data,
        },
      });

      return reply.status(201).send(language);
    },
  );

  app.put(
    '/api/profile/languages/:id',
    { schema: { params: cuidSchema, body: languageSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;
      const data = request.body as z.infer<typeof languageSchema>;

      const existing = await prisma.profileLanguage.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Language not found' });
      }

      const language = await prisma.profileLanguage.update({
        where: { id },
        data,
      });

      return language;
    },
  );

  app.delete(
    '/api/profile/languages/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const existing = await prisma.profileLanguage.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Language not found' });
      }

      await prisma.profileLanguage.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // Certification endpoints
  app.post(
    '/api/profile/certifications',
    { schema: { body: certificationSchema } },
    async (request, reply) => {
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const data = request.body as z.infer<typeof certificationSchema>;
      const certification = await prisma.certification.create({
        data: {
          profileId: profile.id,
          ...data,
        },
      });

      return reply.status(201).send(certification);
    },
  );

  app.put(
    '/api/profile/certifications/:id',
    { schema: { params: cuidSchema, body: certificationSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;
      const data = request.body as z.infer<typeof certificationSchema>;

      const existing = await prisma.certification.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Certification not found' });
      }

      const certification = await prisma.certification.update({
        where: { id },
        data,
      });

      return certification;
    },
  );

  app.delete(
    '/api/profile/certifications/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const existing = await prisma.certification.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Certification not found' });
      }

      await prisma.certification.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // Project endpoints
  app.post(
    '/api/profile/projects',
    { schema: { body: projectSchema } },
    async (request, reply) => {
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const data = request.body as z.infer<typeof projectSchema>;
      const project = await prisma.project.create({
        data: {
          profileId: profile.id,
          ...data,
          skills: data.skills ?? [],
        },
      });

      return reply.status(201).send(project);
    },
  );

  app.put(
    '/api/profile/projects/:id',
    { schema: { params: cuidSchema, body: projectSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;
      const data = request.body as z.infer<typeof projectSchema>;

      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      const project = await prisma.project.update({
        where: { id },
        data: {
          ...data,
          skills: data.skills ?? existing.skills,
        },
      });

      return project;
    },
  );

  app.delete(
    '/api/profile/projects/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const existing = await prisma.project.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      await prisma.project.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // Work Experience endpoints
  app.post(
    '/api/profile/work-experiences',
    { schema: { body: workExperienceSchema } },
    async (request, reply) => {
      const profile = await prisma.profile.findFirst();
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const data = request.body as z.infer<typeof workExperienceSchema>;
      const workExperience = await prisma.workExperience.create({
        data: {
          profileId: profile.id,
          ...data,
          skills: data.skills ?? [],
        },
      });

      return reply.status(201).send(workExperience);
    },
  );

  app.put(
    '/api/profile/work-experiences/:id',
    { schema: { params: cuidSchema, body: workExperienceSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;
      const data = request.body as z.infer<typeof workExperienceSchema>;

      const existing = await prisma.workExperience.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Work experience not found' });
      }

      const workExperience = await prisma.workExperience.update({
        where: { id },
        data: {
          ...data,
          skills: data.skills ?? existing.skills,
        },
      });

      return workExperience;
    },
  );

  app.delete(
    '/api/profile/work-experiences/:id',
    { schema: { params: cuidSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof cuidSchema>;

      const existing = await prisma.workExperience.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'Work experience not found' });
      }

      await prisma.workExperience.delete({ where: { id } });
      return reply.status(204).send();
    },
  );
}
