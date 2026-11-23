# 15 — Respeitar fontes desativadas

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.13](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Desligar uma fonte na UI grava o setting e muda o que a tela mostra, mas a coleta continua varrendo todas as fontes. O usuário acha que desativou e continua recebendo vagas (e gastando rate limit/tokens) daquela fonte.

## Evidência

- `apps/api/src/routes/admin.ts:125-147` — grava `source_<id>_enabled`.
- `apps/api/src/routes/admin.ts:119` — lê o flag apenas para exibir.
- `apps/api/src/sources/index.ts:186` — `collectFromAllSources` usa `getAllSources()` sem filtro.
- `apps/api/src/workers/job-collection.ts` — também não lê o flag.

## Correção

1. Ler os flags `source_<id>_enabled` uma vez no início da coleta.
2. Filtrar em `collectFromAllSources` **e** em `runCollection` (defesa em profundidade).
3. Registrar no log/relatório quantas fontes foram puladas por estarem desativadas.
4. Exibir no painel de coleta as fontes efetivamente executadas.
5. Default: fonte habilitada quando o setting não existe (compatibilidade).

## Critérios de aceite

- [x] Desativar uma fonte e rodar a coleta não gera request para ela.
- [x] Reativar volta a coletar sem restart.
- [x] Relatório de coleta lista fontes puladas.
- [x] Setting ausente mantém a fonte habilitada.

## Testes

- Teste de integração com fonte fake: flag desligada → registry não é chamado para ela.
- Teste do relatório de coleta.

## Comments

- 2026-10-28 — Coleta passou a respeitar `source_<id>_enabled`.
  - `getEnabledSourceIds()` em `apps/api/src/sources/index.ts` lê o escopo `sources` uma vez; setting ausente = habilitada, só `'false'` desliga.
  - `collectFromAllSources(query, { enabledSourceIds })` filtra o registry antes de chamar `fetch`. Sem o conjunto, a própria função lê os settings — qualquer call site respeita o toggle, não só `runCollection`.
  - `runCollection` deriva o conjunto da mesma leitura de settings usada para as palavras-chave, repassa para `deps.coletar` (defesa em profundidade) e devolve `executedSources`/`skippedSources`; com todas desligadas não percorre as camadas de busca.
  - Log da coleta lista as fontes puladas; `/api/admin/collect-now` devolve os campos novos e o painel em Settings mostra "N fontes consultadas; M desativadas: ...". Quando todas estão desligadas, o painel diz "Coleta não executada" em vez de "as fontes responderam".
  - Testes: `source-filter.integration.test.ts` (4) prova registry não chamado para fonte desligada, setting ausente habilitada, `'true'` habilitada e conjunto vazio; `job-collection.integration.test.ts` ganhou 3 casos (conjunto repassado, setting ausente, todas desligadas). Web `collection-result.test.ts` ganhou 4 casos (singular/plural, todas desligadas, compatibilidade).
  - Verificação: API typecheck=0 lint=0 (107 warnings pré-existentes) test=281; web typecheck=0 lint=0 test=84 build=0.
