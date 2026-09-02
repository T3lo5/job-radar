export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  latencyMs: number
}

export interface AIClientConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AIClient {
  chat(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AIResponse>
}
