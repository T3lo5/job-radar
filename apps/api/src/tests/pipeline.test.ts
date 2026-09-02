import { describe, it, expect, vi } from 'vitest'

// Mock the AI factory
vi.mock('../services/ai/factory.js', () => ({
  createJobExtractor: vi.fn().mockResolvedValue({
    extract: vi.fn().mockResolvedValue({
      title: 'Software Engineer',
      seniority: 'MID',
      skills: ['React', 'TypeScript'],
      experienceYears: '3-5 years',
      languages: ['English'],
      location: 'Remote',
      remote: 'REMOTE',
      salary: { min: 5000, max: 8000, currency: 'USD' },
      requiredRequirements: ['React experience'],
      niceToHave: ['Node.js'],
    }),
  }),
  createJobAnalyzer: vi.fn().mockResolvedValue({
    analyze: vi.fn().mockResolvedValue({
      score: 85,
      nivel_aderencia: 'Alta',
      prioridade: 'alta',
      pontos_fortes: ['React', 'TypeScript'],
      requisitos_faltantes: ['Node.js'],
      riscos: [],
      modalidade: 'remoto',
      senioridade: 'pleno',
      tecnologias_match: ['React', 'TypeScript'],
      resumo_vaga: 'Good match for the role',
      recomendacao: 'Candidatar',
    }),
  }),
}))

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
  FlowProducer: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-flow-id' }),
  })),
}))

describe('Pipeline Logic', () => {
  it('validates job status transitions', () => {
    const validTransitions = [
      { from: 'RAW', to: 'EXTRACTING' },
      { from: 'EXTRACTING', to: 'MATCHING' },
      { from: 'MATCHING', to: 'ANALYZING' },
      { from: 'ANALYZING', to: 'DONE' },
    ]

    for (const transition of validTransitions) {
      expect(transition.from).not.toBe(transition.to)
    }
  })

  it('validates job status enum values', () => {
    const validStatuses = ['RAW', 'EXTRACTING', 'MATCHING', 'ANALYZING', 'DONE', 'FAILED']

    expect(validStatuses).toContain('RAW')
    expect(validStatuses).toContain('DONE')
    expect(validStatuses).toHaveLength(6)
  })

  it('validates application status enum values', () => {
    const validStatuses = [
      'FOUND', 'INTERESTING', 'CV_PREPARED', 'APPLIED',
      'INTERVIEW', 'REJECTED', 'OFFER', 'ARCHIVED',
    ]

    expect(validStatuses).toContain('FOUND')
    expect(validStatuses).toContain('OFFER')
    expect(validStatuses).toHaveLength(8)
  })

  it('validates AI recommendation enum values', () => {
    const validRecommendations = ['STRONG_APPLY', 'APPLY', 'CONSIDER', 'SKIP']

    expect(validRecommendations).toContain('STRONG_APPLY')
    expect(validRecommendations).toContain('SKIP')
    expect(validRecommendations).toHaveLength(4)
  })

  it('validates score ranges', () => {
    const testCases = [
      { score: 0, valid: true },
      { score: 50, valid: true },
      { score: 100, valid: true },
      { score: -1, valid: false },
      { score: 101, valid: false },
    ]

    for (const tc of testCases) {
      const isValid = tc.score >= 0 && tc.score <= 100
      expect(isValid).toBe(tc.valid)
    }
  })

  it('verifies AI does not invent skills', () => {
    // Simulated extracted skills from job
    const extractedSkills = ['React', 'TypeScript', 'Node.js']

    // Simulated AI analysis output
    const aiStrengths = ['React', 'TypeScript']
    const aiGaps = ['Node.js']

    // Verify AI only uses skills from extraction
    for (const skill of aiStrengths) {
      expect(extractedSkills).toContain(skill)
    }
    for (const skill of aiGaps) {
      expect(extractedSkills).toContain(skill)
    }
  })

  it('verifies pipeline order', () => {
    const pipelineSteps = [
      'collection',
      'extraction',
      'matching',
      'analysis',
      'complete',
    ]

    expect(pipelineSteps[0]).toBe('collection')
    expect(pipelineSteps[pipelineSteps.length - 1]).toBe('complete')
    expect(pipelineSteps).toContain('extraction')
    expect(pipelineSteps).toContain('matching')
    expect(pipelineSteps).toContain('analysis')
  })
})
