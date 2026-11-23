# 05 — Deploy: migrations e chave de criptografia

Status: ready-for-human
Sprint: 0
Prioridade: P1
Área: infra
Esforço: baixo
Origem: [auditoria §3.3](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Uma instalação nova seguindo o README sobe a API contra um banco vazio e, no compose de desenvolvimento, entra em crash-loop por falta de `SETTINGS_ENCRYPTION_KEY`.

> **Nota:** deploy em produção não é o objetivo atual. Este ticket fica registrado e só entra quando o deploy virar meta.

## Evidência

- `apps/api/Dockerfile:52` — `CMD ["node", "dist/server.js"]`, sem `prisma migrate deploy`.
- `docker-compose.prod.yml` — sem serviço de migration e sem entrypoint.
- `README.md` — recomenda `docker compose -f docker-compose.prod.yml up --build -d`.
- `docker-compose.yml` (dev) — não injeta `SETTINGS_ENCRYPTION_KEY`, obrigatória em `apps/api/src/config/env.ts:13`.

## Correção

1. Criar serviço `migrate` no compose de produção com `depends_on: postgres: condition: service_healthy`, rodando `pnpm --filter @job-radar/api db:deploy`; a API usa `service_completed_successfully`.
2. Alternativa aceitável: entrypoint `db:deploy && node dist/server.js` com retry.
3. Injetar `SETTINGS_ENCRYPTION_KEY` no compose dev, ou gerar default **apenas** quando `NODE_ENV=development`, com aviso no log.
4. Falhar o boot em produção se a chave estiver ausente, fraca ou com tamanho inválido.

## Critérios de aceite

- [ ] `docker compose -f docker-compose.prod.yml up --build -d` aplica todas as migrations antes de a API atender.
- [ ] Banco vazio + migrations aplicadas + login funcionando, sem passo manual.
- [ ] `docker compose up` (dev) sobe sem crash-loop.
- [ ] Erro claro no boot quando a chave falta ou é inválida em produção.

## Testes

- Script de smoke que sobe do zero em volume limpo e valida `/api/health/ready`.
- Teste unitário de `env.ts`: produção sem chave → erro; desenvolvimento sem chave → default com warning.

## Comments
