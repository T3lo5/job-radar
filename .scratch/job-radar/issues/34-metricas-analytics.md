# 34 — Métricas de analytics

## Question

Endpoint `GET /api/analytics/overview` retornando:

- Vagas encontradas (período)
- Vagas analisadas
- Vagas aplicadas
- Entrevistas conseguidas
- Ofertas recebidas
- Taxa de resposta (respostas / aplicações)
- Taxa de entrevista (entrevistas / aplicações)
- Distribuição de matches por faixa (90+, 80-89, etc.)
- Skills mais frequentes nas vagas aplicadas
- Cargo com melhor resposta
- Maior gap (skill que aparece muito nas vagas mas falta no perfil)

## Type

task

## Status

done

## Blocked by

28

## Implementation

- `GET /api/analytics/overview?days=30` returns full analytics
- Jobs: collected count, analyzed count, by-status breakdown
- Applications: total, applied, interviews, offers, rejected, by-status
- Rates: response rate, interview rate, offer rate
- Matches: score distribution (90+, 80-89, 70-79, 60-69, 50-59, <50), average score
- Skills: most frequent in applied jobs, biggest gaps (in jobs but not in profile)
