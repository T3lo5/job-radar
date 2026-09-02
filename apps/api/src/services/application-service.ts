import type { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../db/prisma.js'

export type ApplicationStatus =
  | 'FOUND'
  | 'INTERESTING'
  | 'CV_PREPARED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'OFFER'
  | 'ARCHIVED'

export interface ApplicationWithJob {
  id: string
  jobId: string
  profileId: string
  status: ApplicationStatus
  notes: string | null
  salary: number | null
  result: string | null
  contacts: Record<string, unknown> | null
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
  job: {
    id: string
    title: string | null
    company: string | null
    description: string | null
    location: string | null
    remote: string | null
    url: string | null
  }
}

export interface ListApplicationsResult {
  data: ApplicationWithJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateApplicationResult {
  applicationId: string
  eventId: string
}

export interface StatusTransitionResult {
  application: unknown
  event: unknown
}

export class ApplicationService {
  async list(query: {
    page: number
    limit: number
    status?: ApplicationStatus
    jobId?: string
  }): Promise<ListApplicationsResult> {
    const { page, limit, status, jobId } = query

    const profile = await prisma.profile.findFirst()
    if (!profile) {
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } }
    }

    const where: Record<string, unknown> = { profileId: profile.id }
    if (status) where.status = status
    if (jobId) where.jobId = jobId

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              company: true,
              description: true,
              location: true,
              remote: true,
              url: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.application.count({ where }),
    ])

    return {
      data: applications as ApplicationWithJob[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async getById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: {
        job: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    })
  }

  async create(input: {
    jobId: string
    notes?: string
  }): Promise<CreateApplicationResult | { conflict: true; applicationId: string } | null> {
    const profile = await prisma.profile.findFirst()
    if (!profile) return null

    const job = await prisma.job.findUnique({ where: { id: input.jobId } })
    if (!job) return null

    const existing = await prisma.application.findUnique({
      where: { jobId_profileId: { jobId: input.jobId, profileId: profile.id } },
    })

    if (existing) {
      return { conflict: true, applicationId: existing.id }
    }

    const application = await prisma.application.create({
      data: {
        jobId: input.jobId,
        profileId: profile.id,
        status: 'INTERESTING',
        notes: input.notes,
      },
    })

    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: 'INTERESTING',
        note: 'Marked as interesting',
      },
    })

    return { applicationId: application.id, eventId: '' }
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    note?: string,
  ): Promise<StatusTransitionResult | null> {
    const application = await prisma.application.findUnique({ where: { id } })
    if (!application) return null

    const fromStatus = application.status

    const [updated, event] = await prisma.$transaction([
      prisma.application.update({
        where: { id },
        data: {
          status: status as any,
          appliedAt: status === 'APPLIED' ? new Date() : application.appliedAt,
        },
      }),
      prisma.applicationEvent.create({
        data: {
          applicationId: id,
          fromStatus: fromStatus as any,
          toStatus: status as any,
          note,
        },
      }),
    ])

    return { application: updated, event }
  }

  async update(
    id: string,
    data: {
      notes?: string
      salary?: number | null
      result?: string
      contacts?: Record<string, unknown>
    },
  ) {
    const application = await prisma.application.findUnique({ where: { id } })
    if (!application) return null

    return prisma.application.update({
      where: { id },
      data: {
        notes: data.notes,
        salary: data.salary,
        result: data.result,
        contacts: data.contacts as Prisma.InputJsonValue,
      },
    })
  }

  async delete(id: string) {
    const application = await prisma.application.findUnique({ where: { id } })
    if (!application) return false

    await prisma.application.delete({ where: { id } })
    return true
  }
}

export const applicationService = new ApplicationService()
