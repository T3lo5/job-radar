import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_HOST: z.string().default('0.0.0.0'),

  SETTINGS_ENCRYPTION_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env | null = null

export function getEnv(): Env {
  if (validatedEnv) return validatedEnv

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment variables:\n${errors}\n\nCheck your .env file.`,
    )
  }

  validatedEnv = result.data
  return validatedEnv
}
