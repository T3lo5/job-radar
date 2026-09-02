# 13 — Extração de informações do CV via IA

## Question

Prompt para o LLM extrair do texto do CV:

- Skills (mapeadas para o catálogo `skills` existente; criar novas se necessário)
- Experiências (cargo, empresa, período, descrição)
- Formação
- Idiomas
- Senioridade inferida
- Anos de experiência total

Não inventar nada: se o CV não diz, não inferir. **Crucial para a regra de "IA não inventa"**.

Endpoint `POST /api/resumes/:id/extract`. Botão no frontend que dispara e popula o perfil (com confirmação do usuário).

## Type

task

## Status

done

## Blocked by

12, 41 (precisa da config de IA salva pelo usuário)

## Implementation

- `POST /api/resumes/:id/extract` endpoint
- Uses `extractCvData()` from AI provider
- Extracts: name, email, phone, title, summary, skills, experience, education, languages
- Stores parsed data in `resume.parsedJson`
- Returns extracted data for user confirmation before profile population
- AI rule: never invent information not present in CV
