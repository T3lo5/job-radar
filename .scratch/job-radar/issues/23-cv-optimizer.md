# 23 — CV Optimizer: comparação e sugestões

## Question

Feature que compara CV × vaga e gera versão otimizada:

- LLM recebe CV original (texto extraído) + vaga + perfil + skills matched/missing
- Identifica keywords ausentes (presentes na vaga, ausentes no CV)
- Sugere melhorias de redação em bullets existentes (NÃO inventa)
- Sugere reordenação de seções
- Gera resumo profissional adaptado à vaga

Endpoint `POST /api/cv/optimize` retornando versão otimizada como texto + diff. Frontend mostra split view CV original / otimizado.

**Regra**: o LLM só pode reorganizar/reescrever informações verdadeiras do CV original. Se algo não está no CV, não pode ser adicionado.

## Type

task

## Status

done

## Blocked by

21, 12

## Implementation

- `POST /api/cv/optimize` endpoint
- Uses `optimizeCv()` from AI provider
- Returns: original text, optimized text, changes list, keywords added, summary
- AI rule: only reorganize/rewrite existing information, never invent
- Takes resumeId and jobId as input
