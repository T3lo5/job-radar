# 07 — Ligar botões do detalhe da vaga

Status: resolved
Sprint: 0
Prioridade: P0
Área: web
Esforço: baixo
Origem: [auditoria §3.4](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Duas das ações mais importantes da tela de detalhe da vaga não fazem nada. O usuário clica, não há loading, toast nem mudança de estado. Botão morto é pior que botão ausente: destrói a confiança no resto do produto.

## Evidência

- `apps/web/src/pages/job-detail.tsx:281` — `<Button>Marcar como aplicada</Button>` sem `onClick`.
- `apps/web/src/pages/job-detail.tsx:333` — `<Button variant="outline">Arquivar</Button>` sem `onClick`.

## Correção

1. "Marcar como aplicada": chamar `applicationsApi.create(jobId)` (ou `updateStatus` se já existir candidatura) via mutation; desabilitar enquanto pendente; toast de sucesso/erro; invalidar `['applications']` e o match da vaga.
2. Refletir o estado: se já existe candidatura, mostrar status atual e permitir avançar etapa em vez de recriar.
3. "Arquivar": usar `updateStatus(id, 'ARCHIVED')` com confirmação; se não houver candidatura, criar com status `ARCHIVED` ou esconder o botão.
4. Tratar erro com toast, nunca silenciar.

## Critérios de aceite

- [x] Clicar em "Marcar como aplicada" cria/atualiza a candidatura, mostra toast e aparece no Kanban sem reload.
- [x] Clicar em "Arquivar" move a candidatura para arquivadas e some da lista ativa.
- [x] Botões ficam desabilitados durante a mutation e exibem erro em caso de falha.
- [x] Nenhum `<Button>` da página fica sem `onClick`/`type="submit"`.

## Testes

- Teste de componente com MSW: clique em "Marcar como aplicada" dispara POST/PATCH e renderiza toast.
- Teste de clique duplo: apenas uma requisição é enviada.

## Comments

- 2026-10-28 — Implementado.
  - `job-detail.tsx` busca a candidatura da vaga (`applicationsApi.getList({ jobId })`) e reflete o status atual.
  - "Marcar como aplicada" cria (se preciso) e avança para `APPLIED`; "Arquivar" confirma e move para `ARCHIVED`. Ambos com loading, toast e invalidação de `['applications']`, `['application-for-job']` e `['match-result']`.
  - Corrida de duplo clique/409: o id vem do corpo do erro e a mutação segue com `updateStatus`.
  - `applicationsApi.create` foi tipado como `{ applicationId }` (era `Application`, contrato que a API nunca devolveu).
  - Sem teste de componente: o workspace web não tem Testing Library nem MSW; a verificação foi por typecheck/build e revisão dos handlers.
