import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { prisma } from '../db/prisma.js'
import { redis } from '../db/redis.js'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const CACHE_TTL = 30

function getKey(): Buffer {
  const keyBase64 = process.env.SETTINGS_ENCRYPTION_KEY
  if (!keyBase64) {
    throw new Error('SETTINGS_ENCRYPTION_KEY is not set')
  }
  return Buffer.from(keyBase64, 'base64')
}

function encrypt(plaintext: string): { encryptedValue: string; iv: string; tag: string } {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()

  return {
    encryptedValue: encrypted,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

function decrypt(encryptedValue: string, iv: string, tag: string): string {
  const key = getKey()
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  let decrypted = decipher.update(encryptedValue, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

class SettingsService {
  private memoryCache = new Map<string, { value: string; expires: number }>()

  private cacheKey(scope: string, key: string): string {
    return `settings:${scope}:${key}`
  }

  async get(scope: string, key: string): Promise<string | null> {
    const cacheKey = this.cacheKey(scope, key)

    // L1: memory cache
    const memCached = this.memoryCache.get(cacheKey)
    if (memCached && memCached.expires > Date.now()) {
      return memCached.value
    }

    // L2: Redis cache
    try {
      const redisCached = await redis.get(cacheKey)
      if (redisCached) {
        this.memoryCache.set(cacheKey, {
          value: redisCached,
          expires: Date.now() + CACHE_TTL * 1000,
        })
        return redisCached
      }
    } catch {
      // Redis unavailable, continue to DB
    }

    // L3: Database
    const setting = await prisma.setting.findUnique({
      where: { key: cacheKey },
    })

    if (!setting) return null

    let value: string
    if (setting.encrypted && setting.encryptedValue && setting.iv && setting.tag) {
      try {
        value = decrypt(setting.encryptedValue, setting.iv, setting.tag)
      } catch {
        value = setting.value
      }
    } else {
      value = setting.value
    }

    // Populate caches
    this.memoryCache.set(cacheKey, {
      value,
      expires: Date.now() + CACHE_TTL * 1000,
    })
    try {
      await redis.setex(cacheKey, CACHE_TTL, value)
    } catch {
      // Redis unavailable
    }

    return value
  }

  async set(scope: string, key: string, value: string, isSecret = false): Promise<void> {
    const cacheKey = this.cacheKey(scope, key)

    if (isSecret) {
      const { encryptedValue, iv, tag } = encrypt(value)
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
      })
    } else {
      await prisma.setting.upsert({
        where: { key: cacheKey },
        update: { value, scope, encrypted: false },
        create: { key: cacheKey, value, scope, encrypted: false },
      })
    }

    // Invalidate caches
    this.memoryCache.delete(cacheKey)
    try {
      await redis.del(cacheKey)
    } catch {
      // Redis unavailable
    }
  }

  async getAll(scope: string): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany({
      where: { scope },
    })

    const result: Record<string, string> = {}
    for (const setting of settings) {
      const shortKey = setting.key.replace(`settings:${scope}:`, '')
      if (setting.encrypted) {
        result[shortKey] = '********'
      } else {
        result[shortKey] = setting.value
      }
    }
    return result
  }

  async getCompletion(): Promise<{ completed: boolean; completedAt: Date | null }> {
    const meta = await prisma.settingMeta.findFirst()
    return {
      completed: meta?.completedAt != null,
      completedAt: meta?.completedAt ?? null,
    }
  }

  async markCompleted(): Promise<void> {
    const meta = await prisma.settingMeta.findFirst()
    if (meta) {
      await prisma.settingMeta.update({
        where: { id: meta.id },
        data: { completedAt: new Date() },
      })
    } else {
      await prisma.settingMeta.create({
        data: { completedAt: new Date() },
      })
    }
  }
}

export const settingsService = new SettingsService()
