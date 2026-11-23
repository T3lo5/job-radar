# 14 — Cron reagenda ao salvar

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.14](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O usuário muda o horário da coleta na UI, recebe `204` e nada acontece até reiniciar o servidor. O agendamento exibido na tela diverge do agendamento real.

## Evidência

- `apps/api/src/routes/setup.ts:74-78` — grava o cron em settings.
- `apps/api/src/server.ts:191` → `apps/api/src/workers/job-collection.ts:59` — `upsertJobScheduler` só no boot.

## Correção

1. Extrair `setupCronSchedule()` para um serviço chamável e idempotente.
2. Chamar após salvar o cron em `/api/setup` (e em qualquer rota que altere `cron`).
3. Se o scheduler existente tiver o mesmo nome, usar `upsertJobScheduler` para substituir; se o padrão mudou, remover o antigo antes.
4. Validar a expressão cron antes de persistir e retornar 400 se inválida.
5. Expor o próximo horário calculado (`getNextRun`) na resposta de settings.

## Critérios de aceite

- [x] Salvar um novo cron altera o agendamento sem restart.
- [x] Cron inválido retorna 400 e não altera o agendamento atual.
- [x] A UI mostra o próximo horário real após salvar.
- [x] Reiniciar o servidor mantém o último cron salvo.

## Testes

- Teste de integração com BullMQ em memória/Redis de teste: salvar cron e verificar `getJobSchedulers()` atualizado.
- Teste de cron inválido.

## Comments

- 2026-10-28 — `setupCronSchedule()` virou serviço chamável e idempotente (recebe a fila por parâmetro), com validação via `cron-parser` (`isValidCronExpression`) e `nextRunFor`.
  - `/api/setup/cron` valida antes de persistir (400 sem alterar nada), reagenda e devolve `{jobCollectionCron, dailyReportCron, nextJobCollectionRun, nextDailyReportRun}` (200).
  - `POST /api/settings` no escopo `cron` também reagenda; `GET /api/settings/cron` inclui `nextRuns` com o próximo horário real.
  - UI: card de Agendamento mostra "Próxima coleta" e "Próximo relatório", e erro 400 vira mensagem explícita sobre o formato cron.
  - `cron-parser@^4.9.0` declarado em `apps/api` (mesma versão usada pelo BullMQ).
  - Testes `cron.integration.test.ts` (7): validação, persistência + reagendamento, 400 sem efeito, `nextRuns`, POST em escopo não-cron e troca de padrão com upsert no mesmo scheduler id. Boot continua chamando `setupCronSchedule()` — é o caminho de "reiniciar mantém o último cron".
  - Verificação: API typecheck=0 lint=0 test=274; web typecheck=0 lint=0 test=80 build=0.
