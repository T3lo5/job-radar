import type { PrismaClient } from '../../generated/prisma/index.js';
import type { AiRunType } from '../../generated/prisma/index.js';
import type { AIClient, AIClientConfig, AIMessage, AIResponse, AIChatOptions } from './types.js';
import { estimateCostUsd } from './pricing.js';

export interface InstrumentedAiClientDeps {
  prisma: PrismaClient;
}

/**
 * Decorator que registra cada chamada de IA em `ai_runs`.
 *
 * O tipo da operação chega em `options.type`. Antes disso, toda execução era
 * gravada como 'OTHER' — `runOperation` existia com o enum correto, mas não
 * tinha nenhum caller, então a tela de auditoria e o filtro por tipo não
 * mostravam nada de útil.
 */
export class InstrumentedAiClient implements AIClient {
  private readonly inner: AIClient;
  private readonly config: AIClientConfig;
  private readonly prisma: PrismaClient;
  private readonly costAlertThreshold: number;

  constructor(inner: AIClient, config: AIClientConfig, deps: InstrumentedAiClientDeps) {
    this.inner = inner;
    this.config = config;
    this.prisma = deps.prisma;
    this.costAlertThreshold = 0.05;
  }

  async chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIResponse> {
    const type: AiRunType = options?.type ?? 'OTHER';

    try {
      const response = await this.inner.chat(messages, options);
      await this.logRun(type, response, null);

      const cost = response.usage
        ? estimateCostUsd(
            this.config.model,
            response.usage.promptTokens,
            response.usage.completionTokens,
          )
        : 0;

      if (cost > this.costAlertThreshold) {
        console.warn(`[ai] ${type} custou $${cost.toFixed(4)} (modelo ${this.config.model})`);
      }

      return response;
    } catch (err) {
      await this.logRun(type, { content: '', latencyMs: 0, usage: undefined }, err);
      throw err;
    }
  }

  private async logRun(type: AiRunType, response: AIResponse, err: unknown): Promise<void> {
    try {
      if (err) {
        await this.prisma.aiRun.create({
          data: {
            type,
            model: this.config.model,
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return;
      }

      const promptTokens = response.usage?.promptTokens ?? 0;
      const completionTokens = response.usage?.completionTokens ?? 0;

      await this.prisma.aiRun.create({
        data: {
          type,
          model: this.config.model,
          promptTokens,
          completionTokens,
          totalTokens: response.usage?.totalTokens ?? 0,
          latencyMs: response.latencyMs,
          // Agora sim persistido: a tela de auditoria passa a mostrar o custo
          // real em vez de recalcular com uma taxa fixa errada.
          costUsd: response.usage
            ? estimateCostUsd(this.config.model, promptTokens, completionTokens)
            : 0,
          status: 'SUCCESS',
          metadata: { baseUrl: this.config.baseUrl },
        },
      });
    } catch (logErr) {
      // Falhar a gravação da auditoria jamais pode derrubar a chamada de IA.
      console.warn('Falha ao registrar ai_run:', logErr);
    }
  }
}
