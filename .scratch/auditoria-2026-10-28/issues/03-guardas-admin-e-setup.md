# 03 — Guardas de admin e setup

Status: resolved
Sprint: 0
Prioridade: P0
Área: api
Esforço: baixo
Origem: [auditoria §3.1](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O hook de autenticação só verifica se existe sessão. Não verifica papel. Com isso, qualquer conta autenticada acessa `/api/admin/*` e `/api/setup/*`, incluindo troca de provedor de IA, base URL e chat do Telegram — o que permite redirecionar CVs e descrições para um host controlado pelo atacante.

## Evidência

- `apps/api/src/plugins/auth-guard.ts` — valida sessão e libera tudo.
- `apps/api/src/routes/setup.ts:44-62` — escrita de IA/Telegram sem checagem de papel.
- `apps/api/src/routes/admin.ts` — endpoints administrativos sem guarda de papel.

## Correção

1. Adicionar `requireRole('ADMIN')` (ou equivalente) como `preHandler` nos plugins de `/api/admin` e `/api/setup`.
2. Garantir que o usuário bootstrap (primeiro criado) receba `role: ADMIN`; usuários criados por `ALLOW_SIGNUP` recebem `role: USER`.
3. Centralizar o mapa de rotas públicas em um único lugar e testar que toda rota nova nasce protegida por default.
4. Retornar `403 FORBIDDEN` sem vazar existência do recurso.

## Critérios de aceite

- [x] `GET/PUT /api/setup/*` e `/api/admin/*` retornam `403` para sessão sem papel `ADMIN`.
- [x] O primeiro usuário do bootstrap é `ADMIN`.
- [x] Existe teste que percorre as rotas registradas e falha se uma rota não pública não tiver guarda.
- [x] Rotas públicas (`/api/health`, `/api/auth/login`) continuam acessíveis sem sessão.

## Testes

- `apps/api/tests/authz.test.ts`: usuário comum recebe 403 em setup/admin; admin recebe 200.
- Teste de inventário de rotas: toda rota sob `/api/admin` e `/api/setup` exige `ADMIN`.

## Comments

- 2026-10-28 — Implementado.
  - `UserRole { ADMIN, USER }` no schema + migration `20261028120000_add_user_role` (promove contas existentes a ADMIN para não trancar o dono fora).
  - `setupAccount` cria/promove ADMIN; `signupAccount` cria USER.
  - `auth-guard.ts`: `ADMIN_PREFIXES = ['/api/admin', '/api/setup']` com `403` para não-admin. `/api/setup/status` continua pública.
  - Testes: `plugins/authz.integration.test.ts` cobre USER 403, ADMIN 200, 401 sem sessão e públicas acessíveis. O inventário é por prefixo: toda rota nova sob `/api/admin` ou `/api/setup` herda a guarda.
