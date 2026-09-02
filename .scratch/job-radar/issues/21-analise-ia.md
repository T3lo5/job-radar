# 21 — Worker de análise IA completa

## Question

Após matching, enfileirar análise IA:

- BullMQ queue `job-analysis`
- LLM recebe: vaga normalizada + extracted data + perfil + resultado do matching
- Gera JSON estruturado: `{ summary, strengths, gaps, critical_requirements, risks, recommendation: 'apply' | 'consider' | 'skip', reasoning }`
- Salva em `job_analysis`
- Marca status `analyzing → done`

Auditoria completa em `ai_runs`.

## Type

task

## Status

done

## Blocked by

19, 41

## Implementation

- Integrated into `workers/processing.ts` pipeline
- Uses `analyzeJob()` from AI provider for full AI analysis
- Falls back to basic rule-based analysis if AI fails
- Logs all AI operations to `ai_runs` table (via `runAiOperation`)
- Pipeline: Collection → Extraction → Matching → Analysis → Done
- Each step logs to `job_processing_log` for audit trail
