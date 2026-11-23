# 43 — Resiliência do SettingsService quando o Redis cai

## Question

Conforme item "Not yet specified" do `map.md` (depende de #41):

> Como o SettingsService reage se o Redis cair (fallback pra DB sem cache?) — depende de #41

O SettingsService já tenta Redis (L2) e cai para Postgres (L3) em caso de falha, mas o comportamento é implícito: o erro é engolido em `try/catch` silencioso, sem logging nem alerta. É necessário:

- **Fallback explícito documentado**: `get` e `set` nunca falham por causa do Redis; Redis fora do ar degrada para leitura/gravação direta no Postgres (sem cache L2).
- **Logging quando Redis falha**: registrar (Pino/logger da API) que o Redis está indisponível, para observabilidade e debug.
- **Cache L1 preservado**: memory cache continua funcionando normalmente mesmo com Redis down.
- **Invalidacao best-effort**: `set` tenta apagar chaves antigas no Redis; se falhar, segue em frente (o valor antigo expira pelo TTL de 30s).
- **Teste**: simular Redis down e garantir que `get`/`set` ainda funcionam via DB.

## Blocked by

41 (Settings via UI frontend completo — SettingsService existe)

## Type

task

## Status

complete

## Resolution

**SettingsService com fallback explícito para Redis indisponível (`apps/api/src/services/settings-service.ts`):**
- `get`: try/catch ao redor do `redis.get`; se Redis falhar, loga `warn` com Pino e cai para Postgres (L3)
- `set`: try/catch ao redor de `redis.setex` (gravação no cache) e `redis.del` (invalidação); se falhar, loga `warn` e segue gravo no banco
- Cache L1 (memória) preservado independente do Redis
- Logging com Pino (`settings-service`) quando Redis está indisponível, para observabilidade
- Dependência `pino` adicionada como direta no `apps/api/package.json`

**Teste:** `apps/api/src/services/settings-redis-fallback.test.ts` (3 testes)
- `get` faz fallback para Postgres quando Redis lança ECONNREFUSED
- `set` grava no Postgres mesmo com Redis down
- `get` retorna null para chave inexistente com Redis down

**Validação:** `pnpm typecheck` ✓, `pnpm lint` ✓ (0 erros), `pnpm test` ✓ (488 passando)
