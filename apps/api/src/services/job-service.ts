import type { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../db/prisma.js';
import { createHash } from 'node:crypto';
import { sanitizeHtml } from '../sources/normalizer.js';

export type JobStatus = 'RAW' | 'EXTRACTING' | 'MATCHING' | 'ANALYZING' | 'DONE' | 'FAILED';
export type RemoteType = 'ON_SITE' | 'HYBRID' | 'REMOTE' | 'ANY' | 'UNKNOWN';
export type Seniority = 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD' | 'UNKNOWN';

export interface JobsQuery {
  page: number;
  limit: number;
  sourceId?: string;
  status?: JobStatus;
  remote?: RemoteType;
  seniority?: Seniority;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
}

interface JobWithSourceName extends Prisma.JobGetPayload<{
  include: { source: { select: { name: true } } };
}> {
  sourceName?: string;
}

export interface ListJobsResult {
  data: Prisma.JobGetPayload<{
    include: { source: { select: { name: true } } };
  }>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MatchScoreResult {
  score: number;
  breakdown: Record<string, unknown>;
  matchedSkills: string[];
  partialSkills: string[];
  missingSkills: string[];
  recommendation: 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP';
}

export class JobService {
  async list(query: JobsQuery): Promise<ListJobsResult> {
    const { page, limit, sourceId, status, remote, seniority, search, fromDate, toDate } = query;

    // Build where conditions for regular filters
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (sourceId) {
      conditions.push(`"source_id" = $${paramIndex++}`);
      params.push(sourceId);
    }
    if (status) {
      // Parâmetros chegam como texto: sem cast explícito, o Postgres não acha
      // operador comparando text com a coluna enum.
      conditions.push(`"status" = $${paramIndex++}::"JobStatus"`);
      params.push(status);
    }
    if (remote) {
      conditions.push(`"remote" = $${paramIndex++}::"RemoteMode"`);
      params.push(remote);
    }
    if (seniority) {
      conditions.push(`"seniority" = $${paramIndex++}::"Seniority"`);
      params.push(seniority);
    }
    if (fromDate) {
      conditions.push(`"collected_at" >= $${paramIndex++}`);
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push(`"collected_at" <= $${paramIndex++}`);
      params.push(toDate);
    }

    // Full-text search using PostgreSQL tsvector
    if (search) {
      const searchQuery = search.trim();
      conditions.push(`"search_vector" @@ plainto_tsquery('portuguese', $${paramIndex++})`);
      params.push(searchQuery);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM "jobs" ${whereClause}`;
    // Colunas explícitas: `j.*` incluiria `search_vector` (tsvector), que o Prisma
    // não consegue desserializar. Os aliases devolvem os nomes camelCase que o
    // tipo `JobWithSourceName` e o frontend esperam.
    const dataQuery = `
      SELECT
        j."id", j."title", j."company", j."description", j."location", j."remote",
        j."seniority",
        j."salary_min" AS "salaryMin", j."salary_max" AS "salaryMax",
        j."salary_currency" AS "salaryCurrency",
        j."url", j."source_id" AS "sourceId", j."external_id" AS "externalId",
        j."published_at" AS "publishedAt", j."collected_at" AS "collectedAt",
        j."hash", j."status", j."raw_data" AS "rawData",
        j."created_by" AS "createdBy", j."created_at" AS "createdAt",
        j."updated_at" AS "updatedAt", j."source_count" AS "sourceCount",
        s."name" AS "sourceName"
      FROM "jobs" j
      LEFT JOIN "job_sources" s ON j."source_id" = s."id"
      ${whereClause}
      ORDER BY j."collected_at" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, (page - 1) * limit);

    const [countResult, jobs] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>(countQuery, ...params.slice(0, -2)),
      prisma.$queryRawUnsafe<JobWithSourceName[]>(dataQuery, ...params),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      data: jobs.map((job) => ({
        ...job,
        source: { name: job.sourceName ?? '' },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: {
        source: true,
        skills: { include: { skill: true } },
        matches: true,
        analyses: true,
        applications: true,
      },
    });
  }

  async create(data: {
    title: string;
    company: string;
    description: string;
    location?: string | null;
    remote?: 'ON_SITE' | 'HYBRID' | 'REMOTE' | 'ANY' | 'UNKNOWN';
    seniority?: 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD' | 'UNKNOWN' | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    url: string;
    externalId?: string | null;
    publishedAt?: Date | null;
  }) {
    let source = await prisma.jobSource.findFirst({
      where: { name: 'manual' },
    });

    if (!source) {
      source = await prisma.jobSource.create({
        data: {
          name: 'manual',
          type: 'manual',
          baseUrl: null,
          enabled: true,
        },
      });
    }

    const hashContent = `${data.title}|${data.company}|${data.url}`;
    const hash = createHash('sha256').update(hashContent).digest('hex');

    const existing = await prisma.job.findUnique({ where: { hash } });
    if (existing) {
      return prisma.job.update({
        where: { id: existing.id },
        data: {
          sourceCount: { increment: 1 },
          collectedAt: new Date(),
        },
        include: { source: true },
      });
    }

    return prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        description: sanitizeHtml(data.description),
        location: data.location,
        remote: data.remote ?? 'UNKNOWN',
        seniority: data.seniority,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency,
        url: data.url,
        sourceId: source.id,
        externalId: data.externalId,
        publishedAt: data.publishedAt,
        hash,
        status: 'DONE',
        sourceCount: 1,
      },
      include: { source: true },
    });
  }

  async getStats() {
    const [total, byStatus, bySource] = await Promise.all([
      prisma.job.count(),
      prisma.job.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.job.groupBy({
        by: ['sourceId'],
        _count: true,
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.sourceId, s._count])),
    };
  }

  async updateDescription(id: string, description: string) {
    return prisma.job.update({
      where: { id },
      data: { description: sanitizeHtml(description) },
    });
  }

  async getJobWithSkills(jobId: string) {
    return prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    });
  }

  async getProfileWithSkills() {
    return prisma.profile.findFirst({
      include: {
        skills: { include: { skill: true } },
        languages: true,
      },
    });
  }

  async upsertMatch(
    jobId: string,
    profileId: string,
    result: { score: number; breakdown: Record<string, unknown> },
  ) {
    await prisma.jobMatch.upsert({
      where: {
        jobId_profileId: { jobId, profileId },
      },
      update: {
        score: result.score,
        breakdown: result.breakdown as any,
        computedAt: new Date(),
      },
      create: {
        jobId,
        profileId,
        score: result.score,
        breakdown: result.breakdown as any,
      },
    });
  }

  async listMatches(profileId: string, limit = 50) {
    const matches = await prisma.jobMatch.findMany({
      where: { profileId },
      include: { job: true },
      orderBy: { score: 'desc' },
      take: limit,
    });

    return matches.map((m) => ({
      id: m.id,
      score: m.score,
      breakdown: m.breakdown,
      computedAt: m.computedAt,
      job: {
        id: m.job.id,
        title: m.job.title,
        company: m.job.company,
        location: m.job.location,
        remote: m.job.remote,
        url: m.job.url,
      },
    }));
  }
}

export const jobService = new JobService();
