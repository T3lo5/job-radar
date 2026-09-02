import { Redis } from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function buildRedis(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

export const redis: Redis = globalThis.__redis ?? buildRedis();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis = redis;
}
