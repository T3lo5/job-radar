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
  | 'COVER_LETTER'
  | 'SUMMARIZE'
  | 'OTHER';

export interface AIChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Operação registrada na auditoria (AiRun). */
  type?: AiRunType;
  /**
   * Timeout específico para esta chamada, em ms.
   *
   * O padrão do cliente é 15s, que serve para chamadas rápidas (extração,
   * análise). Otimização de CV envia um prompt grande (CV inteiro + perfil +
   * descrição da vaga) e espera um JSON igualmente grande de volta — 15s é
   * pouca coisa para modelos mais lentos.
   */
  timeoutMs?: number;
  /**
   * Dados extras para a auditoria (`AiRun.metadata`).
   *
   * A carta usa isto para registrar o idioma escolhido: o tipo da execução já
   * vai em `type` (COVER_LETTER), mas sem o idioma não dava para auditar se a
   * vaga em português tinha gerado carta em inglês.
   */
  metadata?: Record<string, unknown>;
}

export interface AIClient {
  chat(messages: AIMessage[], options?: AIChatOptions): Promise<AIResponse>;
}
