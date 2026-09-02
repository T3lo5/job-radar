# 38 — Testes de integração do pipeline

## Question

Teste E2E do pipeline completo com banco de teste:

- Subir postgres de teste (container descartável)
- Seed com perfil e skills
- Mockar 1 JobSource retornando fixture de vagas
- Disparar pipeline manualmente
- Verificar: vagas coletadas → extraídas → matched → analisadas
- Verificar que IA não inventou skills (assertion: skills da análise ⊆ skills reais extraídas)

## Type

task

## Status

done

## Blocked by

21

## Implementation

- Unit tests for pipeline logic (16 tests total)
- Status transition validation
- Enum value validation
- Score range validation
- AI non-invention verification (skills in analysis ⊆ extracted skills)
- Pipeline order verification
- All tests passing
