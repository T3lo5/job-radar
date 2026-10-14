import type { Seniority } from './seniority.js';
import type { ApplicationStatus } from './application.js';
import type { RemoteMode } from './job-source.js';

/**
 * Status de processamento da vaga: o enum `JobStatus` do Prisma.
 *
 * Eram minúsculos ('raw', 'done'), e a API devolve caixa alta. Ver o
 * comentário em `types/seniority.ts`.
 *
 * `job.test.ts` compara esta lista com o enum do schema.
 */
export const JOB_PROCESSING_STATUSES = [
  'RAW',
  'EXTRACTING',
  'MATCHING',
  'ANALYZING',
  'DONE',
  'FAILED',
] as const;

export type JobProcessingStatus = (typeof JOB_PROCESSING_STATUSES)[number];

export function isJobProcessingStatus(value: unknown): value is JobProcessingStatus {
  return (
    typeof value === 'string' && (JOB_PROCESSING_STATUSES as readonly string[]).includes(value)
  );
}

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string | null;
  /** `RemoteMode` do shared: minúscula. O enum do banco é caixa alta — a
   * conversão acontece na fronteira (ver `parseRemoteMode`). */
  remote: RemoteMode;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  url: string;
  source: string;
  publishedAt: string | null;
  collectedAt: string;
  status: JobProcessingStatus;
  seniority?: Seniority | null;
}

export interface JobApplication {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  notes: string | null;
}
