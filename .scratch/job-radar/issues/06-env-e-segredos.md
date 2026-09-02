# 06 — Variáveis de ambiente mínimas (somente o crítico)

## Question

Conforme ADR-0005, o `.env` guarda **apenas** o que é crítico e imutável sem restart: connection strings, portas, NODE_ENV e a chave mestra de criptografia. Tudo o que o usuário pode querer ajustar dinamicamente (IA, Telegram, Cron, credenciais de fontes) **NÃO** fica aqui — vai para a tabela `settings` editável pela UI (→ #41).

Decisões deste ticket:

- Quais variáveis ficam no `.env` (mínimo viável)
- Como gerar e proteger `SETTINGS_ENCRYPTION_KEY` (32 bytes base64)
- Documentação no `.env.example` agrupada por seção
- Validação Zod na boot da API: falha rápido se faltar variável crítica
- `.env` no `.gitignore` desde o primeiro commit (já está)
- `.env.example` commitado, sem valores reais

## Type

task

## Status

done

## Resolution

**Validação Zod na boot** (`apps/api/src/config/env.ts`):
```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  APP_PORT: z.coerce.number().int().min(1).max(65535),
  APP_HOST: z.string(),
  SETTINGS_ENCRYPTION_KEY: z.string().min(1),
})
```

**Comportamento:**
- `getEnv()` valida no boot (falha rápido com mensagem clara)
- Cache do resultado validado
- Usado no server.ts para PORT, HOST, LOG_LEVEL

**Validação:**
- `pnpm typecheck` ✓
