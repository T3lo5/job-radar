
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  password: 'password',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  seniority: 'seniority',
  seniorityList: 'seniorityList',
  location: 'location',
  remotePreference: 'remotePreference',
  salaryMin: 'salaryMin',
  salaryMax: 'salaryMax',
  salaryCurrency: 'salaryCurrency',
  summary: 'summary',
  jobTypes: 'jobTypes',
  focusStacks: 'focusStacks',
  discardTerms: 'discardTerms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProfileLanguageScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  language: 'language',
  level: 'level'
};

exports.Prisma.EducationScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  institution: 'institution',
  degree: 'degree',
  field: 'field',
  startDate: 'startDate',
  endDate: 'endDate',
  createdAt: 'createdAt'
};

exports.Prisma.CertificationScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  name: 'name',
  issuer: 'issuer',
  issuedAt: 'issuedAt',
  expiresAt: 'expiresAt',
  credentialId: 'credentialId',
  url: 'url',
  createdAt: 'createdAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  name: 'name',
  description: 'description',
  url: 'url',
  skills: 'skills',
  createdAt: 'createdAt'
};

exports.Prisma.WorkExperienceScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  company: 'company',
  role: 'role',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  current: 'current',
  skills: 'skills',
  createdAt: 'createdAt'
};

exports.Prisma.SkillScalarFieldEnum = {
  id: 'id',
  name: 'name',
  aliases: 'aliases',
  category: 'category',
  createdAt: 'createdAt'
};

exports.Prisma.ProfileSkillScalarFieldEnum = {
  id: 'id',
  profileId: 'profileId',
  skillId: 'skillId',
  level: 'level',
  yearsExp: 'yearsExp',
  createdAt: 'createdAt'
};

exports.Prisma.ResumeScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  filename: 'filename',
  mimeType: 'mimeType',
  rawText: 'rawText',
  parsedJson: 'parsedJson',
  isDefault: 'isDefault',
  uploadedAt: 'uploadedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ResumeVersionScalarFieldEnum = {
  id: 'id',
  resumeId: 'resumeId',
  jobId: 'jobId',
  filename: 'filename',
  content: 'content',
  changesNote: 'changesNote',
  generatedAt: 'generatedAt'
};

exports.Prisma.JobSourceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  baseUrl: 'baseUrl',
  enabled: 'enabled',
  config: 'config',
  lastRunAt: 'lastRunAt',
  lastStatus: 'lastStatus',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobScalarFieldEnum = {
  id: 'id',
  title: 'title',
  company: 'company',
  description: 'description',
  location: 'location',
  remote: 'remote',
  seniority: 'seniority',
  salaryMin: 'salaryMin',
  salaryMax: 'salaryMax',
  salaryCurrency: 'salaryCurrency',
  url: 'url',
  sourceId: 'sourceId',
  externalId: 'externalId',
  publishedAt: 'publishedAt',
  collectedAt: 'collectedAt',
  hash: 'hash',
  status: 'status',
  sourceCount: 'sourceCount',
  rawData: 'rawData',
  createdById: 'createdById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.JobProcessingLogScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  fromStatus: 'fromStatus',
  toStatus: 'toStatus',
  message: 'message',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.JobSkillScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  skillId: 'skillId',
  required: 'required'
};

exports.Prisma.JobMatchScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  profileId: 'profileId',
  score: 'score',
  breakdown: 'breakdown',
  computedAt: 'computedAt'
};

exports.Prisma.JobAnalysisScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  profileId: 'profileId',
  summary: 'summary',
  strengths: 'strengths',
  gaps: 'gaps',
  risks: 'risks',
  recommendation: 'recommendation',
  generatedAt: 'generatedAt'
};

exports.Prisma.ApplicationScalarFieldEnum = {
  id: 'id',
  jobId: 'jobId',
  profileId: 'profileId',
  status: 'status',
  appliedAt: 'appliedAt',
  notes: 'notes',
  salary: 'salary',
  result: 'result',
  contacts: 'contacts',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApplicationEventScalarFieldEnum = {
  id: 'id',
  applicationId: 'applicationId',
  fromStatus: 'fromStatus',
  toStatus: 'toStatus',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  channel: 'channel',
  payload: 'payload',
  status: 'status',
  sentAt: 'sentAt',
  error: 'error',
  createdAt: 'createdAt'
};

exports.Prisma.AiRunScalarFieldEnum = {
  id: 'id',
  type: 'type',
  model: 'model',
  promptTokens: 'promptTokens',
  completionTokens: 'completionTokens',
  totalTokens: 'totalTokens',
  costUsd: 'costUsd',
  latencyMs: 'latencyMs',
  status: 'status',
  error: 'error',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.AiProviderScalarFieldEnum = {
  id: 'id',
  name: 'name',
  baseUrl: 'baseUrl',
  apiKey: 'apiKey',
  model: 'model',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SettingScalarFieldEnum = {
  id: 'id',
  key: 'key',
  value: 'value',
  scope: 'scope',
  encrypted: 'encrypted',
  encryptedValue: 'encryptedValue',
  iv: 'iv',
  tag: 'tag',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SettingMetaScalarFieldEnum = {
  id: 'id',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Seniority = exports.$Enums.Seniority = {
  UNKNOWN: 'UNKNOWN',
  INTERN: 'INTERN',
  JUNIOR: 'JUNIOR',
  MID: 'MID',
  SENIOR: 'SENIOR',
  SPECIALIST: 'SPECIALIST',
  LEAD: 'LEAD'
};

exports.RemoteMode = exports.$Enums.RemoteMode = {
  ON_SITE: 'ON_SITE',
  HYBRID: 'HYBRID',
  REMOTE: 'REMOTE',
  ANY: 'ANY',
  UNKNOWN: 'UNKNOWN'
};

exports.LanguageLevel = exports.$Enums.LanguageLevel = {
  BASIC: 'BASIC',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  FLUENT: 'FLUENT',
  NATIVE: 'NATIVE'
};

exports.SkillLevel = exports.$Enums.SkillLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  EXPERT: 'EXPERT'
};

exports.JobStatus = exports.$Enums.JobStatus = {
  RAW: 'RAW',
  EXTRACTING: 'EXTRACTING',
  MATCHING: 'MATCHING',
  ANALYZING: 'ANALYZING',
  DONE: 'DONE',
  FAILED: 'FAILED'
};

exports.AiRecommendation = exports.$Enums.AiRecommendation = {
  STRONG_APPLY: 'STRONG_APPLY',
  APPLY: 'APPLY',
  CONSIDER: 'CONSIDER',
  SKIP: 'SKIP'
};

exports.ApplicationStatus = exports.$Enums.ApplicationStatus = {
  FOUND: 'FOUND',
  INTERESTING: 'INTERESTING',
  CV_PREPARED: 'CV_PREPARED',
  APPLIED: 'APPLIED',
  INTERVIEW: 'INTERVIEW',
  REJECTED: 'REJECTED',
  OFFER: 'OFFER',
  ARCHIVED: 'ARCHIVED'
};

exports.NotificationStatus = exports.$Enums.NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED'
};

exports.AiRunType = exports.$Enums.AiRunType = {
  CV_PARSE: 'CV_PARSE',
  REQUIREMENT_EXTRACT: 'REQUIREMENT_EXTRACT',
  MATCH_EXPLAIN: 'MATCH_EXPLAIN',
  JOB_ANALYZE: 'JOB_ANALYZE',
  CV_OPTIMIZE: 'CV_OPTIMIZE',
  SUMMARIZE: 'SUMMARIZE',
  OTHER: 'OTHER'
};

exports.AiRunStatus = exports.$Enums.AiRunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Profile: 'Profile',
  ProfileLanguage: 'ProfileLanguage',
  Education: 'Education',
  Certification: 'Certification',
  Project: 'Project',
  WorkExperience: 'WorkExperience',
  Skill: 'Skill',
  ProfileSkill: 'ProfileSkill',
  Resume: 'Resume',
  ResumeVersion: 'ResumeVersion',
  JobSource: 'JobSource',
  Job: 'Job',
  JobProcessingLog: 'JobProcessingLog',
  JobSkill: 'JobSkill',
  JobMatch: 'JobMatch',
  JobAnalysis: 'JobAnalysis',
  Application: 'Application',
  ApplicationEvent: 'ApplicationEvent',
  Notification: 'Notification',
  AiRun: 'AiRun',
  AiProvider: 'AiProvider',
  Setting: 'Setting',
  SettingMeta: 'SettingMeta'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
