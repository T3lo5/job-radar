import type { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../db/prisma.js';
import { createHash } from 'node:crypto';
import { sanitizeHtml } from '../sources/normalizer.js';
import { calculateConfidence } from './job-confidence.js';

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
  /** Ordenação aplicada no servidor, antes da paginação. */
  sort?: 'date' | 'match' | 'title' | 'salary';
  /** Só vagas com match >= este valor para o perfil. */
  minScore?: number;
  /** Vagas com salário máximo >= este valor (filtro "a partir de"). */
  minSalary?: number;
  /** Vagas com salário mínimo <= este valor (filtro "até"). */
  maxSalary?: number;
  /** Só vagas com índice de confiança >= este valor. */
  minConfidence?: number;
  /** Só vagas que exigem esta skill (busca por nome, case-insensitive). */
  skill?: string;
  /**
   * Filtro de descarte. `active` (default) = só não descartadas;
   * `discarded` = só descartadas; `all` = todas.
   */
  discarded?: 'active' | 'discarded' | 'all';
  /** Perfil da sessão; sem ele, `sort=match`/`minScore` não têm efeito. */
  profileId?: string;
}

interface JobWithSourceName extends Prisma.JobGetPayload<{
  include: { source: { select: { name: true } } };
}> {
  sourceName?: string;
}

interface JobWithConfidence extends JobWithSourceName {
  confidence: number;
  /** Score de match desta vaga para o perfil da sessão (null = não avaliada). */
  matchScore?: number | null;
  confidenceLabel: 'baixa' | 'media' | 'alta';
  confidenceBadges: Array<{
    type: string;
    label: string;
    description: string;
  }>;
}

export interface ListJobsResult {
  data: JobWithConfidence[];
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
    const {
      page,
      limit,
      sourceId,
      status,
      remote,
      seniority,
      search,
      fromDate,
      toDate,
      sort = 'date',
      minScore,
      minSalary,
      maxSalary,
      minConfidence,
      discarded = 'active',
      profileId,
      skill,
    } = query;

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
    if (discarded === 'active') {
      conditions.push(`j."discarded_at" IS NULL`);
    } else if (discarded === 'discarded') {
      conditions.push(`j."discarded_at" IS NOT NULL`);
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

    // Filtro por faixa salarial: minSalary e/ou maxSalary. Vagas sem salário
    // nunca passam (não há como comparar), o que é intencional — "não informado"
    // é tratado no frontend como categoria à parte, não como filtro.
    if (minSalary !== undefined) {
      conditions.push(`"salary_max" >= $${paramIndex++}`);
      params.push(minSalary);
    }
    if (maxSalary !== undefined) {
      conditions.push(`"salary_min" <= $${paramIndex++}`);
      params.push(maxSalary);
    }

    // Full-text search using PostgreSQL tsvector
    if (search) {
      const searchQuery = search.trim();
      conditions.push(`"search_vector" @@ plainto_tsquery('portuguese', $${paramIndex++})`);
      params.push(searchQuery);
    }

    // Filtro por skill: vagas que exigem esta skill (busca por nome,
    // case-insensitive). EXISTS evita duplicar linhas quando a vaga tem
    // múltiplas skills.
    if (skill) {
      conditions.push(
        `EXISTS (SELECT 1 FROM "job_skills" js JOIN "skills" s ON s."id" = js."skill_id"
          WHERE js."job_id" = j."id" AND s."name" ILIKE $${paramIndex++})`,
      );
      params.push(`%${skill}%`);
    }

    // Join com o match do perfil da sessão só quando a ordenação pede. É
    // filtrado por profileId, então nunca duplica linha (jobId+profileId é
    // único) nem mistura score de outra conta.
    let matchJoin = '';
    if (sort === 'match' && profileId) {
      matchJoin = `LEFT JOIN "job_matches" m ON m."job_id" = j."id" AND m."profile_id" = $${paramIndex++}`;
      params.push(profileId);
    }

    // `minScore` é filtro de servidor: aplicado antes de paginar, ao contrário
    // do que a UI fazia (filtrar só a página carregada).
    if (profileId && minScore !== undefined && minScore > 0) {
      conditions.push(
        `EXISTS (SELECT 1 FROM "job_matches" fm WHERE fm."job_id" = j."id" AND fm."profile_id" = $${paramIndex++} AND fm."score" >= $${paramIndex++})`,
      );
      params.push(profileId, minScore);
    }

    const whereClauseFinal = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderBy =
      sort === 'match' && profileId
        ? `m."score" DESC NULLS LAST, j."collected_at" DESC`
        : sort === 'salary'
          ? `j."salary_max" DESC NULLS LAST, j."collected_at" DESC`
          : sort === 'title'
            ? `j."title" ASC`
            : `j."collected_at" DESC`;

    // Quando há filtro de confiança, não dá para aplicar no SQL (a confiança é
    // calculada no JS a partir de múltiplos campos). Buscamos um lote generoso,
    // calculamos a confiança de cada vaga, filtramos e paginamos no JS.
    const needsConfidenceFilter = minConfidence !== undefined;
    const fetchLimit = needsConfidenceFilter ? 1000 : limit;
    const fetchOffset = needsConfidenceFilter ? 0 : (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM "jobs" j ${whereClauseFinal}`;
    const dataQuery = `
      SELECT
        j."id", j."title", j."company", j."description", j."location", j."remote",
        j."seniority",
        j."salary_min" AS "salaryMin", j."salary_max" AS "salaryMax",
        j."salary_currency" AS "salaryCurrency",
        j."url", j."source_id" AS "sourceId", j."external_id" AS "externalId",
        j."published_at" AS "publishedAt", j."collected_at" AS "collectedAt",
        j."discarded_at" AS "discardedAt",
        j."hash", j."status", j."raw_data" AS "rawData",
        j."created_by" AS "createdBy", j."created_at" AS "createdAt",
        j."updated_at" AS "updatedAt", j."source_count" AS "sourceCount",
        s."name" AS "sourceName"
      FROM "jobs" j
      LEFT JOIN "job_sources" s ON j."source_id" = s."id"
      ${matchJoin}
      ${whereClauseFinal}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(fetchLimit, fetchOffset);

    const [countResult, rawJobs] = await Promise.all([
      prisma.$queryRawUnsafe<[{ count: bigint }]>(countQuery, ...params.slice(0, -2)),
      prisma.$queryRawUnsafe<JobWithSourceName[]>(dataQuery, ...params),
    ]);

    const totalBeforeConfidence = Number(countResult[0]?.count ?? 0);

    // Score de match por vaga desta página, para o perfil da sessão. Antes o
    // card só mostrava nota se a vaga estivesse no top 50 de `/match/results`;
    // vaga avaliada fora do top 50 parecia "não avaliada". Buscamos só as notas
    // das vagas da página (uma query), independente de ordenação/filtro.
    let matchScoreByJob = new Map<string, number>();
    if (profileId && rawJobs.length > 0) {
      const matches = await prisma.jobMatch.findMany({
        where: { profileId, jobId: { in: rawJobs.map((j) => j.id) } },
        select: { jobId: true, score: true },
      });
      matchScoreByJob = new Map(matches.map((m) => [m.jobId, m.score]));
    }

    // Calcula confiança para cada vaga do lote.
    const jobsWithConfidence = rawJobs.map((job) => {
      const conf = calculateConfidence({
        collectedAt: job.collectedAt,
        sourceCount: job.sourceCount,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        description: job.description,
        url: job.url,
        title: job.title,
        company: job.company,
      });
      return {
        ...job,
        confidence: conf.score,
        confidenceLabel: conf.label,
        confidenceBadges: conf.badges,
      };
    });

    // Aplica filtro de confiança se necessário.
    let filtered = jobsWithConfidence;
    if (needsConfidenceFilter) {
      filtered = jobsWithConfidence.filter((j) => j.confidence >= minConfidence!);
    }

    // Paginação manual quando há filtro de confiança.
    let total = totalBeforeConfidence;
    let paginated = filtered;
    if (needsConfidenceFilter) {
      total = filtered.length;
      const start = (page - 1) * limit;
      paginated = filtered.slice(start, start + limit);
    }

    return {
      data: paginated.map((job) => ({
        ...job,
        source: { name: job.sourceName ?? '' },
        matchScore: matchScoreByJob.get(job.id) ?? null,
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
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        source: true,
        skills: { include: { skill: true } },
        matches: true,
        analyses: true,
        applications: true,
      },
    });
    if (!job) return null;

    const conf = calculateConfidence({
      collectedAt: job.collectedAt,
      sourceCount: job.sourceCount,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      description: job.description,
      url: job.url,
      title: job.title,
      company: job.company,
    });

    return {
      ...job,
      confidence: conf.score,
      confidenceLabel: conf.label,
      confidenceBadges: conf.badges,
    };
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

  /** Descarta a vaga (some da lista geral; vai para "Descartes"). */
  async discard(id: string) {
    return prisma.job.update({
      where: { id },
      data: { discardedAt: new Date() },
    });
  }

  /** Restaura uma vaga descartada (volta para a lista geral). */
  async restore(id: string) {
    return prisma.job.update({
      where: { id },
      data: { discardedAt: null },
    });
  }

  async getJobWithSkills(jobId: string) {
    return prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    });
  }

  async getManyWithSkills(jobIds: string[]) {
    if (jobIds.length === 0) return [];
    return prisma.job.findMany({
      where: { id: { in: jobIds } },
      include: { skills: { include: { skill: true } } },
    });
  }

  async getProfileWithSkills(userId: string) {
    return prisma.profile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        languages: true,
      },
    });
  }

  async upsertMatch(
    jobId: string,
    profileId: string,
    result: { score: number; breakdown: unknown },
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

  /**
   * Matches do perfil, do maior score para o menor.
   *
   * `total` existe porque a lista é limitada: sem ele a UI não distingue "só
   * existem 50 matches" de "há mais e esta é a primeira página".
   */
  async listMatches(profileId: string, limit = 50) {
    const where = { profileId };
    const [matches, total] = await Promise.all([
      prisma.jobMatch.findMany({
        where,
        include: { job: true },
        orderBy: { score: 'desc' },
        take: limit,
      }),
      prisma.jobMatch.count({ where }),
    ]);

    return {
      data: matches.map((m) => ({
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
      })),
      total,
    };
  }

  /**
   * Match de UMA vaga para o perfil. Não passa pela lista paginada.
   *
   * É a correção do ticket 18: o detalhe da vaga procurava o match no top 50 e,
   * para a 51ª em diante, dizia "ainda não avaliada" mesmo tendo score.
   */
  async getMatchForJob(jobId: string, profileId: string) {
    const match = await prisma.jobMatch.findUnique({
      where: { jobId_profileId: { jobId, profileId } },
    });

    if (!match) return null;

    return {
      id: match.id,
      score: match.score,
      breakdown: match.breakdown,
      computedAt: match.computedAt,
    };
  }

  /** Contagem real de vagas avaliadas + distribuição, sem limite de lista. */
  async getMatchStats(profileId: string) {
    const where = { profileId };
    const [scores, aggregate] = await Promise.all([
      prisma.jobMatch.groupBy({
        by: ['score'],
        where,
        _count: { _all: true },
      }),
      prisma.jobMatch.aggregate({
        where,
        _count: { _all: true },
        _avg: { score: true },
      }),
    ]);

    const faixas = [
      { range: '90+', min: 90, max: 101 },
      { range: '80-89', min: 80, max: 90 },
      { range: '70-79', min: 70, max: 80 },
      { range: '60-69', min: 60, max: 70 },
      { range: '50-59', min: 50, max: 60 },
      { range: '<50', min: -1, max: 50 },
    ];

    return {
      total: aggregate._count._all,
      averageScore:
        aggregate._avg.score === null ? 0 : Math.round(aggregate._avg.score * 100) / 100,
      distribution: faixas.map(({ range, min, max }) => ({
        range,
        count: scores
          .filter((s) => s.score >= min && s.score < max)
          .reduce((sum, s) => sum + s._count._all, 0),
      })),
    };
  }
}

export const jobService = new JobService();
