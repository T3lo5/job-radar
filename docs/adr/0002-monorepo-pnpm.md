# ADR 0002: Monorepo com pnpm workspaces

## Status

Aceito (2026-08-31, pendente decisão de ticket #01)

## Contexto

O projeto tem 2 apps (API e Web) e 1 package compartilhado (`shared` para tipos, constantes, lógica de domínio comum). Opções:

1. **pnpm workspaces** — leve, lockfile determinístico, bom para monorepos pequenos/médios
2. **npm workspaces** — zero deps extras, mais verboso
3. **Turborepo** — cache de build incremental, faz sentido em monorepos grandes com build times longos
4. **Yarn workspaces** — OK, mas pnpm é mais moderno

## Decisão

**pnpm workspaces** com estrutura `apps/*` e `packages/*`.

## Razões

- pnpm é mais rápido e eficiente em disco que npm/yarn
- Funciona bem com Docker (lockfile imutável)
- Suporte oficial a workspaces
- `turbo` pode ser adicionado depois se o build ficar lento
- Estrutura do roadmap já previa `apps/api`, `apps/web`, `packages/shared`

## Consequências

- Tudo em um único `package.json` raiz + `pnpm-workspace.yaml`
- `pnpm install` instala todas as deps
- `pnpm --filter api dev` roda só a API
- Tipos compartilhados vão em `packages/shared` (ex: `ScoreResult`, `MatchStatus`)
- TSConfig base compartilhado em `packages/typescript-config`
- ESLint base compartilhado em `packages/eslint-config`

## Alternativas consideradas

- **Turborepo**: descartado por enquanto, complexidade extra desnecessária para 2 apps
- **Repositórios separados**: descartado, perderíamos compartilhamento de tipos
