# 33 — Orquestração da rotina diária

## Question

Definir sequência de jobs agendados:

1. `JOB_COLLECTION_CRON` (default 06:00) — enfileira coleta
2. Após coleta completar: enfileira extração de cada vaga
3. Após extração: enfileira matching
4. Após matching: enfileira análise IA
5. `DAILY_REPORT_CRON` (default 18:05) — gera e envia relatório
6. Dashboard atualizado continuamente

BullMQ `flow` ou chains para encadear. Garantir que se uma vaga falhar, não trava as outras (jobs independentes).

Horários configuráveis via env. Permitir desabilitar etapas individualmente.

## Type

task

## Status

done

## Blocked by

21, 32, 15, 41

## Implementation

- `setupCronSchedule()` now registers both collection and daily report schedulers
- Cron expressions read from settings (configurable at runtime)
- Worker handles both job types via `job.name` dispatch
- Each job runs independently (failure doesn't block others)
