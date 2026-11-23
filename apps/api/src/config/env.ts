import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_HOST: z.string().default('0.0.0.0'),

  // URL pública do dashboard, usada nos links enviados pelo Telegram. Sem ela,
  // o bot omite o link em vez de mandar `localhost`, que não abre no celular.
  // Pode ser sobrescrita pelo setting `app.publicUrl`.
  APP_PUBLIC_URL: z.string().url().optional(),

  // Origens do dashboard liberadas no CORS (separadas por vírgula). Obrigatório
  // em produção: com `credentials`, refletir qualquer origem permite CSRF.
  CORS_ORIGINS: z.string().optional(),

  // Número de proxies confiáveis à frente da API (`1` = um nginx). Sem isso o
  // rate limit usa o IP do proxy e todos compartilham o mesmo bucket.
  TRUST_PROXY: z.string().default('false'),

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

  // Cadastro público. Default `false`: o produto é single-user e a primeira
  // conta é criada pelo setup. `true` reabre /api/auth/signup (testes, uso
  // multi-conta). Ver `docs/agents` e o ticket 01 da auditoria de 2026-10-28.
  ALLOW_SIGNUP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
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
