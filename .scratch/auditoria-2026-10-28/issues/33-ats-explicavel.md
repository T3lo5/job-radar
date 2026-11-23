# 33 — ATS explicável e integridade visível

Status: needs-triage
Sprint: 3
Prioridade: P2
Área: fullstack
Esforço: médio
Origem: [auditoria §7.5–7.6](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O ATS devolve um número e uma lista de issues, mas não mostra onde está o problema nem como corrigir. A "Regra de Ouro" (não inventar) não é visível: o usuário recebe um CV otimizado sem saber o que mudou, o que foi removido e por quê. Confiança baixa em currículo gerado por IA é uma dor real (53,1% usaram IA, mas desconfiam).

## Evidência

- `apps/api/src/services/cv-ats-checker.ts` — issues sem trecho/posição.
- `apps/api/src/services/cv-integrity.ts` — resultado não é exibido.
- `apps/web/src/pages/job-detail.tsx` — CV otimizado sem diff.
- Fonte: Heach/Valor via AI Brasil (3.040 profissionais, set/2026).

## Correção proposta

1. Cada issue do ATS carrega trecho exato, confiança e "como corrigir" em 1 parágrafo.
2. Deixar claro: "isto não garante aprovação; ATS organiza, não rejeita sozinho".
3. Diff antes/depois do CV otimizado, destacando o que mudou.
4. Cada bullet novo linkado à evidência (CV original ou perfil).
5. Bloquear (não só avisar) skill sem evidência; listar o que foi removido e por quê.

## Questões abertas (triagem)

- Nível de bloqueio: impedir geração ou apenas marcar para revisão? **Recomendação:** marcar e exigir confirmação explícita.
- Mostrar confiança numérica ou só alta/média/baixa? **Recomendação:** três níveis, para não dar falsa precisão.
- O diff fica no MVP? **Recomendação:** sim; é o principal argumento de confiança.

## Critérios de aceite

- [ ] CV de uma coluna com bullets não é acusado de multi-coluna (depende do ticket 17).
- [ ] Todo alerta aponta o trecho que o gerou.
- [ ] Diff antes/depois disponível para toda otimização.
- [ ] Skill sem evidência é destacada e exige confirmação.
- [ ] Texto explica o limite do ATS.

## Testes

- Teste de snapshot do diff.
- Teste de "Google/Go" e "JavaScript/Java" na UI.
- Teste de confirmação de skill sem evidência.

## Comments
