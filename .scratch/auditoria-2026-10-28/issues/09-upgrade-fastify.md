# 09 — Atualizar Fastify

Status: resolved
Sprint: 0
Prioridade: P0
Área: api
Esforço: baixo
Origem: [auditoria §3.6](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A versão instalada do Fastify está em faixa com advisory de *authentication bypass via malformed URLs* e *request validation bypass*. O produto depende de um hook global de autenticação, então o bypass atinge exatamente a defesa central.

## Evidência

- `apps/api/package.json` — `fastify@5.12.1`.
- `pnpm audit` (2026-10-28) — advisory corrigido em `5.12.2`.
- `apps/api/src/plugins/auth-guard.ts` — guarda global no hook.

## Correção

1. Subir Fastify e plugins oficiais (`@fastify/*`) para a menor versão corrigida compatível (`^5.12.2` ou superior).
2. Rodar `pnpm why fastify` para garantir que não há cópia duplicada/transitiva antiga.
3. Revisar changelog entre 5.12.1 e a versão alvo; ajustar hooks se houver breaking change.
4. Confirmar que `trustProxy`, body limit e validação continuam como esperado.

## Critérios de aceite

- [x] `pnpm why fastify` mostra apenas versão `>= 5.12.2`.
- [x] `pnpm test`, `pnpm typecheck` e `pnpm build` verdes.
- [x] Teste de autenticação continua rejeitando rotas protegidas sem sessão (incluindo URLs malformadas).
- [x] `pnpm audit` não reporta mais o advisory do Fastify.

## Testes

- Suíte de auth existente + casos de URL malformada (`//`, `%2e%2e`, barras duplicadas) contra rotas protegidas.

## Comments

- 2026-10-28 — Atualizado para `fastify@5.12.7` (menor faixa corrigida: `^5.12.7`). `pnpm why fastify` mostra uma única cópia em `apps/api`; `fastify-type-provider-zod` acompanha o peer.
  - Sem breaking change no intervalo 5.12.1 → 5.12.7; `trustProxy`, body limit e validadores seguem iguais.
  - Casos de URL malformada (`//api/profile`, `/api//profile`, `/api/profile/`, `/%2e%2e/api/profile`) cobertos em `plugins/authz.integration.test.ts`; nenhum responde 200 sem sessão.
  - `pnpm audit` não aponta mais advisory direto do Fastify. Restam avisos transitivos de `fast-uri` via `ajv` (fora do escopo deste ticket).
