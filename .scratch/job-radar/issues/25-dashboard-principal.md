# 25 — Dashboard principal (frontend)

## Question

Tela `/` com:

- Header: contadores (vagas novas hoje, alta aderência, média aderência)
- Card "Melhores vagas" (top 5 por score)
- Gráfico de distribuição de matches (Recharts pizza ou barra)
- Lista de vagas recentes com filtro rápido

Estado via TanStack Query, refresh a cada 5 min.

## Type

task

## Status

done

## Resolution

**Dashboard** (`apps/web/src/pages/dashboard.tsx`):

**Header com contadores:**
- Total de vagas
- Alta aderência (≥80)
- Média aderência (60-79)
- Vagas avaliadas

**Gráficos (Recharts):**
- Pizza: distribuição de matches (excelente, muito boa, boa, possível, baixa)
- Barras: vagas por status

**Cards:**
- "Melhores Vagas" — top 5 por score com badge de match
- "Vagas Recentes" — últimas 10 coletadas

**API:**
- `jobsApi.getList()`, `jobsApi.getStats()`, `matchApi.getResults()`
- Refresh automático a cada 5 min (TanStack Query)

**Dependência:** `recharts`

**Validação:**
- `pnpm typecheck` ✓
