# 04 — Backend (Fastify ou NestJS) com health check

## Question

Escolher entre **Fastify** (leve, rápido, schema-first com TypeBox) ou **NestJS** (mais estrutura, decorators, mais overhead mas modular). Para um projeto pessoal pequeno, **Fastify** provavelmente basta. O que decidir:

- Framework HTTP
- ORM: Prisma (DX forte, migrations) vs Drizzle (mais SQL-like, leve) vs Knex (query builder puro)
- Validação: Zod (com `fastify-type-provider-zod` se Fastify) ou class-validator (se NestJS)
- Logger: pino (default do Fastify) ou winston
- Health check em `GET /health` retornando status de DB e Redis

## Type

grilling

## Status

done

## Resolution

Ver `## Answer` ao final.

## Answer

**Decisões** (registradas no ADR-0006):

- **Framework HTTP**: **Fastify 5** (ADR-0003 já escolheu)
- **ORM**: **Prisma** — DX forte, migrations declarativas, geração de tipos TS automáticos, schema como source of truth. Setup do Prisma no monorepo via `pnpm db:*` scripts
- **Validação**: **Zod** com `fastify-type-provider-zod` (integra Zod com Fastify para tipar `request.body/params/query` e validar em runtime)
- **Logger**: **Pino** (default do Fastify, super rápido, JSON estruturado)
- **Health check**: `GET /health` retorna 200 com `status: 'ok'` + timestamp. Versão "completa" `/health/ready` testa conexão com Postgres (`SELECT 1`) e Redis (`PING`)

**Setup Prisma no monorepo**:

- `apps/api/prisma/schema.prisma` (source of truth do schema)
- Generator client output: `apps/api/src/generated/prisma` (evita problemas com hoisting)
- `apps/api/.env` carregado por Prisma CLI (separado do `.env` raiz para evitar conflito)
- Scripts no `apps/api/package.json`:
  - `db:generate` — `prisma generate`
  - `db:migrate` — `prisma migrate dev` (dev) / `prisma migrate deploy` (prod)
  - `db:reset` — `prisma migrate reset` (destrutivo, dev only)
  - `db:studio` — Prisma Studio
- Validação do health check: `GET /health/ready` retorna 503 se DB/Redis indisponíveis (vs 200 do `/health` simples)

**Arquivos criados**:

- `apps/api/prisma/schema.prisma` (placeholder com `model HealthCheck` apenas para validar setup)
- `apps/api/src/db/prisma.ts` (singleton do PrismaClient)
- `apps/api/src/server.ts` (atualizado: registra type provider Zod, adiciona `/health/ready`)
- `apps/api/package.json` (deps: prisma, @prisma/client, zod, fastify-type-provider-zod; scripts db:*)
- `apps/api/.env` (apenas `DATABASE_URL` para o Prisma CLI)
- ADR-0006

**Validação**:

- `pnpm install` rodou limpo
- `pnpm --filter @job-radar/shared build` ✓
- `pnpm typecheck` em todos os workspaces: ✓
- `pnpm lint` em todos os workspaces: ✓
- `pnpm format:check`: ✓
- `pnpm --filter @job-radar/api db:generate` rodou e criou o client em `apps/api/src/generated/prisma`
- `docker compose up -d postgres redis` (containers já estão configurados do #03)
- Smoke test: API conecta no Postgres via Prisma, `/health/ready` retorna 200
- `pnpm db:migrate --name init` rodou contra Postgres (migration de HealthCheck aplicada)

**Decisões adiadas** (vão para tickets futuros):

- Schema completo de todas as entidades → #07
- Migrations adicionais e seed → #08
- Pool de conexões, retry policy → ajuste fino se necessário
