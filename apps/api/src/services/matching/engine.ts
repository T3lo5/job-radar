import type { Job, Profile, Skill, ProfileSkill, ProfileLanguage } from '../../generated/prisma/index.js'

export interface MatchBreakdown {
  technologies: number
  experience: number
  seniority: number
  location: number
  cloudDevOps: number
  languages: number
  other: number
  [key: string]: number
}

export interface MatchResult {
  score: number
  breakdown: MatchBreakdown
  matchedSkills: string[]
  partialSkills: string[]
  missingSkills: string[]
  recommendation: 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP'
}

const WEIGHTS = {
  technologies: 0.35,
  experience: 0.20,
  seniority: 0.15,
  location: 0.10,
  cloudDevOps: 0.10,
  languages: 0.05,
  other: 0.05,
} as const

const CLOUD_DEVOPS_KEYWORDS = [
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
  'terraform', 'ci/cd', 'github actions', 'jenkins', 'circleci', 'ansible',
  'prometheus', 'grafana', 'elk', 'helm', 'ecs', 'eks', 'lambda',
]

interface JobWithSkills extends Job {
  skills?: Array<{ skill: Skill; required: boolean }>
}

interface ProfileWithRelations extends Profile {
  skills?: Array<ProfileSkill & { skill: Skill }>
  languages?: ProfileLanguage[]
}

export function computeMatchScore(
  job: JobWithSkills,
  profile: ProfileWithRelations,
  allSkills: Skill[] = [],
): MatchResult {
  const matchedSkills: string[] = []
  const partialSkills: string[] = []
  const missingSkills: string[] = []

  const techScore = computeTechnologiesScore(
    job, profile, allSkills, matchedSkills, partialSkills, missingSkills,
  )
  const expScore = computeExperienceScore(profile, matchedSkills.length)
  const seniorityScore = computeSeniorityScore(job, profile)
  const locationScore = computeLocationScore(job, profile)
  const cloudScore = computeCloudDevOpsScore(job, profile, allSkills, matchedSkills, partialSkills)
  const langScore = computeLanguageScore(job, profile)
  const otherScore = 50

  const breakdown: MatchBreakdown = {
    technologies: techScore,
    experience: expScore,
    seniority: seniorityScore,
    location: locationScore,
    cloudDevOps: cloudScore,
    languages: langScore,
    other: otherScore,
  }

  const totalScore = Math.round(
    techScore * WEIGHTS.technologies +
    expScore * WEIGHTS.experience +
    seniorityScore * WEIGHTS.seniority +
    locationScore * WEIGHTS.location +
    cloudScore * WEIGHTS.cloudDevOps +
    langScore * WEIGHTS.languages +
    otherScore * WEIGHTS.other,
  )

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown,
    matchedSkills,
    partialSkills,
    missingSkills,
    recommendation: getRecommendation(totalScore),
  }
}

function computeTechnologiesScore(
  job: JobWithSkills,
  profile: ProfileWithRelations,
  allSkills: Skill[],
  matched: string[],
  partial: string[],
  missing: string[],
): number {
  const jobSkills = job.skills?.map((js) => js.skill) ?? []
  const profileSkillNames = new Set(
    (profile.skills ?? []).map((ps) => normalizeSkillName(ps.skill?.name ?? '')),
  )

  if (jobSkills.length === 0) return 50

  let totalWeight = 0
  let earnedWeight = 0

  for (const jobSkill of jobSkills) {
    totalWeight += 1
    const normalizedName = normalizeSkillName(jobSkill.name)

    if (profileSkillNames.has(normalizedName)) {
      earnedWeight += 1
      matched.push(jobSkill.name)
      continue
    }

    if (findSynonymMatch(jobSkill, allSkills, profileSkillNames)) {
      earnedWeight += 1
      matched.push(jobSkill.name)
      continue
    }

    if (findRelatedMatch(jobSkill, profileSkillNames)) {
      earnedWeight += 0.5
      partial.push(jobSkill.name)
      continue
    }

    missing.push(jobSkill.name)
  }

  if (totalWeight === 0) return 50
  return Math.round((earnedWeight / totalWeight) * 100)
}

function computeExperienceScore(
  profile: ProfileWithRelations,
  matchedSkillCount: number,
): number {
  const skills = profile.skills ?? []
  if (skills.length === 0) return 0

  const totalYears = skills.reduce((sum: number, ps) => sum + (ps.yearsExp ?? 0), 0)
  const avgYears = totalYears / skills.length
  const yearsScore = Math.min(100, (avgYears / 3) * 100)
  const skillBonus = Math.min(20, matchedSkillCount * 2)

  return Math.min(100, Math.round(yearsScore + skillBonus))
}

function computeSeniorityScore(job: Job, profile: Profile): number {
  if (!profile.seniority) return 50

  const seniorityLevels: Record<string, number> = {
    INTERN: 1, JUNIOR: 2, MID: 3, SENIOR: 4, SPECIALIST: 5, LEAD: 5,
  }

  const profileLevel = seniorityLevels[profile.seniority] ?? 3
  const titleLower = job.title.toLowerCase()
  let jobLevel = 3

  if (titleLower.includes('estagiár') || titleLower.includes('intern') || titleLower.includes('trainee')) {
    jobLevel = 1
  } else if (titleLower.includes('júnior') || titleLower.includes('junior') || titleLower.includes('jr')) {
    jobLevel = 2
  } else if (titleLower.includes('sênior') || titleLower.includes('senior') || titleLower.includes('sr')) {
    jobLevel = 4
  } else if (titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) {
    jobLevel = 5
  }

  const diff = Math.abs(profileLevel - jobLevel)
  if (diff === 0) return 100
  if (diff === 1) return 75
  if (diff === 2) return 50
  if (diff === 3) return 25
  return 10
}

function computeLocationScore(job: Job, profile: Profile): number {
  if (job.remote === 'REMOTE') return 100
  if (job.remote === 'ANY') return 90
  if (!profile.location || !job.location) return 50

  const jobLoc = job.location.toLowerCase()
  const profileLoc = profile.location.toLowerCase()

  if (jobLoc.includes(profileLoc) || profileLoc.includes(jobLoc)) return 100

  const brazilCities = ['são paulo', 'rio', 'belo horizonte', 'curitiba', 'porto alegre', 'brasília', 'florianópolis', 'recife', 'salvador']
  const jobIsBR = brazilCities.some((city) => jobLoc.includes(city)) || jobLoc.includes('brazil') || jobLoc.includes('brasil')
  const profileIsBR = brazilCities.some((city) => profileLoc.includes(city)) || profileLoc.includes('brazil') || profileLoc.includes('brasil')

  if (jobIsBR && profileIsBR) return 70
  return 30
}

function computeCloudDevOpsScore(
  job: JobWithSkills,
  profile: ProfileWithRelations,
  allSkills: Skill[],
  matched: string[],
  partial: string[],
): number {
  const jobSkills = job.skills?.map((js) => js.skill) ?? []
  const profileSkillNames = new Set(
    (profile.skills ?? []).map((ps) => normalizeSkillName(ps.skill?.name ?? '')),
  )

  const cloudSkills = jobSkills.filter((skill) =>
    CLOUD_DEVOPS_KEYWORDS.some((kw) =>
      normalizeSkillName(skill.name).includes(kw) || kw.includes(normalizeSkillName(skill.name)),
    ),
  )

  if (cloudSkills.length === 0) return 70

  let matchedCount = 0
  for (const skill of cloudSkills) {
    const normalizedName = normalizeSkillName(skill.name)
    if (profileSkillNames.has(normalizedName)) {
      matchedCount++
      if (!matched.includes(skill.name)) matched.push(skill.name)
    } else if (findSynonymMatch(skill, allSkills, profileSkillNames)) {
      matchedCount++
      if (!matched.includes(skill.name)) matched.push(skill.name)
    } else if (!partial.includes(skill.name)) {
      partial.push(skill.name)
    }
  }

  return Math.round((matchedCount / cloudSkills.length) * 100)
}

function computeLanguageScore(job: Job, profile: ProfileWithRelations): number {
  const languages = profile.languages ?? []
  if (languages.length === 0) return 50

  const hasEnglish = languages.some(
    (l) => l.language.toLowerCase().includes('english') || l.language.toLowerCase().includes('inglês'),
  )

  const titleLower = job.title.toLowerCase()
  const requiresEnglish = !titleLower.includes('brasil') && !titleLower.includes('brazil') && !titleLower.includes('português')

  if (requiresEnglish && hasEnglish) return 100
  if (requiresEnglish && !hasEnglish) return 40
  return 80
}

function getRecommendation(score: number): MatchResult['recommendation'] {
  if (score >= 85) return 'STRONG_APPLY'
  if (score >= 70) return 'APPLY'
  if (score >= 50) return 'CONSIDER'
  return 'SKIP'
}

function normalizeSkillName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\.js$/, '').replace(/\.ts$/, '').replace(/js$/, '').replace(/reactnative$/, 'react')
}

function findSynonymMatch(targetSkill: Skill, allSkills: Skill[], profileSkillNames: Set<string>): boolean {
  const target = allSkills.find((s) => s.id === targetSkill.id)
  if (!target) return false

  for (const alias of target.aliases) {
    if (profileSkillNames.has(normalizeSkillName(alias))) return true
  }

  for (const skill of allSkills) {
    if (profileSkillNames.has(normalizeSkillName(skill.name))) {
      if (skill.aliases.some((a) => normalizeSkillName(a) === normalizeSkillName(targetSkill.name))) {
        return true
      }
    }
  }

  return false
}

function findRelatedMatch(targetSkill: Skill, profileSkillNames: Set<string>): boolean {
  const targetNormalized = normalizeSkillName(targetSkill.name)

  const relatedGroups = [
    ['react', 'reactnative', 'nextjs', 'gatsby', 'remix'],
    ['vue', 'nuxt', 'vuex'],
    ['angular', 'rxjs'],
    ['node', 'express', 'fastify', 'nestjs', 'koa'],
    ['python', 'django', 'flask', 'fastapi'],
    ['java', 'spring', 'springboot', 'kotlin'],
    ['javascript', 'typescript', 'node', 'react', 'vue', 'angular'],
    ['postgresql', 'mysql', 'mariadb', 'sql'],
    ['mongodb', 'dynamodb', 'couchdb'],
    ['redis', 'memcached', 'elasticsearch'],
    ['docker', 'kubernetes', 'k8s', 'helm'],
    ['aws', 'gcp', 'azure', 'cloud'],
  ]

  for (const group of relatedGroups) {
    const targetInGroup = group.some((g) => targetNormalized.includes(g) || g.includes(targetNormalized))
    if (targetInGroup) {
      for (const profileSkill of profileSkillNames) {
        if (group.some((g) => profileSkill.includes(g) || g.includes(profileSkill)) && profileSkill !== targetNormalized) {
          return true
        }
      }
    }
  }

  return false
}
