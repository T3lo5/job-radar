# 26 — Pipeline resiliente e testado

Status: resolved
Sprint: 1
Prioridade: P2
Área: api
Esforço: médio
Origem: [auditoria §5.8–5.10, 5.27](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O pipeline trata `FAILED` como etapa concluída, então retry nunca reprocessa; `recommendation` nunca produz `APPLY`; `redisConnectionOptions()` instancia um `Redis` novo a cada chamada e vaza conexões; e `pipeline.test.ts` testa um array local, passando mesmo se o pipeline sumir.

## Evidência

- `apps/api/src/services/pipeline/orchestrator.ts:18-25` — `FAILED` conta como concluído.
- `apps/api/src/services/pipeline/analysis-step.ts:17-28` — `recommendation` nunca `APPLY`.
- `apps/api/src/db/redis-connection.ts:18` — `new Redis()` por chamada.
- `apps/api/tests/pipeline.test.ts:47-60` — testa array local.

## Correção

1. `FAILED` deixa de contar como etapa concluída; persistir progresso por etapa e permitir retry apenas das pendentes.
2. Mapear as respostas reais do prompt para `APPLY`/`CONSIDER`/`SKIP`; logar quando cair no default.
3. `redisConnectionOptions()` retorna apenas opções derivadas da URL, sem instanciar cliente.
4. Reescrever `pipeline.test.ts` contra o `orchestrator` real com dependências fake; apagar o teste de array.
5. Adicionar limite de tentativas e backoff com jitter.

## Critérios de aceite

- [x] Retry após falha reprocessa a etapa que falhou.
- [x] Uma análise com recomendação clara produz `APPLY`.
- [x] Nenhuma conexão Redis é criada por chamada de opções (teste com contador).
- [x] Se o orchestrator for removido, o teste falha.
- [x] Teste cobre falha → retry → sucesso.

## Testes

- Teste de orquestração com etapa que falha uma vez e depois passa.
- Teste de mapeamento de recomendação.
- Teste de `redisConnectionOptions` sem side effects.

## Comments

- 2026-10-28 — Pipeline que sobrevive a falha e teste que enxerga o pipeline.
  - `FAILED` deixou de contar como etapa concluída. Quando um step falha, o orquestrador lê o status corrente (EXTRACTING/MATCHING/ANALYZING) e grava em `JobProcessingLog.fromStatus` junto com `toStatus: FAILED`. No retry, `effectiveStatus()` troca FAILED por esse `fromStatus`, então a guarda de idempotência pula o que já foi feito e reprocessa só a etapa pendente. Vaga FAILED sem log (dado antigo) é tratada como RAW.
  - Vaga inexistente não executa mais step nenhum (antes o step rodava e retornava vazio).
  - `PipelineOrchestrator` ganhou `PipelineOptions` (`steps`, `deps`, `progressDb`) para testes com steps fake e banco em memória; produção continua usando os steps reais, `createJobExtractor`/`createJobAnalyzer` e o Prisma.
  - `mapRecomendacao(rec, score)`: `Candidatar` → `APPLY` (sobe para `STRONG_APPLY` só com score >= 85, mesmo corte do motor), `Avaliar` → `CONSIDER`, `Ignorar` → `SKIP`; qualquer outra resposta cai em `CONSIDER` com `console.warn` — o default silencioso escondia mudança de vocabulário do provedor. `analysis-step` passa `analysis.score` nas duas chamadas (update/create).
  - `redisConnectionOptions()` deriva `host`, `port`, `username`, `password`, `db` e `tls` (rediss) da URL com `parseRedisUrlOptions`, sem instanciar cliente. A função morta `redisConnection()` foi removida. URL inválida, protocolo errado e database não numérico falham com mensagem explícita.
  - `workers/backoff.ts`: `MAX_ATTEMPTS=3`, backoff exponencial com jitter entre 50% e 100% do intervalo, teto de 5 min. As duas filas usam `backoff: { type: 'jitter' }` e os workers registram `settings.backoffStrategy`.
  - Testes: `src/tests/pipeline.test.ts` reescrito (8) contra o orquestrador real: executa step, idempotência, step desconhecido, falha → FAILED + fromStatus + erro propagado, falha → retry → sucesso, retry não repete etapas anteriores, FAILED antigo, vaga inexistente. `analysis-step.test.ts` (7) cobre os quatro mapeamentos, caixa/espaço, default logado e a evidência de skill fora dos pontos fortes. `redis-connection.test.ts` (5) conta construções de `Redis` (zero) e valida parse/TLS/defaults/erros. `backoff.test.ts` (5) cobre crescimento, faixa do jitter, teto e tentativa inválida. `chain.integration.test.ts` ganhou o caso falha real no matching → retry → DONE, e a recomendação 82 agora é `APPLY`.
  - Verificação: API typecheck=0 lint=0 test=417; web test=96; shared test=23.
