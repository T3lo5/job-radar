import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import { createHash } from 'node:crypto'
import { prisma } from '../db/prisma.js'
import { collectFromAllSources, getAllSources } from '../sources/index.js'
import { settingsService } from '../services/settings-service.js'
import { sendDailyReport } from '../services/daily-report.js'
import { enqueueJobPipeline } from './processing.js'
import { detectSeniority } from '../utils/seniority.js'
import { createLocationFilter } from '../utils/location-filter.js'
import { createJobFilter } from '../utils/job-filter.js'
import {
  SETTINGS_SCOPE,
  CRON_SETTINGS,
  DEFAULT_CRON,
} from '../services/settings-keys.js'

const QUEUE_NAME = 'job-collection'
const JOB_NAME = 'collect-jobs'
const REPORT_NAME = 'send-daily-report'

function getConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
  }
}

function computeHash(job: { title: string; company: string; url: string }): string {
  const content = `${job.title}|${job.company}|${job.url}`
  return createHash('sha256').update(content).digest('hex')
}

export const jobCollectionQueue = new Queue(QUEUE_NAME, {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
})

export async function setupCronSchedule(): Promise<void> {
  const collectionCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.JOB_COLLECTION)) ?? DEFAULT_CRON.JOB_COLLECTION
  const reportCron =
    (await settingsService.get(SETTINGS_SCOPE.CRON, CRON_SETTINGS.DAILY_REPORT)) ?? DEFAULT_CRON.DAILY_REPORT

  await jobCollectionQueue.upsertJobScheduler(
    'job-collection-scheduler',
    { pattern: collectionCron },
    { name: JOB_NAME },
  )

  await jobCollectionQueue.upsertJobScheduler(
    'daily-report-scheduler',
    { pattern: reportCron },
    { name: REPORT_NAME },
  )
}

export async function runCollection(): Promise<{
  collected: number
  errors: string[]
}> {
  const sources = getAllSources()
  if (sources.length === 0) {
    return { collected: 0, errors: ['No job sources registered'] }
  }

  const settings = await settingsService.getAll(SETTINGS_SCOPE.SOURCES)
  const profile = await prisma.profile.findFirst()

  // Create location filter based on profile preference
  const locationFilter = createLocationFilter(profile?.location)
  const jobFilter = createJobFilter(profile)

  const keywords = Object.entries(settings)
    .filter(([key]) => key.startsWith('keyword.'))
    .map(([, value]) => value)

  let searchKeywords: string[]

  if (profile && profile.jobTypes && profile.jobTypes.length > 0) {
    const seniorityTerms = profile.seniorityList && profile.seniorityList.length > 0
      ? profile.seniorityList.map(s => s.toLowerCase())
      : ['junior', 'mid', 'pleno']
    searchKeywords = profile.jobTypes.flatMap(title =>
      seniorityTerms.map(seniority => `${title} ${seniority}`)
    )
  } else if (keywords.length > 0) {
    searchKeywords = keywords
  } else {
    searchKeywords = ['developer', 'engineer']
  }

  const results = await collectFromAllSources({
    keywords: searchKeywords,
    remoteOnly: profile?.remotePreference === 'REMOTE',
  })

  let collected = 0
  const errors: string[] = []
  const newJobIds: string[] = []

  for (const result of results) {
    if (result.error) {
      errors.push(`Source ${result.sourceId}: ${result.error}`)
      continue
    }

    // Ensure JobSource record exists
    let jobSource = await prisma.jobSource.findFirst({
      where: { name: result.sourceId },
    })
    if (!jobSource) {
      jobSource = await prisma.jobSource.create({
        data: {
          name: result.sourceId,
          type: 'api',
          baseUrl: null,
          enabled: true,
        },
      })
    }

    for (const job of result.jobs) {
      const hash = computeHash(job)
      const detectedSeniority = detectSeniority(job.title)

      // Filter by location based on profile preference
      if (!locationFilter.isAllowed(job.location, job.description)) {
        continue
      }

      // Filter by profile preferences (seniority, focus stacks, discard terms)
      const filterResult = jobFilter.filter({
        title: job.title,
        description: job.description,
        seniority: detectedSeniority,
      })
      if (!filterResult.allowed) {
        continue
      }

      const existing = await prisma.job.findUnique({ where: { hash } })
      if (existing) {
        await prisma.job.update({
          where: { id: existing.id },
          data: {
            sourceCount: { increment: 1 },
            collectedAt: new Date(),
          },
        })
        continue
      }

      try {
        const created = await prisma.job.create({
          data: {
            title: job.title,
            company: job.company,
            description: job.description,
            location: job.location,
            remote: job.remote.toUpperCase() as any,
            seniority: detectedSeniority as any,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryCurrency: job.salaryCurrency,
            url: job.url,
            sourceId: jobSource.id,
            externalId: job.externalId,
            publishedAt: job.publishedAt,
            hash,
            status: 'RAW',
            sourceCount: 1,
          },
        })
        newJobIds.push(created.id)
        collected++
      } catch (err) {
        errors.push(
          `Failed to insert job "${job.title}": ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  // Enqueue new jobs for processing
  if (newJobIds.length > 0) {
    await enqueueJobPipeline(newJobIds)
  }

  return { collected, errors }
}

export function createJobCollectionWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === REPORT_NAME) {
        await sendDailyReport()
        return
      }
      return runCollection()
    },
    {
      connection: getConnection(),
      concurrency: 1,
    },
  )

  worker.on('completed', (_job, result) => {
    if (result?.collected !== undefined) {
      console.log(`Job collection completed: ${result.collected} jobs collected`)
      if (result.errors?.length > 0) {
        console.warn(`Errors: ${result.errors.join('; ')}`)
      }
    }
  })

  worker.on('failed', (_job, err) => {
    console.error(`Job failed: ${err.message}`)
  })

  return worker
}
