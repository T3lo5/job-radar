# 29 — Kanban de candidaturas

## Question

Tela `/applications` com board Kanban (colunas = status). Drag-and-drop muda status. Reordenar colunas conforme pipeline pessoal. Card mostra: vaga, empresa, score, data. Filtro por score mínimo.

Biblioteca: `@dnd-kit/core` (moderna, acessível) ou `react-beautiful-dnd` (deprecated, evitar).

## Type

task

## Status

done

## Resolution

**Kanban de Candidaturas** (`apps/web/src/pages/applications.tsx`):

- 8 colunas (status): Encontrada → Interessante → CV Preparado → Aplicada → Entrevista → Oferta → Rejeitada → Arquivada
- Drag-and-drop com @dnd-kit/core
- Cards: vaga, empresa, localização, data de aplicação
- Contador por coluna
- Ao arrastar para outra coluna, muda status via API

**Dependência:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

**Validação:**
- `pnpm typecheck` ✓
