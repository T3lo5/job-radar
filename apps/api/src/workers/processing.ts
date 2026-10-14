import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { PipelineOrchestrator } from '../services/pipeline/orchestrator.js';
import { redisConnectionOptions, WORKER_LOCK_OPTIONS } from '../db/redis-connection.js';

const PROCESSING_QUEUE = 'job-processing';
const EXTRACTION_JOB = 'extract-job';
const MATCHING_JOB = 'match-job';
const ANALYSIS_JOB = 'analyze-job';

function getConnection(): ConnectionOptions {
  return redisConnectionOptions() as ConnectionOptions;
}

export const processingQueue = new Queue(PROCESSING_QUEUE, {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 10,
    removeOnFail: 50,
  },
});

/**
 * jobId determinístico por (step, vaga).
 *
 * Sem isto, reenfileirar a mesma vaga criava jobs distintos a cada chamada:
 * recoletar + "processar todas" rodava a IA de novo e de novo pelo mesmo job,
 * e o retry do BullMQ não reaproveitava nada. Com o id fixo, o BullMQ
 * deduplica enquanto o job estiver na fila.
 *
 * O separador é `-`, e não `:`. O BullMQ usa `:` como delimitador nas chaves
 * do Redis e rejeita ID customizado que o contenha — `addBulk` com
 * `extract-job:<id>` estourava "Custom Id cannot contain :" e o
 * POST /api/admin/process-all respondia 500.
 */
const pipelineJobId = (name: string, jobId: string) => `${name}-${jobId}`;

/** Exportado para teste: o formato do ID é contrato com o BullMQ. */
export const __testPipelineJobId = pipelineJobId;

export async function enqueueExtraction(jobId: string): Promise<void> {
  await processingQueue.add(
    EXTRACTION_JOB,
    { jobId },
    { jobId: pipelineJobId(EXTRACTION_JOB, jobId) },
  );
}

export async function enqueueMatching(jobId: string): Promise<void> {
  await processingQueue.add(MATCHING_JOB, { jobId }, { jobId: pipelineJobId(MATCHING_JOB, jobId) });
}

export async function enqueueAnalysis(jobId: string): Promise<void> {
  await processingQueue.add(ANALYSIS_JOB, { jobId }, { jobId: pipelineJobId(ANALYSIS_JOB, jobId) });
}

export async function enqueueJobPipeline(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  // addBulk faz N inserts num comando só; o add em loop fazia um round-trip do
  // Redis por vaga.
  await processingQueue.addBulk(
    jobIds.map((jobId) => ({
      name: EXTRACTION_JOB,
      data: { jobId },
      opts: { jobId: pipelineJobId(EXTRACTION_JOB, jobId) },
    })),
  );
}

const orchestrator = new PipelineOrchestrator({
  enqueueJob: async (name: string, data: Record<string, unknown>) => {
    await processingQueue.add(name, data);
  },
});

export function createProcessingWorker(): Worker {
  const worker = new Worker(
    PROCESSING_QUEUE,
    async (job) => {
      const { jobId } = job.data as { jobId: string };

      const stepMap: Record<string, string> = {
        [EXTRACTION_JOB]: 'extract',
        [MATCHING_JOB]: 'match',
        [ANALYSIS_JOB]: 'analyze',
      };

      const step = stepMap[job.name];
      if (!step) {
        console.warn(`Unknown processing job type: ${job.name}`);
        return;
      }

      await orchestrator.run(jobId, step);
    },
    { connection: getConnection(), concurrency: 2, ...WORKER_LOCK_OPTIONS },
  );

  worker.on('completed', (job) => {
    console.log(`Processing job ${job.name} completed for job ${job.data.jobId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Processing job ${job?.name} failed: ${err.message}`);
  });

  return worker;
}
