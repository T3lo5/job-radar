import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const BASE_SKILLS = [
  // Languages
  { name: 'JavaScript', category: 'language', aliases: ['js', 'ecmascript'] },
  { name: 'TypeScript', category: 'language', aliases: ['ts'] },
  { name: 'Python', category: 'language', aliases: ['py'] },
  { name: 'Java', category: 'language', aliases: [] },
  { name: 'Go', category: 'language', aliases: ['golang'] },
  { name: 'Rust', category: 'language', aliases: [] },
  { name: 'PHP', category: 'language', aliases: [] },
  { name: 'Ruby', category: 'language', aliases: [] },
  { name: 'C#', category: 'language', aliases: ['csharp', 'c-sharp'] },
  { name: 'C++', category: 'language', aliases: ['cpp', 'cplusplus'] },
  { name: 'Kotlin', category: 'language', aliases: [] },
  { name: 'Swift', category: 'language', aliases: [] },
  { name: 'Scala', category: 'language', aliases: [] },
  { name: 'Elixir', category: 'language', aliases: [] },
  { name: 'Clojure', category: 'language', aliases: [] },
  { name: 'HTML', category: 'language', aliases: ['html5'] },
  { name: 'CSS', category: 'language', aliases: ['css3'] },
  { name: 'SQL', category: 'language', aliases: [] },

  // Frontend Frameworks
  { name: 'React', category: 'frontend', aliases: ['reactjs', 'react.js'] },
  { name: 'Next.js', category: 'frontend', aliases: ['nextjs', 'next'] },
  { name: 'Vue.js', category: 'frontend', aliases: ['vue', 'vuejs'] },
  { name: 'Angular', category: 'frontend', aliases: [] },
  { name: 'Svelte', category: 'frontend', aliases: [] },
  { name: 'Astro', category: 'frontend', aliases: [] },
  { name: 'Remix', category: 'frontend', aliases: [] },

  // Backend Frameworks
  { name: 'Node.js', category: 'backend', aliases: ['node', 'nodejs'] },
  { name: 'Express', category: 'backend', aliases: ['expressjs', 'express.js'] },
  { name: 'Fastify', category: 'backend', aliases: [] },
  { name: 'NestJS', category: 'backend', aliases: ['nest', 'nestjs'] },
  { name: 'Django', category: 'backend', aliases: [] },
  { name: 'Flask', category: 'backend', aliases: [] },
  { name: 'Spring Boot', category: 'backend', aliases: ['spring'] },
  { name: 'Rails', category: 'backend', aliases: ['ruby on rails'] },
  { name: 'Laravel', category: 'backend', aliases: [] },
  { name: 'Gin', category: 'backend', aliases: [] },
  { name: 'Echo', category: 'backend', aliases: [] },

  // Mobile
  { name: 'React Native', category: 'mobile', aliases: ['rn'] },
  { name: 'Flutter', category: 'mobile', aliases: [] },
  { name: 'SwiftUI', category: 'mobile', aliases: [] },
  { name: 'Kotlin Multiplatform', category: 'mobile', aliases: ['kmp'] },

  // CSS / Styling
  { name: 'Tailwind CSS', category: 'css', aliases: ['tailwind'] },
  { name: 'Styled Components', category: 'css', aliases: ['styled-components'] },
  { name: 'Sass', category: 'css', aliases: ['scss'] },
  { name: 'CSS Modules', category: 'css', aliases: [] },

  // State Management
  { name: 'Redux', category: 'state', aliases: ['reduxjs'] },
  { name: 'Zustand', category: 'state', aliases: [] },
  { name: 'Jotai', category: 'state', aliases: [] },
  { name: 'MobX', category: 'state', aliases: [] },
  { name: 'Recoil', category: 'state', aliases: [] },

  // Testing
  { name: 'Jest', category: 'testing', aliases: [] },
  { name: 'Vitest', category: 'testing', aliases: [] },
  { name: 'Testing Library', category: 'testing', aliases: ['rtl'] },
  { name: 'Cypress', category: 'testing', aliases: [] },
  { name: 'Playwright', category: 'testing', aliases: [] },
  { name: 'Storybook', category: 'testing', aliases: [] },

  // Databases
  { name: 'PostgreSQL', category: 'database', aliases: ['postgres'] },
  { name: 'MySQL', category: 'database', aliases: [] },
  { name: 'MongoDB', category: 'database', aliases: ['mongo'] },
  { name: 'Redis', category: 'database', aliases: [] },
  { name: 'SQLite', category: 'database', aliases: [] },
  { name: 'Prisma', category: 'database', aliases: [] },
  { name: 'Drizzle', category: 'database', aliases: [] },

  // Cloud / DevOps
  { name: 'AWS', category: 'cloud', aliases: ['amazon web services'] },
  { name: 'Google Cloud', category: 'cloud', aliases: ['gcp', 'google cloud platform'] },
  { name: 'Azure', category: 'cloud', aliases: ['microsoft azure'] },
  { name: 'Docker', category: 'devops', aliases: ['dockerfile', 'docker-compose'] },
  { name: 'Kubernetes', category: 'devops', aliases: ['k8s'] },
  { name: 'Terraform', category: 'devops', aliases: ['iac'] },
  { name: 'GitHub Actions', category: 'devops', aliases: ['gh actions', 'ci/cd'] },
  { name: 'CircleCI', category: 'devops', aliases: [] },
  { name: 'Jenkins', category: 'devops', aliases: [] },

  // APIs
  { name: 'GraphQL', category: 'api', aliases: [] },
  { name: 'REST', category: 'api', aliases: ['restful'] },
  { name: 'tRPC', category: 'api', aliases: [] },
  { name: 'gRPC', category: 'api', aliases: [] },
  { name: 'WebSocket', category: 'api', aliases: ['websockets'] },

  // Auth
  { name: 'OAuth 2.0', category: 'auth', aliases: ['oauth2', 'oauth'] },
  { name: 'JWT', category: 'auth', aliases: ['json web token'] },
  { name: 'NextAuth.js', category: 'auth', aliases: ['next-auth', 'authjs'] },

  // Tools
  { name: 'Git', category: 'tools', aliases: [] },
  { name: 'GitHub', category: 'tools', aliases: [] },
  { name: 'GitLab', category: 'tools', aliases: [] },
  { name: 'Figma', category: 'tools', aliases: [] },
  { name: 'Notion', category: 'tools', aliases: [] },
  { name: 'Jira', category: 'tools', aliases: [] },

  // Concepts
  { name: 'Agile', category: 'concepts', aliases: ['scrum', 'kanban'] },
  {
    name: 'CI/CD',
    category: 'concepts',
    aliases: ['continuous integration', 'continuous deployment'],
  },
  { name: 'TDD', category: 'concepts', aliases: ['test-driven development'] },
  { name: 'DDD', category: 'concepts', aliases: ['domain-driven design'] },
  { name: 'Microservices', category: 'concepts', aliases: [] },
  { name: 'Monorepo', category: 'concepts', aliases: [] },
  { name: 'Clean Architecture', category: 'concepts', aliases: [] },
  { name: 'SOLID', category: 'concepts', aliases: [] },
  { name: 'Design Patterns', category: 'concepts', aliases: [] },
  { name: 'System Design', category: 'concepts', aliases: [] },
];

async function main() {
  console.log('Seeding database...');

  // Seed skills
  console.log(`Seeding ${BASE_SKILLS.length} skills...`);
  for (const skill of BASE_SKILLS) {
    await prisma.skill.upsert({
      where: { name: skill.name },
      update: { aliases: skill.aliases, category: skill.category },
      create: skill,
    });
  }

  // Seed demo user + profile
  console.log('Seeding demo user and profile...');
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@jobradar.local' },
  });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        email: 'demo@jobradar.local',
        name: 'Demo User',
        profile: {
          create: {
            title: 'Desenvolvedor Full Stack',
            seniority: 'SENIOR',
            location: 'São Paulo, Brasil',
            remotePreference: 'REMOTE',
            salaryMin: 15000,
            salaryMax: 25000,
            salaryCurrency: 'BRL',
            summary:
              'Desenvolvedor full stack com 8+ anos de experiência em aplicações web modernas.',
            languages: {
              create: [
                { language: 'Portuguese', level: 'NATIVE' },
                { language: 'English', level: 'ADVANCED' },
              ],
            },
            skills: {
              create: [
                { skill: { connect: { name: 'TypeScript' } }, level: 'EXPERT', yearsExp: 7 },
                { skill: { connect: { name: 'Node.js' } }, level: 'EXPERT', yearsExp: 8 },
                { skill: { connect: { name: 'React' } }, level: 'EXPERT', yearsExp: 6 },
                { skill: { connect: { name: 'Next.js' } }, level: 'ADVANCED', yearsExp: 4 },
                { skill: { connect: { name: 'PostgreSQL' } }, level: 'ADVANCED', yearsExp: 5 },
                { skill: { connect: { name: 'Docker' } }, level: 'ADVANCED', yearsExp: 4 },
                { skill: { connect: { name: 'AWS' } }, level: 'INTERMEDIATE', yearsExp: 3 },
                { skill: { connect: { name: 'Tailwind CSS' } }, level: 'ADVANCED', yearsExp: 3 },
              ],
            },
            education: {
              create: {
                institution: 'Universidade de São Paulo',
                degree: 'Bacharelado',
                field: 'Ciência da Computação',
                startDate: new Date('2012-01-01'),
                endDate: new Date('2016-06-30'),
              },
            },
            certifications: {
              create: {
                name: 'AWS Certified Solutions Architect',
                issuer: 'Amazon Web Services',
                issuedAt: new Date('2023-06-01'),
                expiresAt: new Date('2026-06-01'),
              },
            },
            projects: {
              create: [
                {
                  name: 'E-commerce Platform',
                  description: 'Plataforma de e-commerce com React, Node.js e PostgreSQL',
                  skills: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
                },
              ],
            },
          },
        },
      },
      include: { profile: true },
    });
    console.log(`Created demo user: ${user.email}`);
  } else {
    console.log('Demo user already exists, skipping.');
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
