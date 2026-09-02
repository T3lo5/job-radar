# 18 — Worker de extração de requisitos

## Question

Após dedup, enfileirar job de extração:

- BullMQ queue `job-extraction`
- Worker pega vaga `raw`, chama LLM com prompt estruturado
- Extrai: cargo, senioridade, techs (mapeadas para `skills`), experiência, idiomas, localização, modalidade, salário, requisitos obrigatórios, requisitos desejáveis
- Salva em `job_extracted_data` (JSONB) e `job_skills` (N:N)
- Marca status `extracting → matching`

Rate limit e retry. Logging de tokens consumidos.

## Type

task

## Status

done

## Blocked by

17, 41

## Implementation

- Integrated into `workers/processing.ts` pipeline
- Uses `extractJobRequirements()` from AI provider (LLM-powered)
- Extracts: title, seniority, skills, experience, languages, location, remote, salary, requirements
- Maps extracted skills to `skills` catalog (creates new ones if needed)
- Stores extracted data in `job.rawData` (JSONB)
- Falls back to keyword matching if AI fails
- Logs to `job_processing_log` for audit trail
- Pipeline: Collection → Extraction → Matching → Analysis → Done
