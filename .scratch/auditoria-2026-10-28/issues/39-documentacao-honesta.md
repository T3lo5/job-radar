# 39 — Documentação honesta

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: docs
Esforço: baixo
Origem: [auditoria §5.30](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

`IMPROVEMENTS.md` e o README marcam como concluído o que não está implementado. Isso faz o próximo agente (ou o próprio dono) assumir que uma feature existe e construir em cima de uma base falsa. A auditoria só foi confiável porque cada item foi verificado no código.

## Evidência

- `IMPROVEMENTS.md` — Fase 1/2 marcadas como feitas sem correspondência no código.
- `README.md` — instruções de deploy que não funcionam na prática.
- Relatório `docs/audits/2026-10-28-produto-e-tecnica.md` — evidências por item.

## Correção

1. Reabrir em `IMPROVEMENTS.md` todo item cuja evidência não exista, citando o ticket correspondente.
2. Marcar como feito apenas o que tem teste ou commit verificável; linkar a evidência.
3. Corrigir o README: deploy real, variáveis obrigatórias (`SETTINGS_ENCRYPTION_KEY`, `CORS_ORIGINS`), limitações conhecidas.
4. Adicionar seção "Estado atual" com o que funciona e o que é experimental.
5. Referenciar os tickets desta pasta a partir dos itens abertos.

## Critérios de aceite

- [ ] Nenhum item marcado como feito sem evidência (teste ou código).
- [ ] README não promete deploy que falha.
- [ ] Variáveis obrigatórias documentadas com exemplo.
- [ ] Limitações conhecidas (single-user, ATS heurístico, coleta dependente de fontes) explícitas.
- [ ] Cada item aberto aponta para um ticket em `.scratch/auditoria-2026-10-28/`.

## Testes

- Revisão manual item a item contra o código.
- `grep` de links quebrados para `.scratch/`.

## Comments
