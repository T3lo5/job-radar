# 16 — Deduplicação de vagas

## Question

Estratégia de dedup:

- Hash SHA256 de `title + company + location + salary_range` para detectar mesma vaga de fontes diferentes
- Antes de inserir, verificar se `hash` já existe
- Decidir: atualizar `collected_at` + incrementar `source_count`, ou manter a primeira versão?

Endpoint `GET /api/jobs` com paginação, filtros básicos (fonte, data, status).

## Type

task

## Status

done

## Resolution

**Estratégia de deduplicação:**
- Hash SHA256 de `title + company + url` (implementado no worker)
- Se hash existe: incrementa `source_count` + atualiza `collected_at`
- Se não existe: insere novo job com `source_count = 1`

**Campo `source_count`** adicionado ao model Job (migration `add_source_count`)

**Endpoints:**
- `GET /api/jobs` — lista paginada com filtros:
  - `page`, `limit` (paginação)
  - `sourceId` (filtrar por fonte)
  - `status` (RAW, EXTRACTING, MATCHING, ANALYZING, DONE, FAILED)
  - `remote` (ON_SITE, HYBRID, REMOTE, ANY, UNKNOWN)
  - `search` (busca por título/empresa)
  - `fromDate`, `toDate` (período de coleta)
- `GET /api/jobs/:id` — detalhes do job com skills, matches, analyses, applications
- `GET /api/jobs/stats` — estatísticas (total, por status, por fonte)

**Validação:**
- `pnpm typecheck` ✓
- Migration aplicada com sucesso
