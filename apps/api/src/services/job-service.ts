import type { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db/prisma.js'
import { createHash } from 'node:crypto'

export type JobStatus = 'RAW' | 'EXTRACTING' | 'MATCHING' | 'ANALYZING' | 'DONE' | 'FAILED'
export type RemoteType = 'ON_SITE' | 'HYBRID' | 'REMOTE' | 'ANY' | 'UNKNOWN'
export type Seniority = 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD' | 'UNKNOWN'

export interface JobsQuery {
  page: number
  limit: number
  sourceId?: string
  status?: JobStatus
  remote?: RemoteType
  seniority?: Seniority
  search?: string
  fromDate?: Date
  toDate?: Date
}

export interface ListJobsResult {
  data: (Prisma.JobGetPayload<{
    include: { source: { select: { name: true } } }
  }>)[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface MatchScoreResult {
  score: number
  breakdown: Record<string, unknown>
  matchedSkills: string[]
  partialSkills: string[]
  missingSkills: string[]
  recommendation: 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP'
}

export class JobService {
  async list(query: JobsQuery): Promise<ListJobsResult> {
    const { page, limit, sourceId, status, remote, seniority, search, fromDate, toDate } = query

    const where: Record<string, unknown> = {}
    if (sourceId) where.sourceId = sourceId
    if (status) where.status = status
    if (remote) where.remote = remote
    if (seniority) where.seniority = seniority
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (fromDate || toDate) {
      where.collectedAt = {}
      if (fromDate) (where.collectedAt as Record<string, Date>).gte = fromDate
      if (toDate) (where.collectedAt as Record<string, Date>).lte = toDate
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { source: { select: { name: true } } },
        orderBy: { collectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ])

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
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
    })
  }

  async create(data: {
    title: string
    company: string
    description: string
    location?: string | null
    remote?: 'ON_SITE' | 'HYBRID' | 'REMOTE' | 'ANY' | 'UNKNOWN'
    seniority?: 'INTERN' | 'JUNIOR' | 'MID' | 'SENIOR' | 'SPECIALIST' | 'LEAD' | 'UNKNOWN' | null
    salaryMin?: number | null
    salaryMax?: number | null
    salaryCurrency?: string | null
    url: string
    externalId?: string | null
    publishedAt?: Date | null
  }) {
    let source = await prisma.jobSource.findFirst({
      where: { name: 'manual' },
    })

    if (!source) {
      source = await prisma.jobSource.create({
        data: {
          name: 'manual',
          type: 'manual',
          baseUrl: null,
          enabled: true,
        },
      })
    }

    const hashContent = `${data.title}|${data.company}|${data.url}`
    const hash = createHash('sha256').update(hashContent).digest('hex')

    const existing = await prisma.job.findUnique({ where: { hash } })
    if (existing) {
      return prisma.job.update({
        where: { id: existing.id },
        data: {
          sourceCount: { increment: 1 },
          collectedAt: new Date(),
        },
        include: { source: true },
      })
    }

    return prisma.job.create({
      data: {
        title: data.title,
        company: data.company,
        description: data.description,
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
    })
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
    ])

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.sourceId, s._count])),
    }
  }

  async updateDescription(id: string, description: string) {
    return prisma.job.update({
      where: { id },
      data: { description },
    })
  }

  async getJobWithSkills(jobId: string) {
    return prisma.job.findUnique({
      where: { id: jobId },
      include: { skills: { include: { skill: true } } },
    })
  }

  async getProfileWithSkills() {
    return prisma.profile.findFirst({
      include: {
        skills: { include: { skill: true } },
        languages: true,
      },
    })
  }

  async getAllSkills() {
    return prisma.skill.findMany()
  }

  async upsertMatch(jobId: string, profileId: string, result: { score: number; breakdown: Record<string, unknown> }) {
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
    })
  }

  async listMatches(profileId: string, limit = 50) {
    const matches = await prisma.jobMatch.findMany({
      where: { profileId },
      include: { job: true },
      orderBy: { score: 'desc' },
      take: limit,
    })

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
    }))
  }
}

export const jobService = new JobService()
