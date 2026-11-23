# 28 — Cockpit anti-ghosting

Status: needs-triage
Sprint: 2
Prioridade: P1
Área: fullstack
Esforço: baixo
Origem: [auditoria §6.1, §7.1](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A dor número 1 do público brasileiro é ghosting: em pesquisa com 1.211 profissionais, **77%** ficaram sem resposta após entrevistas e **39%** dizem que isso acontece na maioria das vezes. O Job Radar já guarda `followUpAt`, histórico de `ApplicationEvent` e tem bot do Telegram — mas não existe nenhum fluxo que transforme esses dados em ação. O sino de follow-up está até invisível (ticket 21).

## Evidência

- `apps/api/prisma/schema.prisma` — `Application.followUpAt` e `ApplicationEvent` já existem.
- `apps/web/src/pages/applications.tsx:765` — único indício de follow-up, invisível.
- `apps/api/src/services/daily-report.ts` — resumo diário não inclui follow-ups vencidos.
- Fonte: Convenia + Opinion Box, *Jornada da pessoa candidata* (nov/2025).

## Correção proposta

1. Card no dashboard: "N candidaturas sem retorno há mais de X dias", com link para a lista filtrada.
2. Por candidatura: última interação, dias parados, próximo passo sugerido e botão "Registrei contato" (cria `ApplicationEvent` e reagenda).
3. Templates de mensagem: follow-up inicial, agradecimento pós-entrevista, retomada após silêncio e contraproposta — editáveis e copiáveis.
4. Incluir os follow-ups do dia no resumo do Telegram.
5. Configuração de cadência (ex.: 7/14/21 dias) em settings.

## Questões abertas (triagem)

- A cadência deve ser global ou por candidatura? **Recomendação:** global com override por candidatura.
- O botão "Registrei contato" deve enviar algo pelo Telegram ou só registrar? **Recomendação:** só registrar; envio manual.
- Quais templates entram no MVP? **Recomendação:** follow-up inicial + pós-entrevista.

## Critérios de aceite

- [ ] Em < 10 s o usuário vê o que precisa cobrar hoje.
- [ ] "Registrei contato" atualiza a última interação e reagenda o próximo follow-up.
- [ ] Resumo diário lista os follow-ups vencidos.
- [ ] Nenhuma candidatura arquivada/rejeitada aparece como pendente.

## Testes

- Teste de cálculo de "dias parados" com timezone America/Sao_Paulo.
- Teste de reagendamento ao registrar contato.
- Teste do card do dashboard com 0, 1 e N pendentes.

## Comments
