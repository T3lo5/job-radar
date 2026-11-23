# 44 — Pesos finais do score de matching

## Question

Conforme item "Not yet specified" do `map.md` (depende de #19, já completo):

> Pesos finais do score de matching (os 35/20/15/10/10/5/5 são um chute inicial) — depende de #19

O matching engine (`apps/api/src/services/matching-engine.ts` ou similar) calcula um score 0-100 com pesos iniciais: tech 35%, exp 20%, seniority 15%, location 10%, cloud 10%, lang 5%, other 5%. Estes são um "chute inicial" e precisam ser definidos definitivamente.

Decisões a tomar:

- **Pesos finais por critério**: qual a distribuição definitiva entre tech, experiência, senioridade, localização, cloud, idioma e outros?
- **Configurabilidade**: os pesos devem ser fixos em código ou configuráveis via Settings (escopo `ai` ou `matching`)?
- **Normalização**: como lidar com critérios ausentes na vaga (ex: vaga não especifica idioma — esse peso é redistribuído ou ignorado?)
- **Testes**: atualizar os 9 testes unitários do matching engine (ticket 37) com os pesos finais e verificar se ainda passam
- **Documentação**: atualizar CONTEXT.md com a faixa de match e os pesos finais

## Blocked by

19 (Matching Engine já implementado)

## Type

task

## Status

complete

## Resolution

**Pesos finais do score de matching** (`apps/api/src/services/matching/engine.ts`, linha 20-29):
- technologies: 0.40 (40%)
- experience: 0.22 (22%)
- seniority: 0.16 (16%)
- location: 0.10 (10%)
- cloudDevOps: 0.07 (7%)
- languages: 0.05 (5%)
- Soma: 100%

**Decisão:** mantidos os pesos já implementados (fixos em código, não configuráveis via Settings por enquanto). Justificativa: sistema single-user, sem dados empíricos para justificar alteração, e os pesos atuais já estão em produção passando nos 9 testes unitários do matching engine (ticket 37).

**Score neutro:** 50 (quando não há sinal suficiente em um critério — "não sei" não é "está errado").

**Testes:** 9 testes unitários em `engine.invariants.test.ts` passando com os pesos atuais.
