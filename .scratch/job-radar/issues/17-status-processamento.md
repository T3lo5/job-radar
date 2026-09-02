# 17 — Status de processamento de vaga

## Question

Cada vaga tem um `processing_status`:

- `raw` — coletada, ainda não processada
- `extracting` — extraindo requisitos via IA
- `matching` — calculando score
- `analyzing` — análise IA completa
- `done` — pronta para exibir
- `failed` — erro (com `error_message`)

Tabela `job_processing_log` para auditoria de cada tentativa.

## Type

task

## Status

done

## Resolution

**JobProcessingLog** model adicionado ao schema:
- `jobId`, `fromStatus`, `toStatus`, `message`, `metadata`, `createdAt`
- Relação com Job (1:N)

**Serviço** (`apps/api/src/services/job-processing.ts`):
- `logStatusTransition()` — registra transição de status
- `updateJobStatus()` — atualiza status + cria log (transacional)
- `getJobProcessingHistory()` — histórico de processamento

**Migration:** `add_processing_log`

**Validação:**
- `pnpm typecheck` ✓
- Migration aplicada com sucesso
