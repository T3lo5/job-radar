# 32 — Carta PT/EN com integridade

Status: ready-for-agent
Sprint: 2
Prioridade: P1
Área: api + web
Esforço: médio
Origem: [auditoria §4.10](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A carta de apresentação é **sempre gerada em inglês**, mesmo para vaga em português. A descrição é cortada em 3.000 caracteres sem avisar. O campo de recrutador existe na API mas a UI não envia. E a carta não passa pela checagem de integridade, então pode inventar experiência.

## Evidência

- `apps/api/src/services/cover-letter.ts:26` — "Write in English" fixo.
- `apps/api/src/services/cover-letter.ts:40` — corte silencioso em 3.000 caracteres.
- `apps/web/src/pages/job-detail.tsx:316-332` — não envia `recruiterName`.
- `apps/api/src/services/cv-integrity.ts` — usado no CV, não na carta.

## Correção

1. Idioma como parâmetro, default = idioma detectado da vaga (`pt-BR`/`en`), com override na UI.
2. Não truncar silenciosamente: resumir a descrição com aviso explícito ou aumentar o limite e informar.
3. Campo de recrutador na UI, opcional, usado no cabeçalho da carta.
4. Rodar `checkCvIntegrity` na carta e bloquear/avisar skills sem evidência.
5. Salvar `language` e `runType` na execução (migration do ticket 06).

## Critérios de aceite

- [ ] Vaga em português gera carta em português; vaga em inglês, em inglês.
- [ ] Override de idioma funciona e é persistido.
- [ ] Descrição longa não é cortada sem aviso.
- [ ] Recrutador informado aparece na carta.
- [ ] Skill sem evidência na carta gera aviso/bloqueio, não passa silencioso.

## Testes

- Teste com vaga PT e EN verificando idioma da saída.
- Teste de integridade com "Go"/"Google" na carta.
- Teste de descrição com 10.000 caracteres.

## Comments
