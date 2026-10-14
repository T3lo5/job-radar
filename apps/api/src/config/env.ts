import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_HOST: z.string().default('0.0.0.0'),

  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .min(1)
    // AES-256-GCM exige chave de exatamente 32 bytes. Sem esta validação, uma
    // chave de tamanho errado só estoura no primeiro `createCipheriv`, com um
    // "Invalid key length" opaco, no meio de um setup que parecia ter funcionado.
    .refine((v) => Buffer.from(v, 'base64').length === 32, {
      message:
        'SETTINGS_ENCRYPTION_KEY deve ser base64 com 32 bytes. Gere com: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    }),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function getEnv(): Env {
  if (validatedEnv) return validatedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${errors}\n\nCheck your .env file.`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}
