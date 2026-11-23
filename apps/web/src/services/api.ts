import axios from 'axios';
import type { MatchBreakdown } from '@job-radar/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
  // Necessário para o cookie de sessão (HttpOnly) trafegar. Sem isso o login
  // "funciona" mas nenhuma request seguinte carrega a sessão.
  withCredentials: true,
});

// Sessão expirada ou inválida: manda para o login em vez de deixar a tela
// quebrada com erro genérico.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isAuthRoute = error.config?.url?.startsWith('/api/auth/');
    const onLoginPage = window.location.pathname === '/login';

    if ((status === 401 || status === 423) && !isAuthRoute && !onLoginPage) {
      const needsSetup = error.response?.data?.error === 'setup_required';
      window.location.href = needsSetup ? '/setup' : '/login';
    }
    return Promise.reject(error);
  },
);

export interface Profile {
  id: string;
  userId: string;
  title: string | null;
  seniority: string | null;
  seniorityList: string[];
  location: string | null;
  remotePreference: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  summary: string | null;
  jobTypes: string[];
  focusStacks: string[];
  discardTerms: string[];
  createdAt: string;
  updatedAt: string;
  skills: ProfileSkill[];
  education: Education[];
  certifications: Certification[];
  projects: Project[];
  workExperiences: WorkExperience[];
  languages: ProfileLanguage[];
}

export interface ProfileSkill {
  id: string;
  profileId: string;
  skillId: string;
  level: string;
  yearsExp: number | null;
  skill: {
    id: string;
    name: string;
    category: string | null;
  };
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface Certification {
  id: string;
  profileId: string;
  name: string;
  issuer: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  credentialId: string | null;
  url: string | null;
}

export interface Project {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  url: string | null;
  skills: string[];
}

export interface WorkExperience {
  id: string;
  profileId: string;
  company: string;
  role: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
  skills: string[];
}

export interface ProfileLanguage {
  id: string;
  language: string;
  level: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string | null;
  remote: string;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  sourceId: string;
  externalId: string | null;
  publishedAt: string | null;
  collectedAt: string;
  discardedAt: string | null;
  /** Score de match desta vaga para o perfil (null = não avaliada). */
  matchScore: number | null;
  hash: string;
  status: string;
  confidence: number;
  confidenceLabel: 'baixa' | 'media' | 'alta';
  confidenceBadges: Array<{
    type: string;
    label: string;
    description: string;
  }>;
}

export interface SetupStatus {
  completed: boolean;
  completedAt: string | null;
}

export interface SettingsByScope {
  scope: string;
  settings: Record<string, string>;
  /** Presente no escopo `cron`: próxima execução real de cada agendamento. */
  nextRuns?: {
    jobCollectionCron: string | null;
    dailyReportCron: string | null;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthStatus {
  setupComplete: boolean;
  accountExists: boolean;
  needsSetup: boolean;
  /** Cadastro público aberto (`ALLOW_SIGNUP=true` ou bootstrap sem conta). */
  allowSignup: boolean;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
}

export const authApi = {
  status: () => api.get<AuthStatus>('/api/auth/status').then((r) => r.data),

  setup: (data: { email: string; password: string; confirmPassword: string }) =>
    api.post<{ ok: boolean; user: AuthUser }>('/api/auth/setup', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<{ ok: boolean; user: AuthUser }>('/api/auth/login', data).then((r) => r.data),

  signup: (data: { email: string; password: string; confirmPassword: string }) =>
    api.post<{ ok: boolean; user: AuthUser }>('/api/auth/signup', data).then((r) => r.data),

  logout: () => api.post('/api/auth/logout').then((r) => r.data),

  me: () => api.get<{ user: AuthUser; expiresAt: string }>('/api/auth/me').then((r) => r.data),

  sessions: () => api.get<{ sessions: SessionInfo[] }>('/api/auth/sessions').then((r) => r.data),

  revokeSession: (id: string) => api.delete(`/api/auth/sessions/${id}`).then((r) => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post<{ ok: boolean }>('/api/auth/password', data).then((r) => r.data),

  // --- Export / delete completa (ticket 34) --------------------------------
  exportMe: () => api.get(`/api/auth/export/me`).then((r) => r.data),
  deleteMe: () => api.delete(`/api/auth/me`).then((r) => r.data),
};

export const profileApi = {
  get: () => api.get<Profile>('/api/profile').then((r) => r.data),
  update: (data: Partial<Profile>) => api.put<Profile>('/api/profile', data).then((r) => r.data),
  addSkill: (skillName: string, level: string, yearsExp?: number) =>
    api
      .post<ProfileSkill>('/api/profile/skills', { skillName, level, yearsExp })
      .then((r) => r.data),
  removeSkill: (id: string) => api.delete(`/api/profile/skills/${id}`).then((r) => r.data),
  updatePreferences: (data: Partial<Profile>) =>
    api.put<Profile>('/api/profile/preferences', data).then((r) => r.data),
  // Education
  addEducation: (data: {
    degree: string;
    field: string;
    institution: string;
    startDate?: string | null;
    endDate?: string | null;
  }) => api.post<Education>('/api/profile/education', data).then((r) => r.data),
  updateEducation: (
    id: string,
    data: {
      degree: string;
      field: string;
      institution: string;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) => api.put<Education>(`/api/profile/education/${id}`, data).then((r) => r.data),
  removeEducation: (id: string) => api.delete(`/api/profile/education/${id}`).then((r) => r.data),
  // Languages
  addLanguage: (data: { language: string; level: string }) =>
    api.post<ProfileLanguage>('/api/profile/languages', data).then((r) => r.data),
  updateLanguage: (id: string, data: { language: string; level: string }) =>
    api.put<ProfileLanguage>(`/api/profile/languages/${id}`, data).then((r) => r.data),
  removeLanguage: (id: string) => api.delete(`/api/profile/languages/${id}`).then((r) => r.data),
  // Certifications
  addCertification: (data: {
    name: string;
    issuer?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    credentialId?: string | null;
    url?: string | null;
  }) => api.post<Certification>('/api/profile/certifications', data).then((r) => r.data),
  updateCertification: (
    id: string,
    data: {
      name: string;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      credentialId?: string | null;
      url?: string | null;
    },
  ) => api.put<Certification>(`/api/profile/certifications/${id}`, data).then((r) => r.data),
  removeCertification: (id: string) =>
    api.delete<Certification>(`/api/profile/certifications/${id}`).then((r) => r.data),
  // Projects
  addProject: (data: {
    name: string;
    description?: string | null;
    url?: string | null;
    skills?: string[];
  }) => api.post<Project>('/api/profile/projects', data).then((r) => r.data),
  updateProject: (
    id: string,
    data: { name: string; description?: string | null; url?: string | null; skills?: string[] },
  ) => api.put<Project>(`/api/profile/projects/${id}`, data).then((r) => r.data),
  removeProject: (id: string) => api.delete(`/api/profile/projects/${id}`).then((r) => r.data),
  // Work Experiences
  addWorkExperience: (data: {
    company: string;
    role: string;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    current?: boolean;
    skills?: string[];
  }) => api.post<WorkExperience>('/api/profile/work-experiences', data).then((r) => r.data),
  updateWorkExperience: (
    id: string,
    data: {
      company: string;
      role: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      current?: boolean;
      skills?: string[];
    },
  ) => api.put<WorkExperience>(`/api/profile/work-experiences/${id}`, data).then((r) => r.data),
  removeWorkExperience: (id: string) =>
    api.delete(`/api/profile/work-experiences/${id}`).then((r) => r.data),
  // Resumes
  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<{
        id: string;
        filename: string;
        mimeType: string;
        isDefault?: boolean;
        uploadedAt?: string;
        sensitiveIssues?: Array<{
          type: 'cpf' | 'rg' | 'passport' | 'birthdate' | 'address' | 'marital_status' | 'photo';
          severity: 'warning';
          match: string;
          message: string;
        }>;
      }>('/api/resumes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  getResumes: () =>
    api
      .get<
        {
          id: string;
          filename: string;
          mimeType: string;
          isDefault: boolean;
          uploadedAt: string;
          parsedJson: unknown;
        }[]
      >('/api/resumes')
      .then((r) => r.data),
  deleteResume: (id: string) => api.delete(`/api/resumes/${id}`).then((r) => r.data),
  extractResume: (id: string) => api.post(`/api/resumes/${id}/extract`).then((r) => r.data),
  atsCheck: (id: string) =>
    api
      .get<{
        resumeId: string;
        score: number;
        issues: Array<{
          severity: 'error' | 'warning';
          code: string;
          message: string;
          snippet?: string;
          confidence?: 'alta' | 'media' | 'baixa';
          fix?: string;
        }>;
        stats: {
          estimatedPages: number;
          wordCount: number;
          hasContactBlock: boolean;
          hasTable: boolean;
          hasMultiColumn: boolean;
        };
      }>(`/api/resumes/${id}/ats-check`)
      .then((r) => r.data),
};

export const setupApi = {
  getStatus: () => api.get<SetupStatus>('/api/setup/status').then((r) => r.data),
  saveAI: (data: {
    provider: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    customPrompt?: string;
  }) => api.post('/api/setup/ai', data).then((r) => r.data),
  saveTelegram: (data: { botToken: string; chatId: string }) =>
    api.post('/api/setup/telegram', data).then((r) => r.data),
  saveCron: (data: { jobCollectionCron: string; dailyReportCron?: string }) =>
    api
      .post<{
        jobCollectionCron: string;
        dailyReportCron: string;
        nextJobCollectionRun: string | null;
        nextDailyReportRun: string | null;
      }>('/api/setup/cron', data)
      .then((r) => r.data),
  complete: () => api.post('/api/setup/complete').then((r) => r.data),
  testConnection: (data?: { baseUrl: string; apiKey: string; model: string }) =>
    api.post<{ ok: boolean; error?: string }>('/api/ai/test', data).then((r) => r.data),
};

export interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const aiProvidersApi = {
  list: () => api.get<{ providers: AiProvider[] }>('/api/ai-providers').then((r) => r.data),
  getActive: () =>
    api.get<{ provider: AiProvider | null }>('/api/ai-providers/active').then((r) => r.data),
  create: (data: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
    isActive?: boolean;
  }) => api.post<AiProvider>('/api/ai-providers', data).then((r) => r.data),
  update: (
    id: string,
    data: Partial<{
      name: string;
      baseUrl: string;
      apiKey: string;
      model: string;
      isActive: boolean;
    }>,
  ) => api.put<AiProvider>(`/api/ai-providers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/ai-providers/${id}`).then((r) => r.data),
  setActive: (id: string) =>
    api.post<AiProvider>(`/api/ai-providers/${id}/activate`).then((r) => r.data),
  test: (id: string) =>
    api.post<{ ok: boolean; error?: string }>(`/api/ai-providers/${id}/test`).then((r) => r.data),
};

export const settingsApi = {
  getScope: (scope: string) =>
    api.get<SettingsByScope>(`/api/settings/${scope}`).then((r) => r.data),
  set: (data: { scope: string; key: string; value: string; isSecret?: boolean }) =>
    api.post('/api/settings', data).then((r) => r.data),
};

export interface SourceStatus {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export const adminApi = {
  collectNow: () =>
    api
      .post<{
        collected: number;
        errors: string[];
        executedSources: string[];
        skippedSources: string[];
      }>('/api/admin/collect-now')
      .then((r) => r.data),
  collectAsync: () => api.post('/api/admin/collect-async').then((r) => r.data),
  processAll: () =>
    api.post<{ message: string; count: number }>('/api/admin/process-all').then((r) => r.data),
  getSources: () => api.get<{ sources: SourceStatus[] }>('/api/admin/sources').then((r) => r.data),
  toggleSource: (sourceId: string, enabled: boolean) =>
    api
      .put<{ sourceId: string; enabled: boolean }>(`/api/admin/sources/${sourceId}/enable`, {
        enabled,
      })
      .then((r) => r.data),
  apifyToken: {
    status: () =>
      api
        .get<{
          configured: boolean;
          fromEnv: boolean;
          links: { console: string; signup: string; docs: string };
        }>('/api/admin/apify-token')
        .then((r) => r.data),
    save: (token: string) =>
      api.post<{ ok: boolean }>('/api/admin/apify-token', { token }).then((r) => r.data),
    remove: () => api.delete<{ ok: boolean }>('/api/admin/apify-token').then((r) => r.data),
  },
  adzunaCredentials: {
    status: () =>
      api
        .get<{
          configured: boolean;
          fromEnv: boolean;
          hasAppId: boolean;
          hasAppKey: boolean;
          links: { signup: string; docs: string };
        }>('/api/admin/adzuna-credentials')
        .then((r) => r.data),
    save: (data: { appId: string; appKey: string }) =>
      api.post<{ ok: boolean }>('/api/admin/adzuna-credentials', data).then((r) => r.data),
    remove: () => api.delete<{ ok: boolean }>('/api/admin/adzuna-credentials').then((r) => r.data),
  },
  /** Custo e volume de IA agrupados por tipo de operação. */
  getAiUsage: (days = 30) =>
    api.get<AiUsageReport>('/api/admin/ai-usage', { params: { days } }).then((r) => r.data),
  getAiRuns: (params: { page?: number; limit?: number; type?: string } = {}) =>
    api
      .get<{
        data: AiRun[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/api/admin/ai-runs', { params })
      .then((r) => r.data),
  sendDailyReport: () =>
    api
      .post<{ success: boolean; error?: string }>('/api/admin/send-daily-report')
      .then((r) => r.data),
};

/** Espelha o enum AiRunType do backend. */
export type AiRunType =
  | 'CV_PARSE'
  | 'REQUIREMENT_EXTRACT'
  | 'MATCH_EXPLAIN'
  | 'JOB_ANALYZE'
  | 'CV_OPTIMIZE'
  | 'SUMMARIZE'
  | 'OTHER';

export interface AiRun {
  id: string;
  type: AiRunType;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** Custo real persistido pelo InstrumentedAiClient (Decimal do Prisma vira número). */
  costUsd: number | null;
  latencyMs: number | null;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error: string | null;
  createdAt: string;
}

export interface AiUsageReport {
  days: number;
  totals: { calls: number; promptTokens: number; completionTokens: number; costUsd: number };
  byType: Array<{
    type: AiRunType;
    calls: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  }>;
  models: string[];
  /** Diferença entre o custo recalculado e o persistido (registros antigos). */
  estimatedMissingCostUsd: number;
}

export interface JobsQueryParams {
  page?: number;
  limit?: number;
  sourceId?: string;
  status?: string;
  remote?: string;
  seniority?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  sort?: string;
  discarded?: 'active' | 'discarded' | 'all';
  minScore?: number;
  minSalary?: number;
  maxSalary?: number;
  minConfidence?: number;
  skill?: string;
}

export interface JobsResponse {
  data: Job[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface JobsStats {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

export interface CreateJobInput {
  title: string;
  company: string;
  description: string;
  location?: string | null;
  remote?: string;
  seniority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  url: string;
  externalId?: string | null;
  publishedAt?: string | null;
  applicationStatus?: string | null;
}

export interface CreateJobResponse {
  job: Job;
  applicationId?: string;
}

export const jobsApi = {
  getList: (params: JobsQueryParams = {}) =>
    api.get<JobsResponse>('/api/jobs', { params }).then((r) => r.data),
  getStats: () => api.get<JobsStats>('/api/jobs/stats').then((r) => r.data),
  getById: (id: string) => api.get<Job>(`/api/jobs/${id}`).then((r) => r.data),
  create: (data: CreateJobInput) =>
    api.post<CreateJobResponse>('/api/jobs', data).then((r) => r.data),
  updateDescription: (id: string, description: string) =>
    api.patch<Job>(`/api/jobs/${id}`, { description }).then((r) => r.data),
  discard: (id: string) =>
    api.post<{ id: string; discardedAt: string }>(`/api/jobs/${id}/discard`).then((r) => r.data),
  restore: (id: string) =>
    api
      .post<{ id: string; discardedAt: string | null }>(`/api/jobs/${id}/restore`)
      .then((r) => r.data),
  keywordGap: (id: string) =>
    api
      .get<{
        score: number;
        matched: string[];
        partial: string[];
        missing: string[];
        gaps: Array<{
          keyword: string;
          category: 'required' | 'nice-to-have';
          status: 'matched' | 'partial' | 'missing';
          suggestion?: string;
        }>;
        recommendation: string;
      }>(`/api/jobs/${id}/keyword-gap`)
      .then((r) => r.data),
};

export interface JobMatch {
  id: string;
  score: number;
  breakdown: MatchBreakdown;
  computedAt: string;
}

export interface MatchResult extends JobMatch {
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    remote: string;
    url: string;
  };
}

export interface MatchList {
  data: MatchResult[];
  /** Total de matches do perfil, mesmo que `data` traga só os 50 melhores. */
  total: number;
}

export interface MatchStats {
  total: number;
  averageScore: number;
  distribution: { range: string; count: number }[];
}

export const matchApi = {
  evaluate: (jobId: string) =>
    api.post<MatchResult>('/api/match/evaluate', { jobId }).then((r) => r.data),
  /** Avalia várias vagas de uma vez (as que estão em tela). */
  evaluateAll: (jobIds: string[]) =>
    api
      .post<{ evaluated: number; results: Array<{ jobId: string; score: number }> }>(
        '/api/match/evaluate-all',
        { jobIds },
      )
      .then((r) => r.data),
  getResults: () => api.get<MatchList>('/api/match/results').then((r) => r.data),
  /** Match desta vaga — não depende da lista paginada. */
  getForJob: (jobId: string) =>
    api.get<{ match: JobMatch | null }>(`/api/jobs/${jobId}/match`).then((r) => r.data),
  getStats: () => api.get<MatchStats>('/api/match/stats').then((r) => r.data),
};

export interface Application {
  id: string;
  jobId: string;
  status: string;
  notes: string | null;
  appliedAt: string | null;
  followUpAt: string | null;
  atsUsed: string | null;
  salary: number | null;
  result: string | null;
  /** JSON livre por candidatura: hoje guarda contato do recrutador. */
  contacts: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  job: {
    id: string;
    title: string;
    company: string;
    description: string;
    location: string | null;
    remote: string;
    url: string;
  };
}

export interface ApplicationsResponse {
  data: Application[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
}

export type AttachmentKind = 'cover_letter' | 'portfolio' | 'other';

export interface ApplicationAttachment {
  id: string;
  applicationId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  createdAt: string;
  downloadUrl: string;
}

export interface KeywordGapReport {
  score: number;
  matched: string[];
  partial: string[];
  missing: string[];
  gaps: Array<{
    keyword: string;
    category: 'required' | 'nice-to-have';
    status: 'matched' | 'partial' | 'missing';
    suggestion?: string;
  }>;
  recommendation: string;
}

/**
 * Kit da candidatura: uma leitura que junta referências, não cópias.
 *
 * A carta continua vindo do gerador (área própria) e o CV das `ResumeVersion`;
 * o kit só organiza por candidatura.
 */
export interface ApplicationKit {
  application: Application & {
    events: ApplicationEvent[];
    attachments: ApplicationAttachment[];
    job: Application['job'] & {
      seniority: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      salaryCurrency: string | null;
      source?: { id: string; name: string } | null;
    };
  };
  match: JobMatch | null;
  analysis: {
    id: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    risks: string[];
    recommendation: string;
    generatedAt: string;
  } | null;
  keywordGap: KeywordGapReport | null;
  cvVersions: Array<{
    id: string;
    resumeId: string;
    jobId: string | null;
    filename: string | null;
    changesNote: string | null;
    generatedAt: string;
  }>;
}

export const applicationsApi = {
  getList: (params: { page?: number; limit?: number; status?: string; jobId?: string } = {}) =>
    api.get<ApplicationsResponse>('/api/applications', { params }).then((r) => r.data),
  getById: (id: string) => api.get<Application>(`/api/applications/${id}`).then((r) => r.data),
  // A rota devolve só o id criado (201), não a candidatura inteira. Tipar como
  // `Application` fazia o caller acessar campos que nunca chegavam.
  create: (jobId: string, notes?: string) =>
    api.post<{ applicationId: string }>('/api/applications', { jobId, notes }).then((r) => r.data),
  updateStatus: (id: string, status: string, note?: string) =>
    api
      .patch<{ application: Application }>(`/api/applications/${id}/status`, { status, note })
      .then((r) => r.data),
  update: (id: string, data: Partial<Application>) =>
    api.patch<Application>(`/api/applications/${id}`, data).then((r) => r.data),
  updateFollowUp: (id: string, followUpAt: string | null) =>
    api.patch<Application>(`/api/applications/${id}/follow-up`, { followUpAt }).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/applications/${id}`).then((r) => r.data),

  // --- Follow-ups (anti-ghosting) -------------------------------------------
  getPendingFollowUps: () =>
    api
      .get<
        Array<{
          id: string;
          jobId: string;
          jobTitle: string;
          jobCompany: string;
          jobUrl: string;
          status: string;
          followUpAt: string | null;
          daysIdle: number;
          cadenceDays: number;
          lastEvent: {
            id: string;
            toStatus: string;
            note: string | null;
            createdAt: string;
          } | null;
        }>
      >('/api/applications/follow-ups-pending')
      .then((r) => r.data),
  registerContact: (id: string, note?: string) =>
    api
      .post<{
        application: unknown;
        event: unknown;
        nextFollowUp: string;
      }>(`/api/applications/${id}/contact`, { note })
      .then((r) => r.data),

  // --- Kit ------------------------------------------------------------------
  getKit: (id: string) =>
    api.get<ApplicationKit>(`/api/applications/${id}/kit`).then((r) => r.data),
  exportKit: (id: string, format: 'json' | 'csv') =>
    api
      .get(`/api/applications/${id}/export`, { params: { format }, responseType: 'blob' })
      .then((r) => r.data as Blob),

  // --- Anexos ---------------------------------------------------------------
  listAttachments: (id: string) =>
    api
      .get<{ attachments: ApplicationAttachment[] }>(`/api/applications/${id}/attachments`)
      .then((r) => r.data.attachments),
  uploadAttachment: (id: string, file: File, kind: AttachmentKind) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ApplicationAttachment>(`/api/applications/${id}/attachments`, form, {
        params: { kind },
      })
      .then((r) => r.data);
  },
  deleteAttachment: (id: string, attachmentId: string) =>
    api.delete(`/api/applications/${id}/attachments/${attachmentId}`).then((r) => r.data),
  downloadAttachment: (attachment: ApplicationAttachment) =>
    api.get(attachment.downloadUrl, { responseType: 'blob' }).then((r) => r.data as Blob),
};

export interface AnalyticsOverview {
  period: { from: string; to: string };
  jobs: {
    collected: number;
    analyzed: number;
    byStatus: Record<string, number>;
  };
  applications: {
    total: number;
    applied: number;
    interviews: number;
    offers: number;
    rejected: number;
    byStatus: Record<string, number>;
  };
  cohort: {
    total: number;
    responded: number;
    interviewed: number;
    offered: number;
  };
  rates: {
    /** `null` quando o denominador da coorte é zero (a UI mostra "—"). */
    responseRate: number | null;
    interviewRate: number | null;
    offerRate: number | null;
  };
  matches: {
    distribution: { range: string; count: number }[];
    averageScore: number;
  };
  skills: {
    mostFrequent: { name: string; count: number }[];
    biggestGaps: { name: string; jobCount: number }[];
  };
}

export const analyticsApi = {
  getOverview: (days = 30) =>
    api.get<AnalyticsOverview>('/api/analytics/overview', { params: { days } }).then((r) => r.data),
};

export interface CvOptimizeResponse {
  resumeId: string;
  jobId: string | null;
  optimizedText: string;
  changes: Array<{
    type: 'reorder' | 'rewrite' | 'keyword_add' | 'summary';
    section: string;
    description: string;
  }>;
  keywordsAdded: string[];
  /** Termos sugeridos pela IA e descartados por não existirem nas fontes. */
  keywordsDropped: string[];
  /** Evidência das keywords aprovadas (alias encontrado e fonte). */
  keywordEvidence: Array<{ term: string; matchedAlias?: string; sourceIndex?: number }>;
  /** Aviso de integridade: palavras-chave barradas por não existirem nas fontes. */
  warning?: string;
  summary: string;
}

export interface ResumeVersion {
  id: string;
  jobId: string | null;
  changesNote: string | null;
  generatedAt: string;
}

export interface CoverLetterResult {
  letter: string;
  language: 'pt-BR' | 'en';
  skillsClaimed: string[];
  tokensUsed?: number;
  descriptionTruncated: boolean;
  descriptionChars: number;
  integrity: {
    fabricatedSkills: string[];
    droppedKeywords: string[];
    warning?: string;
  };
  warning?: string;
}

export const cvApi = {
  optimize: (data: { resumeId?: string; jobId?: string; jobDescription?: string }) =>
    api.post<CvOptimizeResponse>('/api/cv/optimize', data).then((r) => r.data),
  exportPdf: (data: { resumeId?: string; jobId?: string; optimizedText?: string }) =>
    api.post('/api/cv/export-pdf', data, { responseType: 'blob' }).then((r) => r.data as Blob),
  getVersions: (resumeId: string) =>
    api.get<ResumeVersion[]>(`/api/cv/versions/${resumeId}`).then((r) => r.data),
  coverLetter: (data: { jobId: string; recruiterName?: string; language?: 'pt-BR' | 'en' }) =>
    api.post<CoverLetterResult>('/api/cv/cover-letter', data).then((r) => r.data),
  atsCheck: (data: { text: string; jobId?: string }) =>
    api
      .post<{
        score: number;
        issues: Array<{ severity: string; code: string; message: string; fix?: string }>;
        stats: {
          estimatedPages: number;
          wordCount: number;
          hasContactBlock: boolean;
          hasTable: boolean;
          hasMultiColumn: boolean;
        };
        keywordMatch?: { matched: string[]; missing: string[]; score: number };
      }>('/api/cv/ats-check', data)
      .then((r) => r.data),
};

/**
 * Dispara o download de um Blob devolvido pela API.
 *
 * Necessário porque `responseType: 'blob'` só entrega os bytes na memória —
 * sem isto o PDF chega e é descartado em silêncio.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default api;
