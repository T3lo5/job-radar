import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { redis } from '../db/redis.js';
import pino from 'pino';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const CACHE_TTL = 30;

const log = pino({ name: 'settings-service', level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Versão do formato do cache L2.
 *
 * O Redis guardava o valor JÁ DECIFRADO: quem tivesse acesso a backup, réplica
 * ou `redis-cli` lia API keys e token do Telegram em texto claro, anulando a
 * criptografia em repouso do Postgres. Agora segredo vai para o cache como
 * ciphertext (os mesmos campos do banco) e é decifrado só em memória, no uso.
 *
 * A versão no nome da chave invalida entradas do formato antigo por construção
 * e permite limpar o plaintext legado no boot (`purgeLegacyCache`).
 */
const CACHE_VERSION = 2;
const CACHE_PREFIX = `settings:v${CACHE_VERSION}:`;

/** Envelope do L2. Segredo nunca carrega o plaintext. */
interface CacheEntry {
  v: number;
  encrypted: boolean;
  /** Presente só quando `encrypted` é false. */
  value?: string;
  /** Ciphertext (AES-256-GCM), igual ao que está no Postgres. */
  ciphertext?: string;
  iv?: string;
  tag?: string;
}

function getKey(): Buffer {
  const keyBase64 = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    // Falha cedo e com mensagem acionável, em vez de "Invalid key length"
    // surgindo depois, na primeira gravação de um setting.
    throw new Error(
      `SETTINGS_ENCRYPTION_KEY deve ter 32 bytes (tem ${key.length}). ` +
        "Gere com: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  return key;
}

function encrypt(plaintext: string): { encryptedValue: string; iv: string; tag: string } {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decrypt(encryptedValue: string, iv: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export { encrypt, decrypt };

export class SettingsService {
  private memoryCache = new Map<string, { value: string; expires: number }>();

  /** Chave no Postgres (`Setting.key`). Mantida igual à do formato antigo. */
  private cacheKey(scope: string, key: string): string {
    return `settings:${scope}:${key}`;
  }

  /** Chave no Redis, versionada — não colide com o formato legado. */
  private redisKey(scope: string, key: string): string {
    return `${CACHE_PREFIX}${scope}:${key}`;
  }

  /** Valor de uso a partir da linha do banco (decifra se necessário). */
  private valueOf(setting: {
    value: string;
    encrypted: boolean;
    encryptedValue: string | null;
    iv: string | null;
    tag: string | null;
  }): string {
    if (setting.encrypted && setting.encryptedValue && setting.iv && setting.tag) {
      try {
        return decrypt(setting.encryptedValue, setting.iv, setting.tag);
      } catch {
        // Chave de criptografia trocada/corrompida: devolve o placeholder em
        // vez de derrubar o boot. Chamadas que dependem do segredo falham alto.
        return setting.value;
      }
    }
    return setting.value;
  }

  /**
   * Serializa para o Redis sem plaintext de segredo.
   *
   * Segredo vira `{ encrypted: true, ciphertext, iv, tag }`; o resto vira
   * `{ encrypted: false, value }`. A decisão é do banco (`Setting.encrypted`),
   * não de quem chamou `set` — uma linha gravada antes desta mudança continua
   * sendo tratada como segredo.
   */
  private encodeCacheEntry(setting: {
    value: string;
    encrypted: boolean;
    encryptedValue: string | null;
    iv: string | null;
    tag: string | null;
  }): string {
    if (setting.encrypted && setting.encryptedValue && setting.iv && setting.tag) {
      const entry: CacheEntry = {
        v: CACHE_VERSION,
        encrypted: true,
        ciphertext: setting.encryptedValue,
        iv: setting.iv,
        tag: setting.tag,
      };
      return JSON.stringify(entry);
    }

    const entry: CacheEntry = { v: CACHE_VERSION, encrypted: false, value: setting.value };
    return JSON.stringify(entry);
  }

  /** Decodifica uma entrada do L2. `null` = formato desconhecido, ler do banco. */
  private decodeCacheEntry(raw: string): string | null {
    let entry: CacheEntry;
    try {
      entry = JSON.parse(raw) as CacheEntry;
    } catch {
      return null;
    }

    if (!entry || entry.v !== CACHE_VERSION) return null;

    if (!entry.encrypted) {
      return typeof entry.value === 'string' ? entry.value : null;
    }

    if (!entry.ciphertext || !entry.iv || !entry.tag) return null;
    try {
      return decrypt(entry.ciphertext, entry.iv, entry.tag);
    } catch {
      return null;
    }
  }

  async get(scope: string, key: string): Promise<string | null> {
    const cacheKey = this.cacheKey(scope, key);
    const redisKey = this.redisKey(scope, key);

    // L1: memory cache (processo local; plaintext só existe em memória)
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.value;
    }

    // L2: Redis cache — para segredo, apenas ciphertext
    try {
      const redisCached = await redis.get(redisKey);
      if (redisCached) {
        const decoded = this.decodeCacheEntry(redisCached);
        if (decoded !== null) {
          this.memoryCache.set(cacheKey, {
            value: decoded,
            expires: Date.now() + CACHE_TTL * 1000,
          });
          return decoded;
        }
        // Formato antigo/corrompido: descarta para não reler lixo.
        await redis
          .del(redisKey)
          .catch((err) =>
            log.warn({ err, scope, key, redisKey }, 'erro ao deletar chave corrompida do Redis'),
          );
      }
    } catch (err) {
      // Redis unavailable, continue to DB (L3). Log para observabilidade.
      log.warn({ err, scope, key, redisKey }, 'Redis indisponível no get; fallback para Postgres');
    }

    // L3: Database
    const setting = await prisma.setting.findUnique({
      where: { key: cacheKey },
    });

    if (!setting) return null;

    const value = this.valueOf(setting);

    // Populate caches
    this.memoryCache.set(cacheKey, {
      value,
      expires: Date.now() + CACHE_TTL * 1000,
    });
    try {
      await redis.setex(redisKey, CACHE_TTL, this.encodeCacheEntry(setting));
    } catch (err) {
      // Redis unavailable
      log.warn({ err, scope, key, redisKey }, 'Redis indisponível ao gravar cache; segue sem L2');
    }

    return value;
  }

  async set(scope: string, key: string, value: string, isSecret = false): Promise<void> {
    const cacheKey = this.cacheKey(scope, key);

    if (isSecret) {
      const { encryptedValue, iv, tag } = encrypt(value);
      await prisma.setting.upsert({
        where: { key: cacheKey },
        update: {
          value: '********',
          scope,
          encrypted: true,
          encryptedValue,
          iv,
          tag,
        },
        create: {
          key: cacheKey,
          value: '********',
          scope,
          encrypted: true,
          encryptedValue,
          iv,
          tag,
        },
      });
    } else {
      await prisma.setting.upsert({
        where: { key: cacheKey },
        update: { value, scope, encrypted: false },
        create: { key: cacheKey, value, scope, encrypted: false },
      });
    }

    // Invalidate caches. A chave legada (sem versão) também é apagada: ela
    // podia conter o valor em texto claro de antes desta correção.
    this.memoryCache.delete(cacheKey);
    try {
      await redis.del(this.redisKey(scope, key), cacheKey);
    } catch (err) {
      // Redis unavailable
      log.warn(
        { err, scope, key, redisKey: this.redisKey(scope, key) },
        'Redis indisponível ao invalidar cache; valor expira pelo TTL',
      );
    }
  }

  /**
   * Remove do Redis as chaves do formato antigo, que guardavam valores já
   * decifrados. Chamado no boot (ticket 23) para não deixar plaintext de
   * segredo em backup/réplica depois do deploy.
   *
   * Usa `SCAN`, não `KEYS`: não bloqueia o Redis mesmo com muitas chaves.
   */
  async purgeLegacyCache(): Promise<number> {
    let cursor = '0';
    let removidas = 0;

    do {
      const [proximo, chaves] = await redis.scan(cursor, 'MATCH', 'settings:*', 'COUNT', 100);
      cursor = proximo;
      const legadas = chaves.filter((chave) => !chave.startsWith(CACHE_PREFIX));
      if (legadas.length > 0) {
        removidas += await redis.del(...legadas);
      }
    } while (cursor !== '0');

    return removidas;
  }

  async getAll(scope: string): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany({
      where: { scope },
    });

    const result: Record<string, string> = {};
    for (const setting of settings) {
      const shortKey = setting.key.replace(`settings:${scope}:`, '');
      if (setting.encrypted) {
        result[shortKey] = '********';
      } else {
        result[shortKey] = setting.value;
      }
    }
    return result;
  }

  async getCompletion(): Promise<{ completed: boolean; completedAt: Date | null }> {
    const meta = await prisma.settingMeta.findFirst();
    return {
      completed: meta?.completedAt != null,
      completedAt: meta?.completedAt ?? null,
    };
  }

  async markCompleted(): Promise<void> {
    const meta = await prisma.settingMeta.findFirst();
    if (meta) {
      await prisma.settingMeta.update({
        where: { id: meta.id },
        data: { completedAt: new Date() },
      });
    } else {
      await prisma.settingMeta.create({
        data: { completedAt: new Date() },
      });
    }
  }
}

export const settingsService = new SettingsService();
