# 35 — Página de analytics (frontend)

## Question

Tela `/analytics` com:

- Cards de KPIs (aplicações, entrevistas, taxa de resposta, taxa de entrevista)
- Gráfico de linha: aplicações por semana
- Gráfico de barra: distribuição de matches
- Heatmap ou tabela: skills mais pedidas vs suas skills
- Lista: top cargos com melhor resposta
- Lista: top gaps (skills que aparecem em vagas mas você não tem)

Filtros de período: 7 dias, 30 dias, 90 dias, tudo.

## Type

task

## Status

done

## Blocked by

34

## Implementation

- `/analytics` page with period filters (7, 30, 90 days)
- KPI cards: total applications, applied, interview rate, offers
- Bar chart: match distribution by score range
- Funnel view: applications by status
- Skills sections: most frequent in applied jobs, biggest gaps
- Added to navigation menu
