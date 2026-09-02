import { prisma } from '../db/prisma.js'
import type { Prisma } from '../generated/prisma/index.js'

export async function logStatusTransition(
  jobId: string,
  toStatus: string,
  fromStatus?: string,
  message?: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.jobProcessingLog.create({
    data: {
      jobId,
      fromStatus,
      toStatus,
      message,
      metadata,
    },
  })
}

export async function updateJobStatus(
  jobId: string,
  newStatus: string,
  message?: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true },
  })

  if (!job) throw new Error(`Job ${jobId} not found`)

  await prisma.$transaction([
    prisma.job.update({
      where: { id: jobId },
      data: { status: newStatus as any },
    }),
    prisma.jobProcessingLog.create({
      data: {
        jobId,
        fromStatus: job.status,
        toStatus: newStatus,
        message,
        metadata,
      },
    }),
  ])
}

export async function getJobProcessingHistory(
  jobId: string,
): Promise<Array<{
  id: string
  fromStatus: string | null
  toStatus: string
  message: string | null
  createdAt: Date
}>> {
  return prisma.jobProcessingLog.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      message: true,
      createdAt: true,
    },
  })
}
