# 27 — Página de detalhe da vaga

## Question

Tela `/jobs/:id` com:

- Cabeçalho: título, empresa, localização, salário, link externo
- Score badge + breakdown visual
- Skills matched / partial / missing
- Requisitos (obrigatórios, desejáveis)
- Análise IA (resumo, pontos fortes, fracos, riscos, recomendação)
- Ações: marcar como aplicada, gerar CV otimizado, abrir link externo
- Histórico de eventos da vaga

## Type

task

## Status

done

## Resolution

**Detalhe da Vaga** (`apps/web/src/pages/job-detail.tsx`):

- Header: título, empresa, localização, salário, link externo
- Score badge + breakdown visual (technologies, experience, etc.)
- Botão "Avaliar Match" (se não avaliado)
- Descrição completa da vaga
- Ações: marcar como aplicar, gerar CV, arquivar
- Rota: `/jobs/:id`

**Validação:**
- `pnpm typecheck` ✓
