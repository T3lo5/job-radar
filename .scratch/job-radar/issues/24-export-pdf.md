# 24 — Export CV otimizado em PDF

## Question

Gerar PDF a partir do texto otimizado. Opções:

- `puppeteer` (Chrome headless, pesado mas flexível)
- `@react-pdf/renderer` (gera PDF a partir de componentes React, leve)
- `pdfkit` (programático, mais controle)
- Template HTML → puppeteer

Manter CV original intacto. Salvar em `resume_versions` (vinculado a uma `application` quando aplicável).

## Type

grilling

## Status

done

## Blocked by

23

## Implementation

- Uses `pdfkit` (lightweight, programmatic)
- `POST /api/cv/export-pdf` — generates PDF from optimized or original text
- Saves to `resume_versions` for history tracking
- `GET /api/cv/versions/:resumeId` — lists all versions
- Returns PDF as downloadable file
