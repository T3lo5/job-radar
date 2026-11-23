# 30 — Salário primeiro

Status: needs-triage
Sprint: 2
Prioridade: P1
Área: api + web
Esforço: médio
Origem: [auditoria §6.5, §7.3](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

**76%** dos candidatos brasileiros buscam a faixa salarial antes de aplicar (Você RH). Hoje o salário aparece de três formas diferentes, some quando só há um valor, e a Adzuna Brasil grava USD. Não há filtro por faixa nem "não informado" explícito.

## Evidência

- `apps/web/src/pages/jobs.tsx:336`, `job-detail.tsx:141`, `profile.tsx:851` — três formatações.
- Formatação some quando só há `salaryMin` ou `salaryMax`.
- `apps/api/src/sources/adzuna.ts:103` + `normalizer.ts:148` — moeda errada (ver ticket 27).
- Nenhum filtro por salário na listagem.

## Correção proposta

1. `formatSalary` único em `packages/shared`, aceitando mínimo, máximo ou ambos, com moeda e período (mês/ano).
2. Filtros: "com faixa salarial", "a partir de X" e "não informado" como badge explícito.
3. Normalização BRL/USD com taxa configurável; nunca converter silenciosamente sem indicar.
4. Ordenação por salário (respeitando "não informado" no fim).
5. Benchmark agregado: "para React Sênior remoto, as vagas coletadas pagam R$ X–Y", com N visível.

## Questões abertas (triagem)

- Converter USD→BRL automaticamente ou só exibir a moeda original? **Recomendação:** exibir original; conversão só no filtro, com nota.
- Fonte da taxa de câmbio? **Recomendação:** configurável, atualização manual no MVP.
- Benchmark entra no MVP? **Recomendação:** depois dos filtros; depende de N mínimo.

## Critérios de aceite

- [ ] Nenhuma vaga com salário único some.
- [ ] Nenhuma BRL é exibida como USD.
- [ ] "Não informado" é visível, não vazio.
- [ ] Filtro "a partir de X" funciona com dados mistos.
- [ ] Benchmark mostra N e período.

## Testes

- Teste de `formatSalary` com 6 combinações (min, max, ambos, moeda, período, nulo).
- Teste de filtro com valores em BRL e USD.

## Comments
