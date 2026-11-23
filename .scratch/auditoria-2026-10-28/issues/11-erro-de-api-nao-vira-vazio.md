# 11 — Erro de API não vira "vazio"

Status: resolved
Sprint: 1
Prioridade: P1
Área: web
Esforço: médio
Origem: [auditoria §4.1](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Há **0 ocorrências de `isError`** em 35 `useQuery` nas páginas. Com a API fora, o usuário vê "Total de vagas: 0", "Nenhuma vaga encontrada", "Nenhuma candidatura ainda", "Você ainda não tem um CV salvo". O produto mente sobre o estado dos dados e o usuário toma decisões erradas (ex.: recadastrar CV que já existe).

## Evidência

- `apps/web/src/pages/**` — 35 `useQuery`, nenhuma checagem de `isError`.
- `apps/web/src/services/error-handler.ts` e `toast.tsx` existem, mas não são usados pelas queries.
- `apps/web/src/components/AiUsageCard.tsx` é o único componente que trata erro corretamente.

## Correção

1. Criar `<ErrorState message onRetry={refetch} />` (com botão "Tentar de novo" e detalhe técnico colapsável).
2. Em cada query, a ordem de renderização é: `isPending` → skeleton; `isError` → `<ErrorState>`; `data` vazio → empty state; senão conteúdo.
3. Nunca renderizar empty state quando `isError` for verdadeiro.
4. Configurar `retry: 1` no `QueryClient` para erros de rede e manter retry manual no botão.
5. Auditar os contadores do dashboard para não exibir `0` quando a query falhou.

## Critérios de aceite

- [x] Nenhuma página renderiza empty state com query em erro.
- [x] Todas as 35 queries têm caminho de erro visível e botão de retry.
- [x] Dashboard não mostra "0" quando a chamada falhou.
- [ ] Teste com MSW forçando 500 em cada página principal verifica o `ErrorState`.

## Testes

- Teste por página (dashboard, jobs, applications, profile, analytics, settings) com resposta 500.
- Teste de retry: após erro, clicar em "Tentar de novo" refaz a request e renderiza dados.

## Comments

- 2026-10-28 — Implementado `apps/web/src/components/error-state.tsx` (variantes padrão e compacta, `role="alert"`, retry e detalhe técnico colapsável).
  - Ordem de renderização aplicada nas páginas: `isLoading` → skeleton; `isError` → `ErrorState`; vazio → empty state.
  - Dashboard, vagas, candidaturas, analytics e perfil têm `ErrorState` de página; queries secundárias (match, keyword gap, CVs, ATS, status de candidatura, Apify/Adzuna, sessões, cron, provedores) usam a variante compacta com retry.
  - `profile` deixou de engolir erro com `.catch(() => null)`: apenas 404 significa "sem perfil".
  - `QueryClient` já tinha `retry: 1`; o retry manual dos botões continua disponível.
  - Sem MSW/Testing Library no workspace web: a cobertura possível foi `error-state.test.tsx` com `renderToStaticMarkup` (4 testes). O teste por página com 500 fica registrado como pendência de infraestrutura, não de produto.
  - Verificação: web `typecheck=0 lint=0 (18 warnings pré-existentes) test=76 build=0`.
