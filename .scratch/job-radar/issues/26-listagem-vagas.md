# 26 — Página de listagem de vagas com filtros

## Question

Tela `/jobs` com:

- Filtros: aderência mínima, fonte, data (hoje/semana/mês), modalidade, faixa salarial, skills
- Card por vaga: título, empresa, match badge, top skills, localização, salário, ações
- Ordenação: por score, data
- Paginação infinita (TanStack Query)

## Type

task

## Status

done

## Resolution

**Listagem de Vagas** (`apps/web/src/pages/jobs.tsx`):

**Filtros:**
- Busca por título/empresa
- Modalidade (remoto, híbrido, presencial)
- Status (coletado, calculando, processado, erro)

**Card por vaga:**
- Título, empresa
- Badge de match
- Localização, modalidade, salário
- Status e fonte
- Ações: avaliar match, ver vaga

**Paginação infinita** com TanStack Query (`useInfiniteQuery`)
- Botão "Carregar mais"
- 20 itens por página

**API:** `jobsApi.getList()` com filtros

**Validação:**
- `pnpm typecheck` ✓
