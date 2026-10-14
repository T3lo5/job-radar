/**
 * fetch com timeout obrigatório.
 *
 * Sem `signal`, um provedor de IA ou uma fonte de vaga que aceita a conexão e
 * nunca responde trava a chamada para sempre. Como as fontes rodam em
 * `Promise.all` (sources/index.ts), uma travada sozinha segura o worker de
 * coleta inteiro — que nunca conclui e nunca registra nada.
 *
 * `AbortSignal.timeout` já vem no Node 18+, então não é preciso AbortController
 * manual nem limpiar timer.
 */

export const DEFAULT_TIMEOUT_MS = 15_000;

/** Timeout mais curto para "chamar logo e ver se responde" (teste de conexão). */
export const PROBE_TIMEOUT_MS = 20_000;

export type FetchOptions = RequestInit & { timeoutMs?: number };

export async function fetchWithTimeout(
  url: string | URL,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;
  return fetch(url as string, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Erro de rede com texto útil.
 *
 * `fetch` só lança 'fetch failed' em timeout/DNS/conexão recusada, o que não
 * ajuda a diagnosticar em qual fonte o problema está.
 */
export function describeNetworkError(err: unknown, context: string): string {
  const cause = (err as { cause?: { code?: string } })?.cause;
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `${context}: tempo limite excedido`;
  }
  if (cause?.code === 'ENOTFOUND') return `${context}: host não encontrado`;
  if (cause?.code === 'ECONNREFUSED') return `${context}: conexão recusada`;
  if (cause?.code === 'ETIMEDOUT') return `${context}: conexão expirou`;
  return `${context}: ${err instanceof Error ? err.message : String(err)}`;
}
