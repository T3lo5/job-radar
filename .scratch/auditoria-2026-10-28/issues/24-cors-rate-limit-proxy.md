# 24 — CORS e rate limit atrás do proxy

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.16](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Sem `CORS_ORIGINS`, a API aceita qualquer origem com credenciais. O rate limit é único (100 req/min) e, atrás do nginx sem `trustProxy`, todos os usuários compartilham o IP do proxy e o mesmo bucket. `/api/auth/login` não tem limite específico, então brute force é viável.

## Evidência

- `apps/api/src/server.ts:98-101` — `origin: true` + `credentials: true` quando `CORS_ORIGINS` está vazio.
- `docker-compose.prod.yml` — não define `CORS_ORIGINS`.
- `apps/api/src/server.ts:103-107` — limite global sem `trustProxy` e sem limite por rota.

## Correção

1. Em produção, falhar o boot se `CORS_ORIGINS` estiver vazio; nunca usar `origin: true` com credenciais.
2. Habilitar `trustProxy` com o número de hops do nginx (configurável), para o rate limit usar o IP real.
3. Limites por rota:
   - `/api/auth/login` e `/api/auth/signup`: 5/min por IP, com backoff.
   - `/api/auth/*`: 20/min.
   - Demais: 100/min por IP.
4. Retornar `429` com `Retry-After` e mensagem clara.
5. Documentar as variáveis no README.

## Critérios de aceite

- [x] Boot em produção sem `CORS_ORIGINS` falha com mensagem explícita.
- [x] Origem não listada é rejeitada em preflight.
- [x] Dois clientes atrás do nginx têm buckets independentes.
- [x] 6º login no mesmo minuto retorna 429.
- [x] Testes cobrem CORS e limites.

## Testes

- Teste de boot com `NODE_ENV=production` sem CORS.
- Teste de rate limit por IP com `X-Forwarded-For` e `trustProxy`.

## Comments

- 2026-10-28 — CORS obrigatório, proxy confiável e limites por rota.
  - `config/http-security.ts` concentra as regras puras: `resolveCorsOrigins`, `parseTrustProxy`, `authRateLimitFor`, `rateLimitErrorResponse` e as constantes de limite.
  - CORS: em produção, `CORS_ORIGINS` vazio lança erro no boot com mensagem acionável; em dev, a allowlist é `http://localhost[:porta]`/`http://127.0.0.1[:porta]`. `origin: true` não é mais usado.
  - `TRUST_PROXY` (default `false`) aceita `true` ou o número de hops (1 = nginx). Hops viram uma função `hop < n` porque nesta versão do Fastify `trustProxy: number` falha fechado e a configuração não teria efeito.
  - `trustProxy` configurado no `Fastify({ trustProxy })`; o rate limit usa `keyGenerator: req.ip`, então cada cliente atrás do proxy tem o próprio bucket.
  - Limites: global 100/min; `/api/auth/*` 20/min; `/api/auth/login`, `/api/auth/signup` e `/api/auth/setup` 5/min com `continueExceeding` (backoff). O `onRoute` que aplica as regras é registrado ANTES do `@fastify/rate-limit` — hooks `onRoute` rodam em ordem de registro e o plugin lê `route.config.rateLimit` no dele.
  - 429 devolve `Retry-After` (header do plugin) e corpo PT-BR via `errorResponseBuilder`.
  - `docker-compose.prod.yml` passa `CORS_ORIGINS` e `TRUST_PROXY=1`; `.env.example` e checklist do README documentam as variáveis (incluindo `APP_PUBLIC_URL` do ticket 22).
  - Testes: `http-security.test.ts` (17). Helpers: produção sem CORS falha; dev só localhost; hops; limites por rota. HTTP real (Fastify + CORS + rate-limit, mesmos helpers e mesma ordem do server): preflight de origem listada recebe o header e origem estranha não; 6º login → 429 com `Retry-After`; dois IPs atrás do nginx têm buckets separados (5+429 de um não bloqueiam o outro); sem `trustProxy`, X-Forwarded-For não separa clientes; `/api/auth/me` aguenta 20 e bloqueia a 21ª.
  - Verificação: API typecheck=0 lint=0 test=376.
