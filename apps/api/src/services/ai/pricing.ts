/**
 * Estimativa de custo de IA.
 *
 * Antes o custo era calculado em dois lugares com a mesma taxa fixa
 * ($0,01/1K entrada, $0,03/1K saída), o que é a ordem de grandeza da GPT-4
 * e está errado para quase todo o resto — o modelo configurado por padrão no
 * wizard (deepseek) custa ~10x menos, e um modelo local custa zero.
 *
 * Os valores abaixo são REFERÊNCIAS e mudam com frequência. A ordem de
 * grandeza é o que interessa aqui: detectar que o custo disparou. Confira
 * antes de usar para faturamento.
 *
 * Valores em USD por 1 milhão de tokens.
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const DEFAULT_PRICING: ModelPricing = {
  // Conservative: mais caro que a maioria, então superestima em vez de
  // subestimar (é melhor levantar alerta do que deixar passar).
  inputPerMillion: 3,
  outputPerMillion: 15,
};

/** Preço zero: Ollama, LM Studio, llama.cpp — rodando na sua máquina. */
const LOCAL_PRICING: ModelPricing = { inputPerMillion: 0, outputPerMillion: 0 };

/**
 * Ordem importa pouco porque a busca é pelo prefixo mais longo, mas deixar
 * do mais específico para o mais genérico facilita a leitura.
 */
const PRICING_TABLE: Array<{ prefix: string; pricing: ModelPricing }> = [
  // Locais / self-hosted
  { prefix: 'ollama', pricing: LOCAL_PRICING },
  { prefix: 'llama', pricing: LOCAL_PRICING },
  { prefix: 'mistral', pricing: LOCAL_PRICING },
  { prefix: 'qwen', pricing: LOCAL_PRICING },
  { prefix: 'gemma', pricing: LOCAL_PRICING },
  { prefix: 'phi', pricing: LOCAL_PRICING },
  { prefix: 'local', pricing: LOCAL_PRICING },

  // OpenAI
  { prefix: 'gpt-4o-mini', pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 } },
  { prefix: 'gpt-4o', pricing: { inputPerMillion: 2.5, outputPerMillion: 10 } },
  { prefix: 'gpt-4.1-mini', pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 } },
  { prefix: 'gpt-4.1', pricing: { inputPerMillion: 2, outputPerMillion: 8 } },
  { prefix: 'gpt-4-turbo', pricing: { inputPerMillion: 10, outputPerMillion: 30 } },
  { prefix: 'gpt-4', pricing: { inputPerMillion: 30, outputPerMillion: 60 } },
  { prefix: 'o4-mini', pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 } },
  { prefix: 'o3-mini', pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 } },
  { prefix: 'o1-mini', pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 } },
  { prefix: 'o1', pricing: { inputPerMillion: 15, outputPerMillion: 60 } },
  { prefix: 'o3', pricing: { inputPerMillion: 2, outputPerMillion: 8 } },

  // Anthropic
  { prefix: 'claude-3-5-haiku', pricing: { inputPerMillion: 0.8, outputPerMillion: 4 } },
  { prefix: 'claude-3-haiku', pricing: { inputPerMillion: 0.25, outputPerMillion: 1.25 } },
  { prefix: 'claude-haiku-4', pricing: { inputPerMillion: 1, outputPerMillion: 5 } },
  { prefix: 'claude-3-opus', pricing: { inputPerMillion: 15, outputPerMillion: 75 } },
  { prefix: 'claude-3-5-sonnet', pricing: { inputPerMillion: 3, outputPerMillion: 15 } },
  { prefix: 'claude-sonnet-4', pricing: { inputPerMillion: 3, outputPerMillion: 15 } },
  { prefix: 'claude-opus-4', pricing: { inputPerMillion: 15, outputPerMillion: 75 } },
  { prefix: 'claude-3', pricing: { inputPerMillion: 3, outputPerMillion: 15 } },

  // DeepSeek
  { prefix: 'deepseek-reasoner', pricing: { inputPerMillion: 0.55, outputPerMillion: 2.19 } },
  { prefix: 'deepseek-chat', pricing: { inputPerMillion: 0.27, outputPerMillion: 1.1 } },
  { prefix: 'deepseek', pricing: { inputPerMillion: 0.27, outputPerMillion: 1.1 } },

  // Google
  { prefix: 'gemini-1.5-flash', pricing: { inputPerMillion: 0.075, outputPerMillion: 0.3 } },
  { prefix: 'gemini-1.5-pro', pricing: { inputPerMillion: 1.25, outputPerMillion: 5 } },
  { prefix: 'gemini-2.0-flash', pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 } },
  { prefix: 'gemini-2.5-flash', pricing: { inputPerMillion: 0.3, outputPerMillion: 2.5 } },
  { prefix: 'gemini', pricing: { inputPerMillion: 1.25, outputPerMillion: 5 } },

  // xAI
  { prefix: 'grok', pricing: { inputPerMillion: 3, outputPerMillion: 15 } },

  // Genéricos OpenAI-compatible
  { prefix: 'gpt-', pricing: DEFAULT_PRICING },
  { prefix: 'claude', pricing: DEFAULT_PRICING },
];

/** Desconhecido: usa o padrão conservador. */
export function pricingFor(model: string): ModelPricing {
  const normalized = (model ?? '').toLowerCase();

  // Prefixo mais longo casando, para 'gpt-4o-mini' não cair em 'gpt-4o'.
  let best: { prefix: string; pricing: ModelPricing } | null = null;
  for (const entry of PRICING_TABLE) {
    if (!normalized.startsWith(entry.prefix)) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }

  return best?.pricing ?? DEFAULT_PRICING;
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  // O contador de tokens vem do provedor, e provedores já mandaram
  // usage: {promptTokens: -1}. Sem o clamp, isso gravava custo negativo no
  // banco e o total da tela de auditoria saía errado — silenciosamente, que
  // é o pior jeito.
  const input = Number.isFinite(promptTokens) ? Math.max(promptTokens, 0) : 0;
  const output = Number.isFinite(completionTokens) ? Math.max(completionTokens, 0) : 0;

  const { inputPerMillion, outputPerMillion } = pricingFor(model);
  const cost = (input / 1_000_000) * inputPerMillion + (output / 1_000_000) * outputPerMillion;
  // 6 casas: a coluna é Decimal(10,6), e valores abaixo disso são ruído.
  return Number(cost.toFixed(6));
}

export function isKnownModel(model: string): boolean {
  const normalized = (model ?? '').toLowerCase();
  return PRICING_TABLE.some((entry) => normalized.startsWith(entry.prefix));
}
