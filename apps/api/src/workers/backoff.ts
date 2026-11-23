/**
 * Política de retry das filas do BullMQ.
 *
 * Antes: `attempts: 3` com `backoff` exponencial fixo (5s, 10s, 20s). Sem
 * jitter, jobs que falham juntos (provedor de IA fora, banco reiniciando)
 * voltam juntos — a rajada de retry bate no serviço que já estava sofrendo.
 *
 * O piso de 50% do intervalo também é proposital: com jitter uniforme entre 0
 * e o teto, um retry poderia acontecer quase imediatamente, quando a causa
 * provavelmente ainda está de pé.
 */

export const MAX_ATTEMPTS = 3;
export const BACKOFF_BASE_MS = 5_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** Tipo registrado nas filas; o cálculo real fica no worker. */
export const BACKOFF_TYPE = 'jitter';

export function backoffWithJitter(
  attemptsMade: number,
  random: () => number = Math.random,
): number {
  const attempt = Math.max(1, Math.floor(attemptsMade));
  const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (attempt - 1));
  const metade = exponential / 2;

  // Intervalo final entre 50% e 100% do exponencial.
  return Math.round(metade + random() * metade);
}

/** Opções do worker que ensinam o BullMQ a usar `BACKOFF_TYPE`. */
export const BACKOFF_WORKER_SETTINGS = {
  backoffStrategy: (attemptsMade: number) => backoffWithJitter(attemptsMade),
} as const;
