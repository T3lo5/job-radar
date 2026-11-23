import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import { redis } from '../db/redis.js';
import { SettingsService, settingsService } from './settings-service.js';

/**
 * Ticket 23: o cache L2 gravava o valor JÁ DECIFRADO no Redis.
 *
 * Quem tivesse acesso a backup, réplica ou `redis-cli` lia API key e token do
 * Telegram em texto claro — a criptografia em repouso do Postgres não servia
 * de nada. Estes testes inspecionam o Redis de verdade depois de ler um
 * segredo: o plaintext não pode estar lá.
 */
const prisma = new PrismaClient({ log: ['error'] });

const SCOPE = 'ticket23';
const KEY = 'apiKey';
const PLAINTEXT = 'sk-super-secreto-que-nao-pode-vazar-123';
const NOVO_SEGREDO = 'sk-rotacionado-456';

const DB_KEY = `settings:${SCOPE}:${KEY}`;
const REDIS_KEY = `settings:v2:${SCOPE}:${KEY}`;

// `getKey()` lê o env na hora do uso. Força uma chave válida (32 bytes em
// base64) porque o `.env` local de teste pode não ter uma — e o teste não pode
// depender da configuração de quem roda.
process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

async function chavesDoCache(): Promise<string[]> {
  const chaves: string[] = [];
  let cursor = '0';
  do {
    const [proximo, lote] = await redis.scan(cursor, 'MATCH', 'settings:*', 'COUNT', 1000);
    cursor = proximo;
    chaves.push(...lote);
  } while (cursor !== '0');
  return chaves;
}

async function valoresDoCache(): Promise<Record<string, string>> {
  const chaves = await chavesDoCache();
  if (chaves.length === 0) return {};
  const valores = await redis.mget(...chaves);
  return Object.fromEntries(
    chaves.map((chave, i) => [chave, valores[i] ?? '']).filter(([, valor]) => valor !== ''),
  );
}

async function limpar() {
  await prisma.setting.deleteMany({ where: { key: { startsWith: `settings:${SCOPE}:` } } });
  const chaves = await chavesDoCache();
  const doEscopo = chaves.filter((chave) => chave.includes(`${SCOPE}:`));
  if (doEscopo.length > 0) await redis.del(...doEscopo);
}

beforeAll(async () => {
  await prisma.$connect();
  await redis.ping();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpar();
  await settingsService.set(SCOPE, KEY, PLAINTEXT, true);
});

describe('settings secretos no cache L2', () => {
  it('depois de ler o segredo, o Redis não contém o plaintext', async () => {
    const lido = await settingsService.get(SCOPE, KEY);
    expect(lido).toBe(PLAINTEXT);

    const cache = await valoresDoCache();
    expect(cache[REDIS_KEY]).toBeDefined();

    // Nem no valor direto, nem em qualquer chave do escopo: a varredura pega
    // também uma eventual chave legada (sem versão) que ainda restasse.
    for (const valor of Object.values(cache)) {
      expect(valor).not.toContain(PLAINTEXT);
    }

    // O Redis guarda o ciphertext do banco, não o texto de uso.
    expect(cache[REDIS_KEY]).toContain('"encrypted":true');
    expect(cache[REDIS_KEY]).not.toContain('"value"');

    // E o Postgres continua com o placeholder, nunca com o segredo.
    const linha = await prisma.setting.findUnique({ where: { key: DB_KEY } });
    expect(linha?.value).toBe('********');
    expect(linha?.encrypted).toBe(true);
  });

  it('o segredo volta correto a partir do ciphertext do cache', async () => {
    // Primeiro lê com o singleton, populando o L2; uma instância nova começa
    // com L1 vazio e tem de decifrar a entrada do Redis.
    expect(await settingsService.get(SCOPE, KEY)).toBe(PLAINTEXT);

    const outraInstancia = new SettingsService();
    expect(await outraInstancia.get(SCOPE, KEY)).toBe(PLAINTEXT);
  });

  it('salvar de novo invalida o cache (L1 e L2)', async () => {
    expect(await settingsService.get(SCOPE, KEY)).toBe(PLAINTEXT);

    await settingsService.set(SCOPE, KEY, NOVO_SEGREDO, true);

    // Mesmo processo e instância nova: nenhum dos dois pode devolver o antigo.
    expect(await settingsService.get(SCOPE, KEY)).toBe(NOVO_SEGREDO);
    expect(await new SettingsService().get(SCOPE, KEY)).toBe(NOVO_SEGREDO);

    const cache = await valoresDoCache();
    expect(cache[REDIS_KEY]).toBeDefined();
    expect(cache[REDIS_KEY]).not.toContain(NOVO_SEGREDO);
  });

  it('configuração não secreta continua cacheada em claro', async () => {
    await settingsService.set(SCOPE, 'cron', '0 6 * * *');
    expect(await settingsService.get(SCOPE, 'cron')).toBe('0 6 * * *');

    const cache = await valoresDoCache();
    const chave = `settings:v2:${SCOPE}:cron`;
    expect(cache[chave]).toContain('0 6 * * *');
    expect(cache[chave]).toContain('"encrypted":false');
  });
});

describe('purgeLegacyCache', () => {
  it('apaga chaves do formato antigo e preserva o formato versionado', async () => {
    // Popula o L2 versionado.
    await settingsService.get(SCOPE, KEY);
    expect(await redis.exists(REDIS_KEY)).toBe(1);

    // Simula o cache antigo, que guardava o valor decifrado.
    await redis.set(DB_KEY, PLAINTEXT);

    const removidas = await settingsService.purgeLegacyCache();

    expect(removidas).toBeGreaterThanOrEqual(1);
    expect(await redis.get(DB_KEY)).toBeNull();
    // A chave nova não é tocada: só o plaintext legado vai embora.
    expect(await redis.exists(REDIS_KEY)).toBe(1);
  });

  it('sem chaves legadas, não remove nada do formato novo', async () => {
    await settingsService.get(SCOPE, KEY);

    const removidas = await settingsService.purgeLegacyCache();

    expect(removidas).toBe(0);
    expect(await redis.exists(REDIS_KEY)).toBe(1);
  });
});
