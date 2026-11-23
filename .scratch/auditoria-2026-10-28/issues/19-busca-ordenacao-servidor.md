# 19 — Busca e ordenação no servidor

Status: resolved
Sprint: 1
Prioridade: P1
Área: web + api
Esforço: médio
Origem: [auditoria §4.7](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Cada tecla digitada na busca dispara uma query e troca a lista por skeleton; ordenar refaz a request; a ordenação só afeta a página carregada. Kanban e CVs truncam em 100 itens sem avisar.

## Evidência

- `apps/web/src/pages/jobs.tsx:55-71` — query por tecla, skeleton a cada caractere.
- `apps/web/src/pages/jobs.tsx` — `sortBy`/`minScore` na `queryKey`.
- `limit: 100` em listas de Kanban/CVs sem indicação de truncamento.

## Correção

1. Debounce de 300 ms ou `useDeferredValue` no input de busca + `keepPreviousData` para não piscar skeleton.
2. Mover `sort` (score, data, salário) e `minScore` para a API, aplicados antes da paginação.
3. Retornar `{ items, total, page, pageSize }` em todas as listas paginadas.
4. UI mostra "100 de N" e permite carregar mais/paginar; Kanban pagina por coluna ou limita com aviso explícito.
5. Manter a URL com os filtros para deep link e voltar preservado.

## Critérios de aceite

- [x] Digitar "react" rápido dispara no máximo 1 request após a pausa.
- [x] Ordenar por score reordena o conjunto inteiro, não só a página.
- [x] Nenhuma lista trunca silenciosamente: sempre há contagem/total ou paginação.
- [x] Filtros sobrevivem a reload e ao voltar do detalhe.

## Testes

- Teste de componente com timers fake: 10 teclas → 1 request.
- Teste de API: `sort=score` com 3 páginas retorna ordem global correta.

## Comments

- 2026-10-28 — Busca com debounce e ordenação no servidor.
  - `useDebouncedValue`/`createDebouncer` em `apps/web/src/lib/debounce.ts`: a busca da página de vagas só entra na `queryKey` 300 ms depois da última tecla. O input e a URL continuam atualizando na hora; a lista anterior fica visível com `keepPreviousData` (nada de skeleton por caractere).
  - `GET /api/jobs` ganhou `sort=date|match|title|salary` e `minScore`. A ordenação por match é um `LEFT JOIN job_matches` filtrado pelo perfil da sessão (`NULLS LAST`) e o `minScore` é `EXISTS` — ambos aplicados antes de `LIMIT/OFFSET`, então valem para o conjunto inteiro.
  - `jobs.tsx` não ordena mais no cliente: `sortBy` e `minScore` vão para a API; a UI ganhou os selects "Match mínimo" e "Ordenar por salário". O indicador "atualizando..." aparece no refetch.
  - Kanban de candidaturas mostra "N no quadro · mostrando X primeiras de Y" quando passa de 100; o seletor de vaga do CV avisa que só lista as 100 primeiras candidaturas.
  - Testes: `debounce.test.ts` (3, timers fake — 8 teclas geram 1 aplicação; pausas separadas geram 2; `cancel` descarta); `jobs-list.integration.test.ts` (4) com 45 vagas em 3 páginas prova ordem global por score (sem duplicatas entre páginas), `minScore` filtrando antes de paginar (total 15), ordenação por título no servidor e perfil sem matches.
  - Verificação: API typecheck=0 lint=0 test=324; web typecheck=0 lint=0 test=87 build=0.
