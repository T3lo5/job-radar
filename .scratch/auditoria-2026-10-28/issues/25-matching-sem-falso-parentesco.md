# 25 — Matching sem falso parentesco

Status: resolved
Sprint: 1
Prioridade: P2
Área: api
Esforço: médio
Origem: [auditoria §5.2–5.3](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O motor de matching usa `includes` nos dois sentidos, então "Java" é tratado como relacionado a "JavaScript" e "React" a "R". A senioridade ignora o campo `job.seniority` e olha só o título, o que distorce o score.

## Evidência

- `apps/api/src/services/matching/engine.ts:425-448` — `includes` bidirecional.
- `apps/api/src/services/matching/engine.ts:178-210` — senioridade só pelo título.

## Correção

1. Substituir `includes` por igualdade de token + grupos explícitos de aliases (`js`/`javascript`, `ts`/`typescript`, `postgres`/`postgresql`).
2. Nunca considerar relacionadas skills que apenas compartilham prefixo (`java`/`javascript`, `react`/`r`).
3. Usar `job.seniority` quando presente; título como fallback. Penalizar mismatch real e não penalizar quando o campo está ausente.
4. Expor no breakdown por que uma skill casou (exato, alias, grupo).
5. Adicionar casos de regressão ao catálogo de testes.

## Critérios de aceite

- [x] "Java" no CV não pontua para vaga de "JavaScript" e vice-versa.
- [x] "React" não pontua para vaga que só pede "R".
- [x] Vaga com `seniority: JUNIOR` e usuário sênior é penalizada; campo ausente não penaliza.
- [x] Breakdown mostra o motivo da correspondência.

## Testes

- Tabela de pares (skill do CV, skill da vaga, esperado).
- Teste de senioridade com campo presente e ausente.

## Comments

- 2026-10-28 — Matching por igualdade de token, sem `includes`.
  - `normalizeSkillName` continua cuidando de grafia (`Node.js` → `node`, `C++` ≠ `C#`); `canonicalSkillName` aplica `SYNONYM_GROUPS` fechados (`js`/`javascript`, `ts`/`typescript`, `postgres`/`postgresql`, `k8s`/`kubernetes`…). Grafia conhecida vale match cheio (`ALIAS`), não parcial.
  - `findRelatedMatch` deixou de comparar com `includes` nos dois sentidos e passou a exigir igualdade do nome canônico dentro de `RELATED_GROUPS`. `java` não casa mais com `javascript`, `react` não casa com `r`, e `next` não casa com `nextjs` por prefixo.
  - O índice do perfil (`byNormalized`/`byCanonical`) inclui os aliases declarados no catálogo e a forma canônica de cada skill. O recorte `collectRelevantSkills` foi mantido: ele é o que evita ler o catálogo inteiro no pipeline.
  - Senioridade: `job.seniority` é a fonte primária (inclusive quando o título diz outra coisa) e o título só entra quando o campo é `null`/`UNKNOWN`; sem nenhum dos dois, o critério devolve 100 — antes assumia MID e penalizava perfis sênior/lead por informação ausente. Perfil sem senioridade continua neutro (50).
  - `MatchBreakdown` ganhou `skillEvidence` (`{ skill, reason: EXACT|ALIAS|GROUP, via? }`), produzido pelo motor e persistido no JSON do match. O detalhe da vaga lista “Por que as skills casaram” com rótulos do shared (`SKILL_MATCH_REASON_LABELS`); `analysis-step` passou a filtrar só entradas numéricas do breakdown, para a lista não virar “ponto forte”.
  - Tipos: o motor passou a usar o `MatchBreakdown` de `packages/shared` (fonte única com a UI) e `upsertMatch` aceita `breakdown: unknown`, já que agora ele carrega lista além dos critérios.
  - Testes: `engine.parentesco.test.ts` (21) com tabela de pares (Java×JavaScript, React×R, JS×JavaScript, TS×TypeScript, Postgres×PostgreSQL, Vue×React, Kubernetes×Docker), evidência EXACT/ALIAS/GROUP/ausente e senioridade (campo presente, campo vencendo título, título como fallback, campo ausente sem penalidade, perfil neutro). `engine.invariants.test.ts` ganhou o caso “JS é sinônimo, Java não é prefixo”.
  - Verificação: API typecheck=0 lint=0 test=398; web typecheck=0 lint=0 test=96 build=0; shared test=23 lint=0.
