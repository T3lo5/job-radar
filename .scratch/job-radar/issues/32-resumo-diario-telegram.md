# 32 — Resumo diário via Telegram

## Question

Worker agendado por `DAILY_REPORT_CRON` (default 18:05). Gera resumo do dia:

- Total de vagas encontradas
- Processadas
- Compatíveis (score ≥ 60)
- Altamente recomendadas (score ≥ 80)
- Top N vagas com detalhes (título, empresa, score, salário, localização, link)

Mensagem formatada em Markdown. Rate limit: Telegram tem limite de 4096 chars por mensagem; paginar se necessário.

Endpoint `POST /api/admin/send-daily-report` para forçar envio manual.

## Type

task

## Status

done

## Resolution

**Resumo Diário** (`apps/api/src/services/daily-report.ts`):

**Relatório inclui:**
- Total de vagas encontradas hoje
- Processadas
- Compatíveis (≥60)
- Altamente recomendadas (≥80)
- Top 5 vagas com detalhes (título, empresa, score, salário, link)

**Formato:** Markdown com emojis

**Envio automático:** Via TelegramChannel

**Endpoint manual:** `POST /api/admin/send-daily-report`

**Validação:**
- `pnpm typecheck` ✓
