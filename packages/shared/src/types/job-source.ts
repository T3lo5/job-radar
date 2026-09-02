export type RemoteMode = 'on_site' | 'hybrid' | 'remote' | 'unknown';

export interface NormalizedJob {
  title: string;
  company: string;
  description: string;
  location: string | null;
  remote: RemoteMode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  externalId: string;
  publishedAt: Date | null;
  tags: string[];
}

export interface SourceQuery {
  keywords: string[];
  location?: string | null;
  remoteOnly?: boolean;
  limit?: number;
}

export interface JobSource {
  id: string;
  name: string;
  description: string;
  fetch(query: SourceQuery): Promise<NormalizedJob[]>;
}

export interface SourceResult {
  sourceId: string;
  jobs: NormalizedJob[];
  fetchedAt: Date;
  error?: string;
}
