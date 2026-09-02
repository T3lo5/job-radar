import type { AIClient, AIClientConfig, AIMessage, AIResponse } from './types.js'

export class HttpAiClient implements AIClient {
  private readonly config: AIClientConfig

  constructor(config: AIClientConfig) {
    this.config = config
  }

  async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    const startTime = Date.now()

    const response = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AI API error (${response.status}): ${error}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    }

    const latencyMs = Date.now() - startTime

    return {
      content: data.choices[0]?.message?.content ?? '',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      latencyMs,
    }
  }
}
