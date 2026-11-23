# 35 — Acessibilidade e mobile

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: web
Esforço: médio
Origem: [auditoria §5.24–5.26, §7.9](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Acessibilidade é sistêmica e não pontual: existe **1 `aria-label`** no app inteiro, há `span[onClick]`, labels sem `htmlFor`, contraste de `--error`/`--accent` abaixo de 4,5:1. No mobile, a nav tem 7 itens sem menu, o toast tem `w-96` fixo e o Kanban tem 8 colunas.

## Evidência

- `apps/web/src/components/layout.tsx` — nav sem menu mobile, `span[onClick]`.
- `apps/web/src/pages/profile.tsx` — labels sem `htmlFor`.
- `apps/web/src/index.css:17,30` — contraste insuficiente no tema escuro.
- `apps/web/src/components/toast.tsx:101` — `w-96`.
- `apps/web/src/pages/applications.tsx:316` — Kanban de 8 colunas.

## Correção

1. Converter `span[onClick]` em `<button>`; associar todos os labels com `htmlFor`/`id`.
2. `aria-label` em todos os botões de ícone; foco visível consistente.
3. Clarear `--error` e `--accent` para atingir AA (4,5:1) no tema escuro.
4. Nav mobile colapsável (menu), toast responsivo, tabelas viram cards em telas estreitas.
5. Kanban em abas por status no mobile (ver ticket 21).
6. Rodar axe no CI nas páginas principais.

## Critérios de aceite

- [ ] Fluxo login → ver vaga → aplicar → mover no Kanban funciona só com teclado.
- [ ] Mesmo fluxo funciona em 360 px sem scroll horizontal.
- [ ] axe sem violações críticas/sérias nas páginas principais.
- [ ] Contraste AA em texto normal e em estados de erro.
- [ ] Todo controle interativo é focável e tem nome acessível.

## Testes

- Testes com `@testing-library/user-event` por teclado.
- Teste axe por página.
- Teste de viewport 360 px (Playwright ou equivalente).

## Comments
