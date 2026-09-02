import type { PrismaClient } from '../../generated/prisma/index.js'
import type { AiRunType } from '../../generated/prisma/index.js'
import type { AIClient, AIClientConfig, AIMessage, AIResponse } from './types.js'

export interface InstrumentedAiClientDeps {
  prisma: PrismaClient
}

export class InstrumentedAiClient implements AIClient {
  private readonly inner: AIClient
  private readonly config: AIClientConfig
  private readonly prisma: PrismaClient
  private readonly costAlertThreshold: number

  constructor(inner: AIClient, config: AIClientConfig, deps: InstrumentedAiClientDeps) {
    this.inner = inner
    this.config = config
    this.prisma = deps.prisma
    this.costAlertThreshold = 0.05
  }

  async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      const response = await this.inner.chat(messages, options)

      await this.logRun('OTHER', response, null)

      const estimatedCost = this.estimateCost(response)
      if (estimatedCost > this.costAlertThreshold) {
        console.warn(`AI call cost alert: $${estimatedCost.toFixed(4)}`)
      }

      return response
    } catch (err) {
      const latencyMs = Date.now() - startTime

      await this.logRun('OTHER', { content: '', latencyMs, usage: undefined }, err)

      throw err
    }
  }

  async runOperation(type: AiRunType, fn: () => Promise<AIResponse>): Promise<AIResponse> {
    const startTime = Date.now()

    try {
      const response = await fn()

      await this.logRun(type, response, null)

      const estimatedCost = this.estimateCost(response)
      if (estimatedCost > this.costAlertThreshold) {
        console.warn(`AI call cost alert: $${estimatedCost.toFixed(4)} for ${type}`)
      }

      return response
    } catch (err) {
      const latencyMs = Date.now() - startTime

      await this.logRun(type, { content: '', latencyMs, usage: undefined }, err)

      throw err
    }
  }

  private estimateCost(response: AIResponse): number {
    const promptTokens = response.usage?.promptTokens ?? 0
    const completionTokens = response.usage?.completionTokens ?? 0
    return (promptTokens / 1000) * 0.01 + (completionTokens / 1000) * 0.03
  }

  private async logRun(
    type: AiRunType,
    response: AIResponse,
    err: unknown,
  ): Promise<void> {
    try {
      if (err) {
        await this.prisma.aiRun.create({
          data: {
            type,
            model: this.config.model,
            latencyMs: response.latencyMs,
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        })
      } else {
        await this.prisma.aiRun.create({
          data: {
            type,
            model: this.config.model,
            promptTokens: response.usage?.promptTokens ?? undefined,
            completionTokens: response.usage?.completionTokens ?? undefined,
            totalTokens: response.usage?.totalTokens ?? undefined,
            latencyMs: response.latencyMs,
            status: 'SUCCESS',
            metadata: { baseUrl: this.config.baseUrl },
          },
        })
      }
    } catch (logErr) {
      console.warn('Failed to log AI run:', logErr)
    }
  }
}
