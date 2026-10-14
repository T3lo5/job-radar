export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface AIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Tipo da operação, espelha o enum AiRunType do Prisma.
 *
 * É declarado por cada serviço no momento da chamada. Sem isso, toda execução
 * de IA era registrada como 'OTHER' e a auditoria de custo não conseguia dizer
 * quanto cada etapa (extrair, analisar, otimizar CV...) consumia.
 */
export type AiRunType =
  | 'CV_PARSE'
  | 'REQUIREMENT_EXTRACT'
  | 'MATCH_EXPLAIN'
  | 'JOB_ANALYZE'
  | 'CV_OPTIMIZE'
  | 'SUMMARIZE'
  | 'OTHER';

export interface AIChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Operação registrada na auditoria (AiRun). */
  type?: AiRunType;
}

export interface AIClient {
  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIResponse>;
}
