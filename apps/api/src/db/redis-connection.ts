import type { RedisOptions } from 'ioredis';

/**
 * Conexão para o BullMQ a partir do REDIS_URL completo.
 *
 * A versão anterior montava `{ host, port }` a partir de `new URL(...)`, o que
 * jogava fora senha, database e TLS. Com `redis://:senha@host:6380/1` a
 * conexão simplesmente falhava — e, pior, falhava tarde e sem mensagem clara.
 *
 * Corrigir isso com `new Redis(URL).options` resolveu o parse e criou outro
 * problema: cada chamada instanciava um cliente ioredis de verdade, que abre
 * socket, entra na fila de reconexão e nunca é fechado. As filas chamam esta
 * função no boot e os workers a cada job — eram conexões vazando para sempre.
 * Agora as opções são derivadas da URL, sem cliente nenhum.
 *
 * `maxRetriesPerRequest: null` é exigência do BullMQ: com o default do ioredis
 * (20), um job lento estouraria MaxRetriesPerRequestError no meio da execução.
 */

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/** Converte a URL em opções do ioredis, sem instanciar cliente. */
export function parseRedisUrlOptions(rawUrl: string): RedisOptions {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      `REDIS_URL inválida: "${rawUrl}". Use o formato redis://[:senha@]host[:porta][/db].`,
    );
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error(
      `REDIS_URL com protocolo inesperado: "${url.protocol}". Use redis:// ou rediss://.`,
    );
  }

  const options: RedisOptions = {
    host: url.hostname || 'localhost',
    port: url.port ? Number(url.port) : 6379,
  };

  // `decodeURIComponent` porque a URL codifica senha com `@`/`:`.
  if (url.username) options.username = decodeURIComponent(url.username);
  if (url.password) options.password = decodeURIComponent(url.password);

  const db = url.pathname.replace(/^\//, '').trim();
  if (db !== '') {
    const database = Number(db);
    if (!Number.isInteger(database) || database < 0) {
      throw new Error(`REDIS_URL com database inválido: "${db}". Use um inteiro >= 0.`);
    }
    options.db = database;
  }

  if (url.protocol === 'rediss:') options.tls = {};

  return options;
}

export function redisConnectionOptions(
  rawUrl: string | undefined = process.env.REDIS_URL,
): RedisOptions {
  return {
    ...parseRedisUrlOptions(rawUrl || DEFAULT_REDIS_URL),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
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
