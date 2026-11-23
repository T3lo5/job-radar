# 17 — Calibrar o ATS checker

Status: ready-for-human
Sprint: 1
Prioridade: P1
Área: api
Esforço: médio
Origem: [auditoria §4.5](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O verificador de ATS acusa múltiplas colunas em um CV normal de uma coluna. Reproduzido com um CV de uma coluna e bullets curtos: `score: 80` + `issues: ["MULTI_COLUMN"]`. Um score que erra o diagnóstico destrói a confiança na feature inteira — pior que não ter score.

## Evidência

- `apps/api/src/services/cv-ats-checker.ts:103-112` — multi-coluna quando `shortLines > longLines * 1.5 && shortLines > 20`; listas de skills e bullets disparam.
- `apps/api/src/services/cv-ats-checker.ts:114-120` — `detectContactBlock` considera `hasName` sempre verdadeiro (qualquer linha).
- Probe registrado na auditoria: CV de uma coluna → `hasMultiColumn: true`, score 80.

## Correção

1. Trocar a heurística de comprimento de linha por detecção estrutural: gaps horizontais, posição de blocos, proporção de linhas com múltiplos spans no PDF, ou análise de layout quando disponível.
2. Quando só houver texto, **não afirmar** multi-coluna: classificar como "não foi possível avaliar layout" e não penalizar o score.
3. Corrigir `detectContactBlock` para exigir nome plausível (ex.: 2–4 palavras capitalizadas nas primeiras linhas) e ao menos um contato.
4. Separar `score` de `issues`: issue de baixa confiança vira sugestão, não penalidade.
5. Calibrar com um corpus de 10–20 CVs reais (1 e 2 colunas), versionado fora do git se contiver PII, com resultado esperado por arquivo.

> Este ticket exige corpus real e julgamento humano na calibração — por isso `ready-for-human`.

## Critérios de aceite

- [ ] Nenhum CV de uma coluna recebe `MULTI_COLUMN` no corpus de calibração.
- [ ] CVs de duas colunas continuam detectados.
- [ ] `hasName` só é verdadeiro quando há nome plausível.
- [ ] Score não cai por issue de baixa confiança.
- [ ] Corpus e resultados esperados ficam documentados em `docs/` ou `apps/api/tests/fixtures/ats/`.

## Testes

- Teste de snapshot por arquivo do corpus: issues e faixa de score esperados.
- Teste unitário de `detectContactBlock` com e sem nome.

## Comments
