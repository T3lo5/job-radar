# 01 — Fechar o signup público

Status: resolved
Sprint: 0
Prioridade: P0
Área: api
Esforço: baixo
Origem: [auditoria §3.1](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O produto é single-user, mas `POST /api/auth/signup` aceita qualquer visitante. Como as rotas leem o "primeiro" registro do banco (ticket 02), a segunda conta criada passa a enxergar perfil, CVs, candidaturas e matches da primeira — e pode trocar provedor de IA e Telegram via `/api/setup/*`.

## Evidência

- `apps/api/src/routes/auth.ts:92` — rota pública sem convite, flag ou limite.
- `apps/api/src/plugins/auth-guard.ts` — valida sessão, não valida papel.
- `apps/api/src/routes/setup.ts:44-62` — qualquer sessão troca provedor de IA e chat do Telegram.

## Correção

Decisão: **não construir multi-tenancy agora**. Fechar o cadastro.

1. `POST /api/auth/signup` retorna `403` com código estável (`SIGNUP_DISABLED`) quando já existe usuário no banco.
2. Permitir signup apenas quando a tabela `User` está vazia (bootstrap da primeira conta) **ou** quando `ALLOW_SIGNUP=true` for explicitamente definido no ambiente — default `false`.
3. Remover o link "Criar conta" de `apps/web/src/pages/login.tsx`; manter a rota acessível apenas se `ALLOW_SIGNUP` estiver ligado.
4. Adicionar rate limit específico em `/api/auth/*` (ver ticket 24) para o caso de bootstrap exposto.

## Critérios de aceite

- [x] Com um usuário existente, `POST /api/auth/signup` retorna `403 SIGNUP_DISABLED` e não cria linha.
- [x] Com banco vazio, o primeiro signup funciona e cria exatamente um usuário.
- [x] A tela de login não oferece "Criar conta" por default.
- [x] `ALLOW_SIGNUP=true` reabre o fluxo para testes, documentado no README.
- [x] Teste de integração cobre os três cenários.

## Testes

- `apps/api/tests/auth.test.ts` (ou equivalente): signup com banco vazio → 201; segundo signup → 403; `ALLOW_SIGNUP=true` → 201.
- Teste de UI: login não renderiza link de signup sem a flag.

## Comments

- 2026-10-28 — Implementado.
  - `POST /api/auth/signup`: `403 SIGNUP_DISABLED` com conta existente e flag desligada; `409` para e-mail duplicado em vez de estourar 500.
  - `ALLOW_SIGNUP` no schema de env (default `false`) e documentado no `.env.example`.
  - `/api/auth/status` expõe `allowSignup`; `login.tsx` só mostra "Criar conta" quando aberto.
  - Testes: `apps/api/src/routes/auth.integration.test.ts` cobre bootstrap sem conta, fechado, flag ligada e duplicado.
