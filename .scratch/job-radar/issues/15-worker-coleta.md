# 15 — Worker de coleta (BullMQ + cron)

## Question

- BullMQ queue `job-collection`
- Cron job (BullMQ repeatable) agendado por `JOB_COLLECTION_CRON`
- Job dispara todas as `JobSource` habilitadas em paralelo
- Cada source retorna `RawJob[]` → normaliza → insere no banco com deduplicação (hash do conteúdo)
- Tratamento de erro por fonte: log + retry com backoff, não derruba a pipeline

Endpoint admin `POST /api/admin/collect-now` para forçar execução manual.

## Type

task

## Status

done

## Resolution

**BullMQ Queue** (`apps/api/src/workers/job-collection.ts`):
- Queue `job-collection` com retry (3 attempts, exponential backoff 5s)
- Worker com concurrency 1
- Cron schedule via `upsertJobScheduler` (padrão: `0 */6 * * *`)
- Cron expression configurável via `settings.cron.jobCollectionCron`

**Coleta de vagas:**
- Dispara todas as `JobSource` habilitadas em paralelo
- Keywords configuráveis via `settings.sources.keyword.*`
- Deduplicação por hash (sha256 de title|company|url)
- Tratamento de erro por fonte (log + continua pipeline)
- Insere jobs com status `RAW`

**Endpoints admin:**
- `POST /api/admin/collect-now` — execução manual síncrona
- `POST /api/admin/collect-async` — enfileira job BullMQ

**Startup:**
- Worker iniciado junto com a API
- Cron schedule configurado no boot

**Dependência:** `bullmq` (Redis-based queue)

**Validação:**
- `pnpm typecheck` ✓
