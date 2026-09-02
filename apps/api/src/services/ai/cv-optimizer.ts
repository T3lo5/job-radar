import type { AIClient, AIMessage } from './types.js'

export interface CvOptimization {
  optimizedText: string
  changes: Array<{
    type: 'reorder' | 'rewrite' | 'keyword_add' | 'summary'
    section: string
    description: string
  }>
  keywordsAdded: string[]
  summary: string
}

export class CvOptimizer {
  private readonly ai: AIClient

  constructor(ai: AIClient) {
    this.ai = ai
  }

  async optimize(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    matchedSkills: string[],
    missingSkills: string[],
  ): Promise<CvOptimization> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a CV optimizer. Given a candidate's CV and a job description, suggest optimizations to better match the job requirements.

Return ONLY valid JSON with this structure:
{
  "optimizedText": "The full optimized CV text",
  "changes": [
    {"type": "reorder|rewrite|keyword_add|summary", "section": "section name", "description": "what was changed"}
  ],
  "keywordsAdded": ["keyword1", "keyword2"],
  "summary": "Professional summary tailored to the job"
}

CRITICAL RULES:
- NEVER invent information not present in the original CV
- ONLY reorganize, rephrase, or rewrite existing information
- Keywords added must be from the original CV, just repositioned
- If a skill is not in the CV, do NOT add it
- Maintain the candidate's original experience and achievements`,
      },
      {
        role: 'user',
        content: `Job: ${jobTitle}

Job Description: ${jobDescription.slice(0, 3000)}

Matched Skills: ${matchedSkills.join(', ')}

Missing Skills: ${missingSkills.join(', ')}

Original CV:
${cvText.slice(0, 6000)}`,
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.3, maxTokens: 4000 })

    try {
      return JSON.parse(response.content) as CvOptimization
    } catch {
      throw new Error(`Failed to parse CV optimization: ${response.content.slice(0, 200)}`)
    }
  }

  async optimizeWithProfile(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    profileContext: string,
  ): Promise<CvOptimization> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a CV optimizer for ATS (Applicant Tracking Systems). Your job is to optimize a candidate's CV for a specific job opening.

You will receive:
1. The candidate's PROFILE (source of truth) - contains ONLY real information about the candidate
2. The candidate's CURRENT CV text
3. The JOB DESCRIPTION they are applying for

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER invent, fabricate, or hallucinate any information
2. ONLY use data from the candidate's profile or current CV
3. If a skill/experience is not in the profile/CV, do NOT add it
4. If a date is missing, leave it blank or use "Present" for current roles
5. Do NOT add fake companies, fake degrees, or fake certifications
6. Do NOT claim experience with tools/technologies not explicitly mentioned in the profile or CV
7. If the job requires something the candidate doesn't have, focus on highlighting what they DO have that's relevant
8. Keep all contact information, dates, and factual data exactly as provided
9. Reorganize sections to prioritize relevant experience
10. Use keywords from the job description ONLY if they match the candidate's actual skills/experience

Return ONLY valid JSON with this structure:
{
  "optimizedText": "The full optimized CV text",
  "changes": [
    {"type": "reorder|rewrite|keyword_add|summary", "section": "section name", "description": "what was changed and why"}
  ],
  "keywordsAdded": ["keyword1", "keyword2"],
  "summary": "Professional summary tailored to the job using ONLY real candidate data"
}`,
      },
      {
        role: 'user',
        content: `CANDIDATE PROFILE (SOURCE OF TRUTH - USE ONLY THIS DATA):
${profileContext}

CURRENT CV TEXT:
${cvText.slice(0, 6000)}

JOB DESCRIPTION:
${jobTitle ? `Job Title: ${jobTitle}\n\n` : ''}${jobDescription.slice(0, 4000)}`,
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.2, maxTokens: 4000 })

    try {
      return JSON.parse(response.content) as CvOptimization
    } catch {
      throw new Error(`Failed to parse CV optimization: ${response.content.slice(0, 200)}`)
    }
  }
}
