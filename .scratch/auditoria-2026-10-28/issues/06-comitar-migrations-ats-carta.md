# 06 — Commitar migrations de ATS e carta

Status: resolved
Sprint: 0
Prioridade: P0
Área: infra
Esforço: trivial
Origem: [auditoria §5.28](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Duas migrations necessárias para as features novas estão untracked no git. Quem clonar o repositório ou rodar o CI cria um schema sem `Application.atsUsed` e sem o novo `runType` de carta — as features quebram de forma silenciosa.

## Evidência

- `git status` — untracked:
  - `apps/api/prisma/migrations/20261027132408_add_application_ats_used/`
  - `apps/api/prisma/migrations/20261027132850_add_cover_letter_run_type/`
- `apps/api/prisma/schema.prisma` já referencia os campos.

## Correção

1. Revisar o SQL das duas migrations e confirmar que são aditivas e idempotentes na ordem correta.
2. `git add` das duas pastas e commitar junto com o código que depende delas (ou em commit próprio, desde que na mesma PR).
3. Rodar `pnpm --filter @job-radar/api db:deploy` em banco limpo para validar.
4. Adicionar drift check no CI (ticket 37).

## Critérios de aceite

- [x] `git status` limpo em relação às migrations.
- [x] Banco vazio + `db:deploy` cria todas as colunas e enums esperados.
- [ ] CI roda migrations do zero e os testes de ATS/carta passam.

## Testes

- Job de CI com Postgres limpo: `db:deploy` e suíte completa.

## Comments

- 2026-10-28 — Migrations preparadas e validadas.
  - `git add` feito nas três pastas (`ats_used`, `cover_letter_run_type`, `add_user_role`). Não houve commit: o repositório já tinha muito trabalho não commitado do usuário e o commit deve agrupar o código dependente.
  - Banco vazio `jobradar_sprint0_check` + `prisma migrate deploy`: todas as migrations aplicaram; `applications.ats_used` existe, `AiRunType` contém `COVER_LETTER` e `UserRole` contém `ADMIN`/`USER`. Banco temporário removido.
  - Drift check no CI fica no ticket 37.
