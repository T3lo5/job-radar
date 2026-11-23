import type {
  Application,
  ApplicationAttachment,
  ApplicationEvent,
  Job,
  JobAnalysis,
  JobMatch,
  JobSource,
  Prisma,
  ResumeVersion,
} from '../generated/prisma/index.js';
import { prisma } from '../db/prisma.js';
import { keywordGapAnalyzer, type KeywordGapReport } from './keyword-gap-analyzer.js';

export type ApplicationStatus =
  | 'FOUND'
  | 'INTERESTING'
  | 'CV_PREPARED'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'REJECTED'
  | 'OFFER'
  | 'ARCHIVED';

export interface ApplicationWithJob {
  id: string;
  jobId: string;
  profileId: string;
  status: ApplicationStatus;
  notes: string | null;
  salary: number | null;
  result: string | null;
  contacts: Record<string, unknown> | null;
  appliedAt: Date | null;
  followUpAt: Date | null;
  atsUsed: string | null;
  createdAt: Date;
  updatedAt: Date;
  job: {
    id: string;
    title: string | null;
    company: string | null;
    description: string | null;
    location: string | null;
    remote: string | null;
    url: string | null;
  };
}

export interface ListApplicationsResult {
  data: ApplicationWithJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateApplicationResult {
  applicationId: string;
  eventId: string;
}

export interface StatusTransitionResult {
  application: unknown;
  event: unknown;
}

/**
 * Candidatura com tudo que o kit mostra.
 *
 * O kit é uma leitura; nada aqui é cópia. Carta, CV e keywords continuam vindo
 * das suas fontes (gerador, `ResumeVersion`, análise de gap) e o anexo vem do
 * storage — o kit só reúne as referências por candidatura.
 */
export interface ApplicationKit {
  application: Application & {
    job: Job & { source: Pick<JobSource, 'id' | 'name'> | null };
    events: ApplicationEvent[];
    attachments: ApplicationAttachment[];
  };
  match: JobMatch | null;
  analysis: JobAnalysis | null;
  keywordGap: KeywordGapReport | null;
  cvVersions: Pick<
    ResumeVersion,
    'id' | 'resumeId' | 'jobId' | 'filename' | 'changesNote' | 'generatedAt'
  >[];
}

const CSV_COLUMNS = [
  'applicationId',
  'status',
  'jobTitle',
  'company',
  'jobUrl',
  'jobLocation',
  'jobRemote',
  'jobSeniority',
  'salaryMin',
  'salaryMax',
  'salaryCurrency',
  'appliedAt',
  'followUpAt',
  'atsUsed',
  'salaryOffered',
  'result',
  'notes',
  'contacts',
  'matchScore',
  'matchRecommendation',
  'keywordsMissing',
  'attachments',
  'events',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * CSV de uma linha com o kit inteiro.
 *
 * Histórico e anexos entram achatados em uma célula (`status@data`,
 * `tipo:nome`) porque CSV é tabular: o JSON ao lado é a exportação fiel, com
 * todos os eventos e metadados.
 */
export function kitToCsv(kit: ApplicationKit): string {
  const { application: app } = kit;
  const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
    applicationId: app.id,
    status: app.status,
    jobTitle: app.job.title,
    company: app.job.company,
    jobUrl: app.job.url,
    jobLocation: app.job.location,
    jobRemote: app.job.remote,
    jobSeniority: app.job.seniority,
    salaryMin: app.job.salaryMin,
    salaryMax: app.job.salaryMax,
    salaryCurrency: app.job.salaryCurrency,
    appliedAt: app.appliedAt?.toISOString(),
    followUpAt: app.followUpAt?.toISOString(),
    atsUsed: app.atsUsed,
    salaryOffered: app.salary,
    result: app.result,
    notes: app.notes,
    contacts: app.contacts,
    matchScore: kit.match?.score,
    matchRecommendation: kit.analysis?.recommendation,
    keywordsMissing: kit.keywordGap?.missing.join(' | '),
    attachments: app.attachments.map((a) => `${a.kind}:${a.originalName}`).join(' | '),
    events: app.events.map((e) => `${e.toStatus}@${e.createdAt.toISOString()}`).join(' | '),
  };

  const lines = [
    CSV_COLUMNS.map((column) => csvCell(column)).join(','),
    CSV_COLUMNS.map((column) => csvCell(row[column])).join(','),
  ];

  return `${lines.join('\r\n')}\r\n`;
}

export class ApplicationService {
  async list(
    profileId: string,
    query: {
      page: number;
      limit: number;
      status?: ApplicationStatus;
      jobId?: string;
    },
  ): Promise<ListApplicationsResult> {
    const { page, limit, status, jobId } = query;

    const where: Record<string, unknown> = { profileId };
    if (status) where.status = status;
    if (jobId) where.jobId = jobId;

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
    ]);

    return {
      data: applications as ApplicationWithJob[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, profileId: string) {
    return prisma.application.findFirst({
      where: { id, profileId },
      include: {
        job: true,
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /**
   * Kit da candidatura: candidatura + artefatos de outras fontes.
   *
   * O gap de keywords é derivado na hora (não fica gravado), então uma vaga
   * sem `JobSkill` ainda devolve um relatório vazio em vez de derrubar o kit.
   */
  async getKit(id: string, profileId: string, userId: string): Promise<ApplicationKit | null> {
    const application = await prisma.application.findFirst({
      where: { id, profileId },
      include: {
        job: { include: { source: { select: { id: true, name: true } } } },
        events: { orderBy: { createdAt: 'asc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!application) return null;

    const [match, analysis, cvVersions, keywordGap] = await Promise.all([
      prisma.jobMatch.findUnique({
        where: { jobId_profileId: { jobId: application.jobId, profileId } },
      }),
      prisma.jobAnalysis.findUnique({
        where: { jobId_profileId: { jobId: application.jobId, profileId } },
      }),
      prisma.resumeVersion.findMany({
        where: { jobId: application.jobId, resume: { userId } },
        select: {
          id: true,
          resumeId: true,
          jobId: true,
          filename: true,
          changesNote: true,
          generatedAt: true,
        },
        orderBy: { generatedAt: 'desc' },
      }),
      keywordGapAnalyzer.analyze(application.jobId, userId).catch(() => null),
    ]);

    return {
      application: application as ApplicationKit['application'],
      match,
      analysis,
      keywordGap,
      cvVersions,
    };
  }

  async create(
    profileId: string,
    input: {
      jobId: string;
      notes?: string;
    },
  ): Promise<CreateApplicationResult | { conflict: true; applicationId: string } | null> {
    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job) return null;

    const existing = await prisma.application.findUnique({
      where: { jobId_profileId: { jobId: input.jobId, profileId } },
    });

    if (existing) {
      return { conflict: true, applicationId: existing.id };
    }

    const application = await prisma.application.create({
      data: {
        jobId: input.jobId,
        profileId,
        status: 'INTERESTING',
        notes: input.notes,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: 'INTERESTING',
        note: 'Marked as interesting',
      },
    });

    return { applicationId: application.id, eventId: '' };
  }

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    profileId: string,
    note?: string,
  ): Promise<StatusTransitionResult | null> {
    const application = await prisma.application.findFirst({ where: { id, profileId } });
    if (!application) return null;

    const fromStatus = application.status;

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
    ]);

    return { application: updated, event };
  }

  async update(
    id: string,
    profileId: string,
    data: {
      notes?: string;
      salary?: number | null;
      result?: string;
      contacts?: Record<string, unknown>;
      followUpAt?: Date | null;
      atsUsed?: string | null;
    },
  ) {
    const application = await prisma.application.findFirst({ where: { id, profileId } });
    if (!application) return null;

    return prisma.application.update({
      where: { id },
      data: {
        notes: data.notes,
        salary: data.salary,
        result: data.result,
        contacts: data.contacts as Prisma.InputJsonValue,
        followUpAt: data.followUpAt,
        atsUsed: data.atsUsed,
      },
    });
  }

  async updateFollowUp(id: string, profileId: string, followUpAt: string | null) {
    const application = await prisma.application.findFirst({ where: { id, profileId } });
    if (!application) return null;

    return prisma.application.update({
      where: { id },
      data: {
        followUpAt: followUpAt ? new Date(followUpAt) : null,
      },
    });
  }

  async delete(id: string, profileId: string) {
    const application = await prisma.application.findFirst({ where: { id, profileId } });
    if (!application) return false;

    await prisma.application.delete({ where: { id } });
    return true;
  }
}

export const applicationService = new ApplicationService();
