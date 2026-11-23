# 29 — Índice de confiança da vaga

Status: needs-triage
Sprint: 2
Prioridade: P2
Área: api + web
Esforço: médio
Origem: [auditoria §6.4, §7.2](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Vagas fantasmas e repetidas minam a confiança: estimativas públicas apontam que 1 em cada 4–5 vagas pode não existir. O Job Radar já coleta `publishedAt`, `collectedAt`, `sourceCount`, salário, descrição e URL — mas não usa nada disso para ajudar o usuário a descartar vaga duvidosa.

## Evidência

- `apps/api/prisma/schema.prisma` — campos de frescor, `sourceCount` e dedup já existem.
- `apps/api/src/services/job-service.ts` — listagem não expõe sinal de confiança.
- Fonte: BBC Brasil, *Vagas fantasmas*.

## Correção proposta

1. Calcular um índice 0–100 com sinais explícitos: frescor, recorrência entre fontes, salário presente, descrição completa, URL válida, empresa repetida.
2. Exibir selos legíveis: "vista em 3 fontes", "publicada há 2 dias", "sem salário", "possível repetição".
3. Página/filtro "esconder vagas com baixa confiança", com explicação de cada sinal.
4. Nunca esconder por default; o usuário escolhe.
5. Registrar no detalhe por que a vaga foi marcada.

## Questões abertas (triagem)

- Faixa de corte para "baixa confiança"? **Recomendação:** começar com 40 e calibrar com os dados reais.
- "Empresa repetida" deve contar como sinal positivo (recrutando muito) ou negativo? **Recomendação:** neutro; exibir contexto.
- O índice entra no match score? **Recomendação:** não; sinal separado para não misturar.

## Critérios de aceite

- [ ] Toda vaga listada tem índice e ao menos um selo quando aplicável.
- [ ] Usuário entende por que a vaga foi marcada, sem caça às bruxas.
- [ ] Filtro de confiança funciona e é reversível.
- [ ] Nenhuma vaga é ocultada sem ação do usuário.
- [ ] Teste com vaga fresca, vaga antiga e vaga duplicada.

## Testes

- Teste unitário do cálculo por sinal.
- Teste de listagem com filtro aplicado.

## Comments
