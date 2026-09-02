import type { AIClient, AIMessage } from './types.js'

export interface CvData {
  name: string
  email?: string
  phone?: string
  title?: string
  summary?: string
  skills: string[]
  experience: Array<{
    company: string
    role: string
    period?: string
    description?: string
  }>
  education: Array<{
    institution: string
    degree: string
    field?: string
  }>
  languages: string[]
}

export class CvParser {
  private readonly ai: AIClient

  constructor(ai: AIClient) {
    this.ai = ai
  }

  async parse(rawText: string): Promise<CvData> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a CV/Resume parser. Extract structured information from the raw text.
Return ONLY valid JSON with this structure:
{
  "name": "Full name",
  "email": "email if found",
  "phone": "phone if found",
  "title": "Professional title",
  "summary": "Brief professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{"company": "", "role": "", "period": "", "description": ""}],
  "education": [{"institution": "", "degree": "", "field": ""}],
  "languages": ["language1"]
}

IMPORTANT RULES:
- NEVER invent information not present in the text
- If a field is not found, omit it or use empty array
- Only extract what is explicitly stated`,
      },
      {
        role: 'user',
        content: `Extract structured data from this CV:\n\n${rawText.slice(0, 8000)}`,
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.1, maxTokens: 3000 })

    try {
      return JSON.parse(response.content) as CvData
    } catch {
      throw new Error(`Failed to parse CV: ${response.content.slice(0, 200)}`)
    }
  }
}
