# 02 — Configurar TypeScript, ESLint, Prettier

## Question

Definir config base compartilhada: `tsconfig.base.json` com `strict: true`, `target: ES2022`, `moduleResolution: bundler`. ESLint com `@typescript-eslint`, Prettier single quote + 100 cols. Onde ficam: raiz, ou `packages/typescript-config` + `packages/eslint-config` reutilizados pelos apps?

## Type

task

## Status

resolved

## Resolution

Ver `## Answer` ao final.

## Answer

**Decisões**:

- **TypeScript**: base já existe em `packages/typescript-config/base.json` (criado no #01). Adicionados variantes por contexto: `node.json` (Node 20), `react.json` (JSX + DOM), `react-library.json`.
- **ESLint**: base já existe em `packages/eslint-config/base.js` (criado no #01). Adicionado `node.js` (com regra para `no-process-env` warning) e `react.js` (com `eslint-plugin-react` e `react-hooks`).
- **Prettier**: config única na raiz (`.prettierrc.json`) + `.prettierignore`. Single quote, 100 cols, trailing comma all, semicolons, LF.
- **ESLint <-> Prettier**: `eslint-config-prettier` no preset `prettier.js` para desabilitar regras do ESLint que conflitam com Prettier.
- **Hooks locais**: Husky + lint-staged para rodar lint+format em pre-commit. Configurável mas opcional (não bloqueia).
- **Lint script**: `pnpm lint` na raiz itera todos os workspaces.

**Arquivos criados/alterados**:

- `packages/typescript-config/{base,node,react,react-library}.json` + `package.json` (atualizado)
- `packages/eslint-config/{base,node,react,prettier}.js` + `package.json` (atualizado deps)
- `.prettierrc.json`, `.prettierignore`
- `apps/api/eslint.config.js` (consome `@job-radar/eslint-config/node`)
- `apps/web/eslint.config.js` (consome `@job-radar/eslint-config/react` + `prettier`)
- `apps/api/package.json` (deps de eslint, scripts lint/format)
- `apps/web/package.json` (mesmo)
- `packages/shared/eslint.config.js` (consome base)
- `package.json` raiz (script `lint` funcional)
- `.husky/pre-commit` + `lint-staged` config no package.json raiz

**Validação**:

- `pnpm install` rodou limpo
- `pnpm typecheck` em todos os workspaces: ✓
- `pnpm lint` em todos os workspaces: ✓ (0 erros, 0 warnings)
- `pnpm format --check` em todo o repo: ✓
- Husky hooks detectam staged changes (smoke test OK)
- Smoke test: criar arquivo deliberadamente mal-formatado, `pnpm format` corrige, `pnpm lint` aceita

**Não inclui** (decisões adiada em tickets próprios):

- CI rodando lint/typecheck (→ #09)
- Tests (→ #37, #38)
