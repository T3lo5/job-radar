export type JobProcessingStatus =
  'raw' | 'extracting' | 'matching' | 'analyzing' | 'done' | 'failed';

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  url: string;
  source: string;
  publishedAt: string | null;
  collectedAt: string;
  status: JobProcessingStatus;
}
