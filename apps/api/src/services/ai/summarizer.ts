import type { AIClient, AIMessage } from './types.js'

export class Summarizer {
  private readonly ai: AIClient

  constructor(ai: AIClient) {
    this.ai = ai
  }

  async summarize(description: string): Promise<string> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content:
          'Summarize the job description in 2-3 sentences. Focus on key requirements and responsibilities.',
      },
      {
        role: 'user',
        content: description.slice(0, 3000),
      },
    ]

    const response = await this.ai.chat(messages, { temperature: 0.3, maxTokens: 500 })
    return response.content
  }
}
