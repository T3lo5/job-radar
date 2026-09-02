# 41 — Settings via UI (wizard + página /settings)

## Question

Conforme ADR-0005, quatro escopos de configuração saem do `.env` e ganham UI:

- `ai` (provider, API key, model, prompt custom)
- `telegram` (bot token, chat ID)
- `cron` (horários)
- `sources.*` (credenciais por fonte habilitada)

Decisões a tomar:

- **Tabela `settings`**: schema (id, scope, key, value, is_secret, encrypted_value, iv, tag, created_at, updated_at)
- **Criptografia**: AES-256-GCM com `SETTINGS_ENCRYPTION_KEY` do `.env`. IV aleatório por valor, armazenado junto. Implementação: `node:crypto` puro (sem libs extras)
- **SettingsService** (backend):
  - `get(scope, key)`: lê cache (memória → Redis → DB), descriptografa se `is_secret`
  - `set(scope, key, value, isSecret)`: criptografa se secret, salva, invalida Redis + memória
  - `getAll(scope)`: retorna objeto com settings do escopo
  - `getCompletion()`: retorna `completed_at` (singleton em `meta`)
- **Cache multi-instance**: Redis key `settings:<scope>:<key>` com TTL 30s; cache em memória por processo como L1
- **Wizard de primeiro boot** (`/setup`):
  - Frontend: se `GET /api/setup/status` retorna `{ completed: false }`, redireciona para `/setup`
  - Passos: 1) IA, 2) Telegram (opcional pular), 3) Cron, 4) Fontes (opcional pular), 5) Concluir
  - `POST /api/setup/complete` marca `settings.completed_at = now()`
- **Tela `/settings`**: sempre acessível. Mostra valores existentes (secretos como `••••••••`), permite editar, valida com Zod
- **Settings Completion Gate** (middleware Fastify): se `!completed_at`, só permite `/health` e `/api/setup/*`. Demais rotas retornam 503 com hint
- **Frontend**: react-hook-form + zod; páginas `/setup` e `/settings`; hook `useSettings()` (TanStack Query) para ler/escrever
- **Tipos compartilhados** em `@job-radar/shared`: `SettingScope`, `SettingKey<T>`, `SettingsCompletionStatus`, `SettingsByScope`

## Blocked by

07 (precisa do schema de settings), 10 (precisa da infra de API/validação)

## Type

task

## Status

partial

## Resolution (Backend completo)

**Criptografia AES-256-GCM** (`apps/api/src/services/settings-service.ts`):
- IV aleatório por valor (16 bytes)
- Auth tag armazenado junto
- `SETTINGS_ENCRYPTION_KEY` do `.env` (32 bytes base64)

**SettingsService** com cache multi-instance:
- L1: memória (TTL 30s)
- L2: Redis (TTL 30s)
- L3: PostgreSQL
- `get(scope, key)`, `set(scope, key, value, isSecret)`, `getAll(scope)`, `getCompletion()`, `markCompleted()`

**Endpoints:**
- `GET /api/setup/status` — `{ completed, completedAt }`
- `POST /api/setup/ai` — provider, apiKey, model, customPrompt
- `POST /api/setup/telegram` — botToken, chatId
- `POST /api/setup/cron` — jobCollectionCron, dailyReportCron
- `POST /api/setup/complete` — marca completedAt
- `GET /api/settings/:scope` — lista settings do escopo
- `POST /api/settings` — seta um setting (secret ou não)

**Settings Completion Gate** (`plugins/settings-gate.ts`):
- Bloqueia `/api/*` se `!completed_at`
- Permite `/health`, `/health/ready`, `/match`, `/api/setup/*`

**Migration:** `settings_encryption` (adicionou encrypted_value, iv, tag em settings + tabela setting_meta)

**Pendente (Frontend):**
- Páginas `/setup` (wizard) e `/settings`
- Hook `useSettings()` com TanStack Query
- Formulários react-hook-form + zod

**Validação:**
- `pnpm typecheck` ✓
- Migration aplicada com sucesso
