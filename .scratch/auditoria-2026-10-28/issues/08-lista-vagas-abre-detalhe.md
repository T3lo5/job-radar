# 08 — Lista de vagas abre o detalhe

Status: resolved
Sprint: 0
Prioridade: P0
Área: web
Esforço: baixo
Origem: [auditoria §3.5](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O detalhe da vaga — com breakdown do match, keyword gap, CV, carta e descrição — só é alcançável pelo Kanban, ou seja, **depois** de o usuário já ter criado uma candidatura. Pela lista, o único caminho é o link externo para o site da vaga. O fluxo principal (encontrar → avaliar → decidir) termina em beco sem saída.

## Evidência

- `apps/web/src/pages/jobs.tsx:302-369` — card tem "Ver vaga →" (externo), "Avaliar match" e "+", mas nenhum `<Link to={/jobs/${job.id}}>`.
- `apps/web/src/App.tsx` — rota `/jobs/:id` existe.
- `apps/web/src/pages/applications.tsx` — único ponto que linka para o detalhe.

## Correção

1. Tornar o título e a área principal do card links para `/jobs/:id`.
2. Manter "Ver vaga →" como ação secundária (externo, `target="_blank"` + `rel="noreferrer"`).
3. Garantir que o card inteiro seja clicável sem capturar os cliques dos botões internos.
4. Adicionar botão "Voltar" no detalhe preservando filtros da lista (query string).

## Critérios de aceite

- [x] Clicar no card ou no título abre `/jobs/:id`.
- [x] Clicar em "Ver vaga" abre o site externo sem navegar para o detalhe.
- [x] Filtros e página da lista são preservados ao voltar.
- [x] Card é acessível por teclado (link real, não `div onClick`).

## Testes

- Teste de componente: clique no título navega para a rota do detalhe.
- Teste de teclado: `Tab` + `Enter` no card abre o detalhe.

## Comments

- 2026-10-28 — Implementado.
  - Título/área principal do card virou `<Link to={'/jobs/' + job.id}>` (link real, acessível por teclado).
  - "Ver vaga →" continua externo, com `target="_blank"` e `rel="noopener noreferrer"`.
  - Filtros, ordenação e página agora vivem na query string; o detalhe volta com `navigate(-1)` quando há histórico (fallback `/jobs`) e o infinite query reabastece as páginas anteriores.
  - Sem teste de componente pelo mesmo motivo do ticket 07 (falta infra de Testing Library/MSW).
