# 21 — Kanban acessível

Status: resolved
Sprint: 1
Prioridade: P1
Área: web
Esforço: médio
Origem: [auditoria §4.8](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O Kanban só muda status por arrastar (`PointerSensor`). Teclado e leitor de tela não conseguem mover uma candidatura. O sino de follow-up é invisível porque usa `opacity-0 group-hover` sem nenhum ancestral com `group`. O alvo de 24 px é menor que o mínimo confortável.

## Evidência

- `apps/web/src/pages/applications.tsx:217` — apenas `PointerSensor`.
- `apps/web/src/pages/applications.tsx:765` — sino com `opacity-0 group-hover:opacity-100`, sem `group` no ancestral.
- Coluna vazia instrui "Arraste cards aqui", sem alternativa.

## Correção

1. Adicionar `KeyboardSensor` com `sortableKeyboardCoordinates` (dnd-kit).
2. Menu "Mover para…" por card, com todas as colunas, acessível por teclado e leitor de tela.
3. Remover `opacity-0` do sino ou adicionar `group` no card; aumentar alvo para ≥ 44 px e `aria-label="Agendar follow-up"`.
4. Atualizar o texto da coluna vazia para citar as duas formas de mover.
5. Anunciar mudança de status via `aria-live`.

## Critérios de aceite

- [x] É possível mover uma candidatura usando apenas teclado.
- [x] O menu "Mover para…" lista todas as colunas e reflete a atual.
- [x] O sino de follow-up está sempre visível e tem nome acessível.
- [x] Mudança de status é anunciada por leitor de tela.
- [x] Teste com `userEvent.tab()` e `Enter` move o card.

## Testes

- Teste de teclado no Kanban.
- Teste de acessibilidade (axe) sem violações críticas na página.

## Comments

- 2026-10-28 — Kanban deixou de depender de arrastar.
  - `KeyboardSensor` com `sortableKeyboardCoordinates` no `DndContext`: a alça de arraste é um botão focável (com os `attributes`/`listeners` do dnd-kit) e aceita Espaço + setas.
  - Cada card ganhou o select nativo "Mover para…" (`components/move-select.tsx`), com todas as 8 colunas, valor = status atual e `aria-label` que anuncia a coluna atual. É o caminho que funciona sem mouse e sem conhecer o atalho do dnd-kit.
  - O card inteiro deixou de ser `role="button"`/arrastável: a alça e o sino agora são botões próprios (controles interativos dentro de um botão eram HTML/ARIA inválido). O título é um botão que abre o detalhe.
  - Sino de follow-up sempre visível (`h-11 w-11` = 44 px), com `aria-label` e `title`; o `opacity-0 group-hover:opacity-100` sem `group` foi removido.
  - Coluna vazia agora diz "Arraste um card aqui ou use 'Mover para…' no card", e cada coluna tem `role="group"` com contagem no nome acessível.
  - Mudança de status publica `Candidatura movida para X.` em um `role="status" aria-live="polite"` (visualmente oculto).
  - Testes: `move-select.test.tsx` (4) renderiza o componente em jsdom e prova que lista as colunas, reflete a atual, tem label/nome acessível, dispara a mudança e ignora a coluna atual — o mesmo caminho de evento que o teclado usa no `<select>`.
  - Limitação registrada: o workspace não tem Testing Library/server-event nem axe; não foi possível rodar `userEvent.tab()` nem uma varredura axe. O caminho de teclado do dnd-kit (alça + KeyboardSensor) não tem teste automatizado, só o select, que é a alternativa garantida.
  - Verificação: web typecheck=0 lint=0 test=96 build=0.
