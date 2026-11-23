# 20 — Analytics honesto

Status: resolved
Sprint: 1
Prioridade: P1
Área: api + web
Esforço: médio
Origem: [auditoria §4.9](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

As taxas são calculadas sobre o status **atual**, não sobre o histórico. `responseRate` mede candidaturas/total (não resposta), `interviewRate` pode passar de 100% e cai conforme o usuário avança, `offerRate` é uma foto instantânea. O usuário toma decisões de carreira com números errados.

## Evidência

- `apps/api/src/services/analytics.ts:150-154` — `responseRate` e `interviewRate`.
- `apps/api/src/services/analytics.ts:208-211` — `offerRate`.
- `ApplicationEvent` já registra o histórico de transições, mas não é usado.
- `apps/web/src/pages/analytics.tsx:149` — exibe o enum cru.

## Correção

1. Calcular coortes por `ApplicationEvent`: para candidaturas criadas em uma janela, quantas chegaram a cada etapa (resposta, entrevista, oferta).
2. Definir e documentar as fórmulas:
   - `responseRate = candidaturas com evento != APPLIED / candidaturas criadas na janela`
   - `interviewRate = candidaturas com evento INTERVIEW+ / candidaturas criadas na janela`
   - `offerRate = candidaturas com evento OFFER / candidaturas criadas na janela`
3. Nunca produzir taxa > 100%; exibir `—` quando o denominador for 0.
4. Enquanto o histórico não estiver completo, renomear os cards para "distribuição atual" e remover a palavra "taxa".
5. Adicionar filtro de período e rótulos PT-BR (não exibir `INTERESTING`, `CV_PREPARED`).

## Critérios de aceite

- [x] Taxas derivam de `ApplicationEvent`, não do status atual.
- [x] Nenhuma taxa excede 100% em nenhum cenário de teste.
- [x] Denominador zero exibe `—`, não `0%` nem `NaN`.
- [x] Cards têm rótulo e tooltip explicando a fórmula.
- [x] Teste de coorte com candidaturas que avançaram e regrediram.

## Testes

- `apps/api/tests/analytics.test.ts`: coorte com 10 candidaturas em etapas variadas; taxas esperadas.
- Teste de que mover uma candidatura para INTERVIEW não altera a taxa de resposta da coorte anterior.

## Comments

- 2026-10-28 — Taxas passaram a ser de coorte, por histórico.
  - `getAnalyticsOverview` roda um `FILTER` sobre `applications` criadas na janela, com `EXISTS` em `application_events`: resposta = INTERVIEW/REJECTED/OFFER, entrevista = INTERVIEW/OFFER, oferta = OFFER. O status atual entra como fallback para candidaturas anteriores ao registro de eventos, então registros antigos não somem.
  - `EXISTS` conta cada candidatura no máximo uma vez: numerador é subconjunto do denominador por construção. `Math.min(1, …)` fica como cinto de segurança. Denominador zero devolve `null` (JSON), não `0`.
  - Resposta ganhou `cohort { total, responded, interviewed, offered }`; `rates.*` agora é `number | null`.
  - Cards do Analytics: "Candidaturas no período", "Respostas na coorte", "Entrevistas na coorte", "Ofertas na coorte", cada um com `title` explicando a fórmula e rodapé "X de Y". `formatRate` mostra "—" para `null` e limita a 100%. O funil virou "Distribuição atual por status" e usa `APPLICATION_STATUS_LABELS` (PT-BR) do shared.
  - Testes: `analytics.integration.test.ts` ganhou 4 casos de coorte (10 candidaturas com IDs e regressões: taxas 50%/30%/10%; transições repetidas não passam de 100%; mover candidatura fora da janela não altera a coorte; coorte vazia → `null`). O caso de banco vazio agora espera `null` em vez de `0`.
  - Verificação: API typecheck=0 lint=0 test=328; shared test=23 lint=0; web typecheck=0 lint=0 test=92 build=0.
