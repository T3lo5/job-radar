# 08 — Migrations e seed mínimo

## Question

Configurar ferramenta de migrations (Prisma migrate ou drizzle-kit). Criar migration inicial com o schema. Criar seed mínimo: 1 perfil fictício para testes locais, lista de skills base (Node.js, React, TypeScript, etc.) para autocomplete. Comando `pnpm db:seed`.

## Type

task

## Status

done

## Resolution

**Migration:** Já criada no #07 (`init_full_schema`), aplicada com sucesso.

**Seed (`prisma/seed.ts`):**
- 95 skills base categorizados (languages, frontend, backend, mobile, css, state, testing, database, cloud, devops, api, auth, tools, concepts)
- 1 usuário demo (`demo@jobradar.local`) com perfil completo:
  - Senioridade, localização, preferência remote, pretensão salarial
  - 8 skills com nível e anos de experiência
  - Idiomas (Português nativo, Inglês avançado)
  - Educação (USP - Ciência da Computação)
  - Certificação (AWS Solutions Architect)
  - 1 projeto de exemplo
- Seed é idempotente (upsert em skills, skip se usuário existe)

**Scripts:**
- `pnpm --filter @job-radar/api db:seed` — roda o seed via tsx

**Validação:**
- `pnpm typecheck` ✓
- `pnpm db:seed` executou com sucesso (95 skills + 1 usuário demo)
- Seed idempotente verificado (2ª execução skipa usuário existente)
