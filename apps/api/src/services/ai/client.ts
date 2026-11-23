import type { AIClient, AIClientConfig, AIMessage, AIResponse } from './types.js';
import { fetchWithTimeout } from '../../utils/http.js';

export class HttpAiClient implements AIClient {
  private readonly config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  async chat(
    messages: AIMessage[],
    options?: { temperature?: number; maxTokens?: number; timeoutMs?: number },
  ): Promise<AIResponse> {
    const startTime = Date.now();

    const response = await fetchWithTimeout(this.config.baseUrl, {
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
      timeoutMs: options?.timeoutMs,
    });

    if (!response.ok) {
      // O corpo da resposta do provedor pode conter detalhes internos da conta
      // (e em alguns provedores, partes da chave). Só o status é propagado —
      // o corpo fica registrado no log para diagnóstico.
      const body = await response.text();
      console.error(`[ai] ${response.status} do provedor: ${body.slice(0, 500)}`);
      throw new Error(`AI API error (${response.status})`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content?: string; reasoning?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const latencyMs = Date.now() - startTime;

    // Alguns modelos de raciocínio (ex: SenseNova, DeepSeek R1) devolvem o
    // resultado no campo `reasoning` em vez de `content`. Se `content` estiver
    // vazio, caímos para o `reasoning` — que normalmente contém o raciocínio
    // seguido da resposta final.
    const message = data.choices[0]?.message;
    let content = message?.content ?? message?.reasoning ?? '';

    if (!content) {
      console.error(
        `[ai] resposta 200 sem campo content/reasoning (latencyMs=${latencyMs}): ${JSON.stringify(data).slice(0, 600)}`,
      );
      throw new Error(
        `O provedor de IA retornou uma resposta inesperada (sem campo 'content' ou 'reasoning'). Verifique o modelo configurado em Configurações > IA.`,
      );
    }

    if (!message?.content && message?.reasoning) {
      console.info(
        `[ai] usando campo 'reasoning' do modelo ${this.config.model} (latencyMs=${latencyMs})`,
      );
    }

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      latencyMs,
    };
  }
}
