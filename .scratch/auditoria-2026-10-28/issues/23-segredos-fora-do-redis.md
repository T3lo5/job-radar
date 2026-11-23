# 23 — Segredos fora do Redis em claro

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.12](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O cache L2 grava valores **já decifrados** no Redis. Quem tiver acesso a backup, réplica ou `redis-cli` obtém API keys de IA e token do Telegram em texto claro — anulando a criptografia em repouso do Postgres.

## Evidência

- `apps/api/src/services/settings-service.ts:106` — `redis.setex(cacheKey, TTL, value)` com valor decifrado.
- `apps/api/src/services/settings-service.ts` — settings com `encrypted: true`.
- ADR-0005 — criptografia AES-256-GCM dos settings.

## Correção

1. Para settings `encrypted: true`, cachear apenas o ciphertext (o mesmo que está no banco) ou pular o cache L2.
2. Decifrar somente em memória, no momento do uso.
3. Incluir versão do formato no cache para invalidar entradas antigas.
4. No boot ou em comando administrativo, limpar chaves de cache legadas que possam conter plaintext.
5. Documentar a decisão no ADR-0005 ou em nota complementar.

## Critérios de aceite

- [x] `redis-cli KEYS 'settings:*'` + `GET` não revela nenhum valor sensível.
- [x] Settings criptografados continuam funcionando com cache (ou sem L2).
- [x] Cache é invalidado ao salvar um setting.
- [x] Teste inspeciona o Redis após ler um setting secreto e não encontra o plaintext.

## Testes

- Teste de integração com Redis de teste: gravar setting secreto, ler, inspecionar chaves.
- Teste de invalidação ao atualizar.

## Comments

- 2026-10-28 — Segredo saiu do Redis em claro.
  - Chave do cache virou `settings:v2:<scope>:<key>` (`CACHE_PREFIX`/`CACHE_VERSION`); a chave do Postgres continua `settings:<scope>:<key>`.
  - Segredo é serializado como `{ v: 2, encrypted: true, ciphertext, iv, tag }` — os mesmos campos do banco. A decisão vem de `Setting.encrypted`, não do argumento `isSecret`, então linha gravada antes da correção continua protegida. Não-segredo usa `{ v: 2, encrypted: false, value }`.
  - `decodeCacheEntry` valida versão e decifra em memória no uso; entrada de formato antigo/corrompida é descartada (`redis.del`) e a leitura cai para o banco.
  - `set` apaga L1, a chave versionada e a chave legada (que podia conter plaintext).
  - `purgeLegacyCache()` (`SCAN`, não `KEYS`) remove no boot toda chave `settings:*` sem a versão; chamada em `server.ts` antes dos workers, com falha só logada.
  - ADR-0005 ganhou nota complementar com a correção e o trade-off.
  - Testes: `settings-secrets.integration.test.ts` (6, com Postgres e Redis reais em DB 1): depois de ler o segredo, `SCAN`+`MGET` em `settings:*` não encontra o plaintext e a entrada é o ciphertext; instância nova decifra a partir do L2; salvar de novo invalida L1/L2 (sem o valor antigo no Redis); setting não secreto continua em claro; `purgeLegacyCache` apaga chave legada e preserva a versionada; sem legado, não remove nada.
  - Verificação: API typecheck=0 lint=0 test=359.
