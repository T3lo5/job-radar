# 37 — Testes de unidade para matching engine

## Question

Cobertura mínima do matching engine (que é o coração):

- Match perfeito (todas skills batem) → 100% (ou cap em 95% se techs não são 100% do score)
- Match parcial (algumas skills) → score proporcional
- Match zero (nenhuma skill) → score baixo mas não zero (outros critérios)
- Skill com sinonímia → conta como match
- Skill ausente → conta como missing, nunca como matched
- Senioridade inferior → penalidade
- Localização incompatível → penalidade

Framework: Vitest (mais moderno, compatível com TS e Vite). Rodar no CI.

## Type

task

## Status

done

## Blocked by

19

## Implementation

- Vitest configured for unit testing
- 9 test cases covering:
  - Perfect match (all skills match)
  - Partial match (some skills)
  - Zero match (no skills)
  - Synonym matching
  - Unmatched skills never marked as matched
  - Seniority penalty
  - Location penalty
  - Recommendation thresholds (STRONG_APPLY, SKIP)
- All tests passing
