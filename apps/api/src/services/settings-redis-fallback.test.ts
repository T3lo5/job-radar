import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import { SettingsService } from './settings-service.js';

/**
 * Ticket 43: o SettingsService deve degradar graciosamente quando o Redis
 * cai, fazendo fallback para Postgres (L3) sem quebrar a aplicação.
 */
const prisma = new PrismaClient({ log: ['error'] });

const SCOPE = 'ticket43';
const KEY = 'apiKey';
const PLAINTEXT = 'sk-teste-fallback-redis-123';

const DB_KEY = `settings:${SCOPE}:${KEY}`;

process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

// Mock do Redis que sempre lança erro (simula Redis indisponível).
vi.mock('../db/redis.js', () => ({
  redis: {
    get: vi.fn(() => {
      throw new Error('ECONNREFUSED');
    }),
    setex: vi.fn(() => {
      throw new Error('ECONNREFUSED');
    }),
    del: vi.fn(() => {
      throw new Error('ECONNREFUSED');
    }),
    scan: vi.fn(() => ['0', []]),
  },
}));

async function limpar() {
  await prisma.setting.deleteMany({ where: { key: { startsWith: `settings:${SCOPE}:` } } });
}

beforeAll(async () => {
  await prisma.$connect();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await limpar();
  vi.clearAllMocks();
});

describe('SettingsService com Redis indisponível', () => {
  it('get faz fallback para Postgres quando Redis falha', async () => {
    // Grava direto no banco (sem passar pelo cache, que usaria Redis).
    await prisma.setting.create({
      data: {
        key: DB_KEY,
        scope: SCOPE,
        value: PLAINTEXT,
        encrypted: false,
        encryptedValue: null,
        iv: null,
        tag: null,
      },
    });

    const service = new SettingsService();
    const valor = await service.get(SCOPE, KEY);

    expect(valor).toBe(PLAINTEXT);
  });

  it('set grava no Postgres mesmo quando Redis falha', async () => {
    const service = new SettingsService();
    await expect(service.set(SCOPE, 'novaChave', 'valorNaoSecreto')).resolves.toBeUndefined();

    // O valor deve estar no banco.
    const linha = await prisma.setting.findUnique({
      where: { key: `settings:${SCOPE}:novaChave` },
    });
    expect(linha).toBeDefined();
    expect(linha?.value).toBe('valorNaoSecreto');
    expect(linha?.encrypted).toBe(false);
  });

  it('get retorna null quando a chave não existe e Redis está down', async () => {
    const service = new SettingsService();
    const valor = await service.get(SCOPE, 'naoExiste');
    expect(valor).toBeNull();
  });
});
