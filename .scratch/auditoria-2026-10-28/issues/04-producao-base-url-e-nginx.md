# 04 — Produção: `baseURL` e nginx

Status: ready-for-human
Sprint: 0
Prioridade: P1
Área: infra
Esforço: baixo
Origem: [auditoria §3.2](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O bundle web de produção aponta para a máquina do visitante e o nginx remove o prefixo `/api` que a API espera. São duas falhas independentes; cada uma sozinha derruba o app.

> **Nota:** deploy em produção não é o objetivo atual. Este ticket fica registrado e só entra quando o deploy virar meta.

## Evidência

- `apps/web/src/services/api.ts:4` — `import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`. `VITE_*` é build-time e o Dockerfile do web não recebe a variável.
- `apps/web/web/nginx.conf:21` — `proxy_pass http://api:3001/` (barra final remove `/api`), mas as rotas são registradas como `/api/...`.
- `docker-compose.prod.yml` passa `API_URL` para o container web, mas o nginx tem `api:3001` hardcoded e o Vite não lê `API_URL`.

## Correção

Escolher **uma** arquitetura e alinhar tudo (recomendado: mesma origem com prefixo `/api`).

1. `api.ts`: `baseURL: import.meta.env.VITE_API_URL ?? '/api'`.
2. `nginx.conf`: `proxy_pass http://api:3001;` **sem** barra final, preservando `/api/...`.
3. Remover `API_URL` morto do `docker-compose.prod.yml` ou passá-lo como build arg `VITE_API_URL` se a API for servida em outra origem.
4. Documentar a escolha no README e em ADR se contradizer o ADR-0004.

## Critérios de aceite

- [ ] `docker compose -f docker-compose.prod.yml up --build -d` sobe e o app abre.
- [ ] Login, listagem e detalhe de vaga funcionam via nginx.
- [ ] `grep -R "localhost:3001" apps/web/dist` não retorna nada.
- [ ] `curl http://localhost/api/health` retorna 200.

## Testes

- Smoke test de produção no CI (ou script `scripts/smoke-prod.sh`) cobrindo health, login e `GET /api/jobs`.

## Comments
