# 20 — Classificação visual de match

## Question

Mapear score → label:

- 90-100: 🔥 Excelente
- 80-89: 🟢 Muito boa
- 70-79: 🟡 Boa
- 60-69: 🟠 Possível
- <60: 🔴 Baixa

Função utilitária pura. Usada em frontend e backend (Telegram).

## Type

task

## Status

done

## Resolution

**Já implementado** em `@job-radar/shared`:

- `matchLabelFor(score)` — função pura que retorna label baseado no score
- `MATCH_LABELS` — constante com label + emoji para cada faixa

**Faixas:**
- 90-100: 🔥 Excelente
- 80-89: 🟢 Muito boa
- 70-79: 🟡 Boa
- 60-69: 🟠 Possível
- <60: 🔴 Baixa

**Uso:** Endpoint `GET /match/:score/label` já retorna label, emoji e texto.
Disponível para frontend e backend (Telegram).
