import { Redis, type RedisOptions } from 'ioredis';

/**
 * Conexão para o BullMQ a partir do REDIS_URL completo.
 *
 * A versão anterior montava `{ host, port }` a partir de `new URL(...)`, o que
 * jogava fora senha, database e TLS. Com `redis://:senha@host:6380/1` a
 * conexão simplesmente falhava — e, pior, falhava tarde e sem mensagem clara.
 *
 * `maxRetriesPerRequest: null` é exigência do BullMQ: com o default do ioredis
 * (20), um job lento estouraria MaxRetriesPerRequestError no meio da execução.
 */

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export function redisConnectionOptions(): RedisOptions {
  return {
    ...new Redis(REDIS_URL).options,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function redisConnection(): RedisOptions {
  return redisConnectionOptions();
}

/**
 * Ajuste de lock para jobs longos.
 *
 * O default do BullMQ é lockDuration de 30s. Uma coleta que faz scraping com
 * delay de 2-8s por página passa disso fácil: o lock expira, o BullMQ acha que
 * o worker morreu e re-executa o job — pagando a IA de novo. 3 minutos dá
 * folga sem deixar job travado ocupar a fila.
 */
export const WORKER_LOCK_OPTIONS = {
  lockDuration: 180_000,
  stalledInterval: 60_000,
  maxStalledCount: 2,
} as const;
