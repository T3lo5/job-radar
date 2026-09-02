import type { AIClient, AIMessage } from './types.js'

export interface JobExtraction {
  title: string
  seniority: string | null
  skills: string[]
  experienceYears: string | null
  languages: string[]
  location: string | null
  remote: 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN'
  salary: { min: number | null; max: number | null; currency: string | null }
  requiredRequirements: string[]
  niceToHave: string[]
}

export class JobExtractor {
  private readonly ai: AIClient

  constructor(ai: AIClient) {
    this.ai = ai
  }

  async extract(title: string, description: string): Promise<JobExtraction> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a job requirement extractor. Given a job title and description, extract structured information.
Return ONLY valid JSON with this structure:
{
  "title": "Job title",
  "seniority": "JUNIOR | MID | SENIOR | LEAD | null",
  "skills": ["skill1", "skill2"],
  "experienceYears": "e.g., '3-5 years' or null",
  "languages": ["English", "Portuguese"],
  "location": "City, Country or null",
  "remote": "REMOTE | HYBRID | ON_SITE | UNKNOWN",
  "salary": {"min": 5000, "max": 8000, "currency": "USD"},
  "requiredRequirements": ["req1", "req2"],
  "niceToHave": ["nice1", "nice2"]
}

IMPORTANT RULES:
- NEVER invent information not present in the description
- Only extract what is explicitly stated
- For skills, use concise names (e.g., "React", "TypeScript", "AWS")`,
      },
      {
        role: 'user',
        content: `Title: ${title}

Description: ${description.slice(0, 6000)}`,
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.2, maxTokens: 2000 })

    try {
      return JSON.parse(response.content) as JobExtraction
    } catch {
      throw new Error(`Failed to parse job extraction: ${response.content.slice(0, 200)}`)
    }
  }
}
