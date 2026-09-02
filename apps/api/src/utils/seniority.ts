const SENIORITY_PATTERNS: Array<{ level: string; patterns: string[] }> = [
  { level: 'LEAD', patterns: ['lead', 'principal', 'staff', 'head of', 'director', 'vp of', 'chief', 'cto', 'cio', 'chief technology', 'chief information'] },
  { level: 'SENIOR', patterns: ['senior', 'sr.', ', sr', ' sr ', 'senior-', '/sr', ' sr.', 'sr,'] },
  { level: 'SPECIALIST', patterns: ['specialist', 'expert', 'architect', 'specialist,', 'specialist-', 'specialist '] },
  { level: 'MID', patterns: ['pleno', 'mid', 'intermediate', 'mid-', 'pleno-', 'pleno '] },
  { level: 'JUNIOR', patterns: ['junior', 'jr.', ', jr', ' jr ', 'junior-', '/jr', ' jr.', 'jr,', 'entry', 'entry-level', 'entry level', 'associate', 'trainee'] },
  { level: 'INTERN', patterns: ['intern', 'estagiário', 'estagiario', 'internship', 'estágio'] },
]

export function detectSeniority(title: string): string {
  const lower = title.toLowerCase()

  for (const { level, patterns } of SENIORITY_PATTERNS) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return level
      }
    }
  }

  return 'UNKNOWN'
}

export const SENIORITY_ORDER: Record<string, number> = {
  INTERN: 0,
  JUNIOR: 1,
  MID: 2,
  SENIOR: 3,
  SPECIALIST: 4,
  LEAD: 5,
  UNKNOWN: -1,
}
