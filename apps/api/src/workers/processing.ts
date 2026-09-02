import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import { PipelineOrchestrator } from '../services/pipeline/orchestrator.js'

const PROCESSING_QUEUE = 'job-processing'
const EXTRACTION_JOB = 'extract-job'
const MATCHING_JOB = 'match-job'
const ANALYSIS_JOB = 'analyze-job'

function getConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
  }
}

export const processingQueue = new Queue(PROCESSING_QUEUE, {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
})

export async function enqueueExtraction(jobId: string): Promise<void> {
  await processingQueue.add(EXTRACTION_JOB, { jobId })
}

export async function enqueueMatching(jobId: string): Promise<void> {
  await processingQueue.add(MATCHING_JOB, { jobId })
}

export async function enqueueAnalysis(jobId: string): Promise<void> {
  await processingQueue.add(ANALYSIS_JOB, { jobId })
}

export async function enqueueJobPipeline(jobIds: string[]): Promise<void> {
  for (const jobId of jobIds) {
    await processingQueue.add(EXTRACTION_JOB, { jobId })
  }
}

const orchestrator = new PipelineOrchestrator({
  enqueueJob: async (name: string, data: Record<string, unknown>) => {
    await processingQueue.add(name, data)
  },
})

export function createProcessingWorker(): Worker {
  const worker = new Worker(
    PROCESSING_QUEUE,
    async (job) => {
      const { jobId } = job.data as { jobId: string }

      const stepMap: Record<string, string> = {
        [EXTRACTION_JOB]: 'extract',
        [MATCHING_JOB]: 'match',
        [ANALYSIS_JOB]: 'analyze',
      }

      const step = stepMap[job.name]
      if (!step) {
        console.warn(`Unknown processing job type: ${job.name}`)
        return
      }

      await orchestrator.run(jobId, step)
    },
    { connection: getConnection(), concurrency: 2 },
  )

  worker.on('completed', (job) => {
    console.log(`Processing job ${job.name} completed for job ${job.data.jobId}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Processing job ${job?.name} failed: ${err.message}`)
  })

  return worker
}
