# 01 — Criar repositório e monorepo

## Question

Como inicializar o monorepo? Decidir entre:

- `pnpm workspaces` (já com bom suporte, leve, lockfile determinístico)
- `npm workspaces` (zero dependências extras, mais verboso)
- `turborepo` (mais pesado, cache de build, faz sentido só se apps/backend-frontend realmente compartilharem build incremental)

TypeScript: configuração única compartilhada em `packages/typescript-config` ou inline por app?

Criar `apps/api`, `apps/web`, `packages/shared`.

## Type

task

## Status

resolved

## Resolution

Ver `## Answer` ao final.

## Answer

**Decisões tomadas** (baseadas no ADR-0002 já aceito):

- **Gerenciador de pacotes**: `pnpm` com workspaces
- **Estrutura**: `apps/api` (Node 20 + Fastify), `apps/web` (Vite + React), `packages/shared` (tipos e utilitários de domínio)
- **TypeScript config**: compartilhado em `packages/typescript-config`, estendido por cada app
- **ESLint/Prettier**: compartilhados em `packages/eslint-config`
- **Versão Node**: 20 LTS

**Arquivos criados**:

- `package.json` raiz (workspaces, scripts, devDeps)
- `pnpm-workspace.yaml`
- `.gitignore`
- `.npmrc` (configurações pnpm: shamefully-hoist, strict-peer-dependencies)
- `.editorconfig`
- `apps/api/package.json` (Node 20+, Fastify, TypeScript, Vitest)
- `apps/api/tsconfig.json` (extends do base)
- `apps/web/package.json` (React 18, Vite 5, TS)
- `apps/web/tsconfig.json` + `apps/web/index.html` (entry Vite)
- `apps/web/vite.config.ts`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts` (placeholder com tipos iniciais do `CONTEXT.md`: `Seniority`, `MatchLabel`, `MatchScore`, `JobProcessingStatus`, `ApplicationStatus`)
- `packages/typescript-config/base.json` + `package.json`
- `packages/eslint-config/base.js` + `package.json`
- `.nvmrc` (Node 20)
- `README.md` raiz (placeholder apontando para o roadmap em `.scratch/job-radar/map.md`)

**Validação**:

- `pnpm install` rodou e resolveu workspaces
- `pnpm --filter @job-radar/shared build` (tsc) passou
- `pnpm --filter @job-radar/web typecheck` (tsc --noEmit) passou
- `pnpm --filter @job-radar/api typecheck` (tsc --noEmit) passou

**O que NÃO foi feito** (fica para tickets seguintes):

- TSC config por app (extends) — feito
- ESLint/Prettier completos — só config base criada; regras finais vão no #02
- Docker, Postgres, Redis — #03
- Variáveis de ambiente — #06
