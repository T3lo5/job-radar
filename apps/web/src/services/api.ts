import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001',
})

export interface Profile {
  id: string
  userId: string
  title: string | null
  seniority: string | null
  seniorityList: string[]
  location: string | null
  remotePreference: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  summary: string | null
  jobTypes: string[]
  focusStacks: string[]
  discardTerms: string[]
  createdAt: string
  updatedAt: string
  skills: ProfileSkill[]
  education: Education[]
  certifications: Certification[]
  projects: Project[]
  workExperiences: WorkExperience[]
  languages: ProfileLanguage[]
}

export interface ProfileSkill {
  id: string
  profileId: string
  skillId: string
  level: string
  yearsExp: number | null
  skill: {
    id: string
    name: string
    category: string | null
  }
}

export interface Education {
  id: string
  institution: string
  degree: string
  field: string | null
  startDate: string | null
  endDate: string | null
}

export interface Certification {
  id: string
  profileId: string
  name: string
  issuer: string | null
  issuedAt: string | null
  expiresAt: string | null
  credentialId: string | null
  url: string | null
}

export interface Project {
  id: string
  profileId: string
  name: string
  description: string | null
  url: string | null
  skills: string[]
}

export interface WorkExperience {
  id: string
  profileId: string
  company: string
  role: string
  description: string | null
  startDate: string | null
  endDate: string | null
  current: boolean
  skills: string[]
}

export interface ProfileLanguage {
  id: string
  language: string
  level: string
}

export interface Job {
  id: string
  title: string
  company: string
  description: string
  location: string | null
  remote: string
  seniority: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  url: string
  sourceId: string
  externalId: string | null
  publishedAt: string | null
  collectedAt: string
  hash: string
  status: string
}

export interface SetupStatus {
  completed: boolean
  completedAt: string | null
}

export interface SettingsByScope {
  scope: string
  settings: Record<string, string>
}

export const profileApi = {
  get: () => api.get<Profile>('/api/profile').then((r) => r.data),
  update: (data: Partial<Profile>) =>
    api.put<Profile>('/api/profile', data).then((r) => r.data),
  addSkill: (skillName: string, level: string, yearsExp?: number) =>
    api
      .post<ProfileSkill>('/api/profile/skills', { skillName, level, yearsExp })
      .then((r) => r.data),
  removeSkill: (id: string) =>
    api.delete(`/api/profile/skills/${id}`).then((r) => r.data),
  updatePreferences: (data: Partial<Profile>) =>
    api.put<Profile>('/api/profile/preferences', data).then((r) => r.data),
  // Education
  addEducation: (data: { degree: string; field: string; institution: string; startDate?: string | null; endDate?: string | null }) =>
    api.post<Education>('/api/profile/education', data).then((r) => r.data),
  updateEducation: (id: string, data: { degree: string; field: string; institution: string; startDate?: string | null; endDate?: string | null }) =>
    api.put<Education>(`/api/profile/education/${id}`, data).then((r) => r.data),
  removeEducation: (id: string) =>
    api.delete(`/api/profile/education/${id}`).then((r) => r.data),
  // Languages
  addLanguage: (data: { language: string; level: string }) =>
    api.post<ProfileLanguage>('/api/profile/languages', data).then((r) => r.data),
  updateLanguage: (id: string, data: { language: string; level: string }) =>
    api.put<ProfileLanguage>(`/api/profile/languages/${id}`, data).then((r) => r.data),
  removeLanguage: (id: string) =>
    api.delete(`/api/profile/languages/${id}`).then((r) => r.data),
  // Certifications
  addCertification: (data: { name: string; issuer?: string | null; issuedAt?: string | null; expiresAt?: string | null; credentialId?: string | null; url?: string | null }) =>
    api.post<Certification>('/api/profile/certifications', data).then((r) => r.data),
  updateCertification: (id: string, data: { name: string; issuer?: string | null; issuedAt?: string | null; expiresAt?: string | null; credentialId?: string | null; url?: string | null }) =>
    api.put<Certification>(`/api/profile/certifications/${id}`, data).then((r) => r.data),
  removeCertification: (id: string) =>
    api.delete(`/api/profile/certifications/${id}`).then((r) => r.data),
  // Projects
  addProject: (data: { name: string; description?: string | null; url?: string | null; skills?: string[] }) =>
    api.post<Project>('/api/profile/projects', data).then((r) => r.data),
  updateProject: (id: string, data: { name: string; description?: string | null; url?: string | null; skills?: string[] }) =>
    api.put<Project>(`/api/profile/projects/${id}`, data).then((r) => r.data),
  removeProject: (id: string) =>
    api.delete(`/api/profile/projects/${id}`).then((r) => r.data),
  // Work Experiences
  addWorkExperience: (data: { company: string; role: string; description?: string | null; startDate?: string | null; endDate?: string | null; current?: boolean; skills?: string[] }) =>
    api.post<WorkExperience>('/api/profile/work-experiences', data).then((r) => r.data),
  updateWorkExperience: (id: string, data: { company: string; role: string; description?: string | null; startDate?: string | null; endDate?: string | null; current?: boolean; skills?: string[] }) =>
    api.put<WorkExperience>(`/api/profile/work-experiences/${id}`, data).then((r) => r.data),
  removeWorkExperience: (id: string) =>
    api.delete(`/api/profile/work-experiences/${id}`).then((r) => r.data),
  // Resumes
  uploadResume: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<{ id: string; filename: string; mimeType: string }>('/api/resumes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
  getResumes: () => api.get<{ id: string; filename: string; mimeType: string; isDefault: boolean; uploadedAt: string }[]>('/api/resumes').then((r) => r.data),
  deleteResume: (id: string) => api.delete(`/api/resumes/${id}`).then((r) => r.data),
  extractResume: (id: string) => api.post(`/api/resumes/${id}/extract`).then((r) => r.data),
}

export const setupApi = {
  getStatus: () =>
    api.get<SetupStatus>('/api/setup/status').then((r) => r.data),
  saveAI: (data: { provider: string; baseUrl: string; apiKey: string; model: string; customPrompt?: string }) =>
    api.post('/api/setup/ai', data).then((r) => r.data),
  saveTelegram: (data: { botToken: string; chatId: string }) =>
    api.post('/api/setup/telegram', data).then((r) => r.data),
  saveCron: (data: { jobCollectionCron: string; dailyReportCron?: string }) =>
    api.post('/api/setup/cron', data).then((r) => r.data),
  complete: () => api.post('/api/setup/complete').then((r) => r.data),
  testConnection: (data?: { baseUrl: string; apiKey: string; model: string }) =>
    api.post<{ ok: boolean; error?: string }>('/api/ai/test', data).then((r) => r.data),
}

export interface AiProvider {
  id: string
  name: string
  baseUrl: string
  model: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export const aiProvidersApi = {
  list: () => api.get<{ providers: AiProvider[] }>('/api/ai-providers').then((r) => r.data),
  getActive: () => api.get<{ provider: AiProvider | null }>('/api/ai-providers/active').then((r) => r.data),
  create: (data: { name: string; baseUrl: string; apiKey: string; model: string; isActive?: boolean }) =>
    api.post<AiProvider>('/api/ai-providers', data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; baseUrl: string; apiKey: string; model: string; isActive: boolean }>) =>
    api.put<AiProvider>(`/api/ai-providers/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/ai-providers/${id}`).then((r) => r.data),
  setActive: (id: string) => api.post<AiProvider>(`/api/ai-providers/${id}/activate`).then((r) => r.data),
  test: (id: string) => api.post<{ ok: boolean; error?: string }>(`/api/ai-providers/${id}/test`).then((r) => r.data),
}

export const settingsApi = {
  getScope: (scope: string) =>
    api.get<SettingsByScope>(`/api/settings/${scope}`).then((r) => r.data),
  set: (data: { scope: string; key: string; value: string; isSecret?: boolean }) =>
    api.post('/api/settings', data).then((r) => r.data),
}

export interface SourceStatus {
  id: string
  name: string
  description: string
  enabled: boolean
}

export const adminApi = {
  collectNow: () =>
    api
      .post<{ collected: number; errors: string[] }>('/api/admin/collect-now')
      .then((r) => r.data),
  collectAsync: () => api.post('/api/admin/collect-async').then((r) => r.data),
  processAll: () =>
    api.post<{ message: string; count: number }>('/api/admin/process-all').then((r) => r.data),
  getSources: () => api.get<{ sources: SourceStatus[] }>('/api/admin/sources').then((r) => r.data),
  toggleSource: (sourceId: string, enabled: boolean) =>
    api.put<{ sourceId: string; enabled: boolean }>(`/api/admin/sources/${sourceId}/enable`, { enabled }).then((r) => r.data),
  apifyToken: {
    status: () =>
      api
        .get<{
          configured: boolean
          fromEnv: boolean
          links: { console: string; signup: string; docs: string }
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
          configured: boolean
          fromEnv: boolean
          hasAppId: boolean
          hasAppKey: boolean
          links: { signup: string; docs: string }
        }>('/api/admin/adzuna-credentials')
        .then((r) => r.data),
    save: (data: { appId: string; appKey: string }) =>
      api.post<{ ok: boolean }>('/api/admin/adzuna-credentials', data).then((r) => r.data),
    remove: () => api.delete<{ ok: boolean }>('/api/admin/adzuna-credentials').then((r) => r.data),
  },
}

export interface JobsQueryParams {
  page?: number
  limit?: number
  sourceId?: string
  status?: string
  remote?: string
  seniority?: string
  search?: string
  fromDate?: Date
  toDate?: Date
}

export interface JobsResponse {
  data: Job[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface JobsStats {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
}

export interface CreateJobInput {
  title: string
  company: string
  description: string
  location?: string | null
  remote?: string
  seniority?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  url: string
  externalId?: string | null
  publishedAt?: string | null
  applicationStatus?: string | null
}

export interface CreateJobResponse {
  job: Job
  applicationId?: string
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
}

export interface MatchResult {
  id: string
  score: number
  breakdown: Record<string, number>
  computedAt: string
  job: {
    id: string
    title: string
    company: string
    location: string | null
    remote: string
    url: string
  }
}

export const matchApi = {
  evaluate: (jobId: string) =>
    api.post<MatchResult>('/api/match/evaluate', { jobId }).then((r) => r.data),
  getResults: () => api.get<MatchResult[]>('/api/match/results').then((r) => r.data),
}

export interface Application {
  id: string
  status: string
  notes: string | null
  appliedAt: string | null
  salary: number | null
  result: string | null
  job: {
    id: string
    title: string
    company: string
    description: string
    location: string | null
    remote: string
    url: string
  }
}

export interface ApplicationsResponse {
  data: Application[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export const applicationsApi = {
  getList: (params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<ApplicationsResponse>('/api/applications', { params }).then((r) => r.data),
  getById: (id: string) => api.get<Application>(`/api/applications/${id}`).then((r) => r.data),
  create: (jobId: string, notes?: string) =>
    api.post<Application>('/api/applications', { jobId, notes }).then((r) => r.data),
  updateStatus: (id: string, status: string, note?: string) =>
    api.patch<Application>(`/api/applications/${id}/status`, { status, note }).then((r) => r.data),
  update: (id: string, data: Partial<Application>) =>
    api.patch<Application>(`/api/applications/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/api/applications/${id}`).then((r) => r.data),
}

export interface AnalyticsOverview {
  period: { from: string; to: string }
  jobs: {
    collected: number
    analyzed: number
    byStatus: Record<string, number>
  }
  applications: {
    total: number
    applied: number
    interviews: number
    offers: number
    rejected: number
    byStatus: Record<string, number>
  }
  rates: {
    responseRate: number
    interviewRate: number
    offerRate: number
  }
  matches: {
    distribution: { range: string; count: number }[]
    averageScore: number
  }
  skills: {
    mostFrequent: { name: string; count: number }[]
    biggestGaps: { name: string; jobCount: number }[]
  }
}

export const analyticsApi = {
  getOverview: (days = 30) =>
    api.get<AnalyticsOverview>('/api/analytics/overview', { params: { days } }).then((r) => r.data),
}

export interface CvOptimizeResponse {
  resumeId: string
  jobId: string | null
  optimizedText: string
  changes: Array<{
    type: 'reorder' | 'rewrite' | 'keyword_add' | 'summary'
    section: string
    description: string
  }>
  keywordsAdded: string[]
  summary: string
}

export interface ResumeVersion {
  id: string
  jobId: string | null
  changesNote: string | null
  generatedAt: string
}

export const cvApi = {
  optimize: (data: { resumeId?: string; jobId?: string; jobDescription?: string }) =>
    api.post<CvOptimizeResponse>('/api/cv/optimize', data).then((r) => r.data),
  exportPdf: (data: { resumeId: string; jobId?: string; optimizedText?: string }) =>
    api.post('/api/cv/export-pdf', data, { responseType: 'blob' }),
  getVersions: (resumeId: string) =>
    api.get<ResumeVersion[]>(`/api/cv/versions/${resumeId}`).then((r) => r.data),
}

export default api
