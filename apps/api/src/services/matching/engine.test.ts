import { describe, it, expect } from 'vitest'
import { computeMatchScore } from './engine.js'
import type { Job, Profile, Skill, ProfileSkill, ProfileLanguage } from '../../generated/prisma/index.js'

function createSkill(id: string, name: string, aliases: string[] = []): Skill {
  return { id, name, aliases, category: null, createdAt: new Date() }
}

function createProfileSkill(skill: Skill, yearsExp?: number): ProfileSkill & { skill: Skill } {
  return {
    id: `ps-${skill.id}`,
    profileId: 'profile-1',
    skillId: skill.id,
    level: 'INTERMEDIATE',
    yearsExp: yearsExp ?? null,
    createdAt: new Date(),
    skill,
  }
}

function createJob(overrides: Partial<Job> = {}, skills: Array<{ skill: Skill; required: boolean }> = []): Job & { skills: Array<{ skill: Skill; required: boolean }> } {
  return {
    id: 'job-1',
    title: 'Senior Software Engineer',
    company: 'TestCo',
    description: 'Test description',
    location: 'São Paulo, Brazil',
    remote: 'ANY',
    salaryMin: 10000,
    salaryMax: 15000,
    salaryCurrency: 'BRL',
    url: 'https://example.com/job',
    sourceId: 'source-1',
    externalId: 'ext-1',
    publishedAt: null,
    collectedAt: new Date(),
    hash: 'hash-1',
    status: 'RAW',
    sourceCount: 1,
    rawData: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    skills,
    ...overrides,
  } as any
}

function createProfile(overrides: Partial<Profile> = {}, skills: ProfileSkill[] = [], languages: ProfileLanguage[] = []): any {
  return {
    id: 'profile-1',
    userId: 'user-1',
    title: 'Senior Software Engineer',
    seniority: 'SENIOR',
    location: 'São Paulo, Brazil',
    remotePreference: 'ANY',
    salaryMin: 8000,
    salaryMax: 15000,
    salaryCurrency: 'BRL',
    summary: 'Experienced developer',
    createdAt: new Date(),
    updatedAt: new Date(),
    skills: skills.map((ps) => ({ ...ps, profileId: 'profile-1' })),
    languages,
    ...overrides,
  }
}

describe('computeMatchScore', () => {
  const react = createSkill('1', 'React')
  const typescript = createSkill('2', 'TypeScript')
  const node = createSkill('3', 'Node.js')
  const aws = createSkill('4', 'AWS')
  const docker = createSkill('5', 'Docker')
  const python = createSkill('6', 'Python')

  const allSkills = [react, typescript, node, aws, docker, python]

  it('returns 100 for perfect match (all skills match)', () => {
    const job = createJob({}, [
      { skill: react, required: true },
      { skill: typescript, required: true },
      { skill: node, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 5),
      createProfileSkill(typescript, 3),
      createProfileSkill(node, 4),
    ])

    const result = computeMatchScore(job, profile, allSkills)
    expect(result.score).toBeGreaterThan(85)
    expect(result.matchedSkills).toContain('React')
    expect(result.matchedSkills).toContain('TypeScript')
    expect(result.missingSkills).toHaveLength(0)
  })

  it('returns proportional score for partial match', () => {
    const job = createJob({}, [
      { skill: react, required: true },
      { skill: typescript, required: true },
      { skill: python, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 3),
      createProfileSkill(typescript, 2),
    ])

    const result = computeMatchScore(job, profile, allSkills)
    expect(result.score).toBeGreaterThan(40)
    expect(result.score).toBeLessThan(85)
    expect(result.matchedSkills).toContain('React')
    expect(result.missingSkills).toContain('Python')
  })

  it('returns low but non-zero score for zero skill match', () => {
    const job = createJob({}, [
      { skill: python, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 5),
    ])

    const result = computeMatchScore(job, profile, allSkills)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(70)
    expect(result.missingSkills).toContain('Python')
  })

  it('counts synonym skills as match', () => {
    const reactjs = createSkill('7', 'React.js', ['React'])
    const job = createJob({}, [
      { skill: reactjs, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 3),
    ])

    const result = computeMatchScore(job, profile, [...allSkills, reactjs])
    expect(result.matchedSkills).toContain('React.js')
  })

  it('never marks unmatched skill as matched', () => {
    const aws = createSkill('10', 'AWS')
    const job = createJob({}, [
      { skill: aws, required: true },
      { skill: python, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 5),
    ])

    const result = computeMatchScore(job, profile, [...allSkills, aws])
    expect(result.matchedSkills).not.toContain('AWS')
    expect(result.matchedSkills).not.toContain('Python')
    expect(result.missingSkills).toContain('AWS')
    expect(result.missingSkills).toContain('Python')
  })

  it('applies penalty for lower seniority', () => {
    const job = createJob({ title: 'Senior Engineer' })
    const juniorProfile = createProfile({ seniority: 'JUNIOR' })
    const seniorProfile = createProfile({ seniority: 'SENIOR' })

    const juniorResult = computeMatchScore(job, juniorProfile, allSkills)
    const seniorResult = computeMatchScore(job, seniorProfile, allSkills)

    expect(juniorResult.breakdown.seniority).toBeLessThan(seniorResult.breakdown.seniority)
  })

  it('applies penalty for incompatible location', () => {
    const remoteJob = createJob({ remote: 'REMOTE' })
    const onSiteJob = createJob({ remote: 'ON_SITE', location: 'New York' })
    const spProfile = createProfile({ location: 'São Paulo, Brazil' })

    const remoteResult = computeMatchScore(remoteJob, spProfile, allSkills)
    const onSiteResult = computeMatchScore(onSiteJob, spProfile, allSkills)

    expect(remoteResult.breakdown.location).toBeGreaterThan(onSiteResult.breakdown.location)
  })

  it('recommends STRONG_APPLY for high scores', () => {
    const job = createJob({}, [
      { skill: react, required: true },
    ])
    const profile = createProfile({}, [
      createProfileSkill(react, 10),
    ])

    const result = computeMatchScore(job, profile, allSkills)
    expect(['STRONG_APPLY', 'APPLY']).toContain(result.recommendation)
  })

  it('recommends SKIP for low scores', () => {
    const job = createJob({}, [
      { skill: python, required: true },
    ])
    const juniorProfile = createProfile({ seniority: 'JUNIOR' }, [
      createProfileSkill(react, 1),
    ])

    const result = computeMatchScore(job, juniorProfile, allSkills)
    expect(['CONSIDER', 'SKIP']).toContain(result.recommendation)
  })
})
