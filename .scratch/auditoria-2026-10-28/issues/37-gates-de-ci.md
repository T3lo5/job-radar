# 37 — Gates de CI: audit e drift de migrations

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: infra
Esforço: baixo
Bloqueado por: 06
Origem: [auditoria §3.6, §5.28, §8](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O CI roda lint, typecheck, format, build, smoke e testes — mas não impede regressão de segurança nem divergência de schema. Hoje há 67 vulnerabilidades (4 critical, 24 high) e duas migrations fora do git; nada disso quebra o build.

## Evidência

- `.github/workflows/ci.yml` — sem `pnpm audit` e sem checagem de drift.
- `pnpm audit` (2026-10-28) — 67 vulnerabilidades.
- `git status` — migrations untracked (ticket 06).

## Correção

1. `pnpm audit --audit-level high` como gate (começar informativo por 1 semana, depois bloqueante).
2. Checagem de drift: `prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` falha se schema e migrations divergirem.
3. Job que aplica migrations do zero em Postgres limpo antes dos testes.
4. Dependabot/Renovate já configurado: garantir agrupamento e revisão.
5. Publicar relatório de audit como artefato quando falhar.

## Critérios de aceite

- [ ] PR com vulnerabilidade high falha no CI.
- [ ] Alterar `schema.prisma` sem migration falha no CI.
- [ ] Banco limpo + migrations + testes passa no CI.
- [ ] Exceções ao audit ficam documentadas com justificativa e prazo.

## Testes

- PR de teste com dependência vulnerável (verificar falha).
- PR de teste com schema alterado sem migration (verificar falha).

## Comments
