import { PrismaClient } from '../generated/prisma/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Log de query fora de produção, mas desligado em teste.
 *
 * A condição anterior era só `NODE_ENV === 'production'`, então a suíte despejava
 * cada statement executado — com os testes de integração contra Postgres, a
 * saída virou centenas de linhas e o que importava (a asserção que falhou)
 * ficava buried nela.
 */
const silencioso = process.env.NODE_ENV === 'production' || process.env.VITEST === 'true';

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log: silencioso ? ['error'] : ['query', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production' && !process.env.VITEST) {
  globalThis.__prisma = prisma;
}
