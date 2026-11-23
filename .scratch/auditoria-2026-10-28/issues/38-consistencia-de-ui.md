# 38 — Consistência de UI e formatação

Status: ready-for-agent
Sprint: 3
Prioridade: P2
Área: web
Esforço: médio
Origem: [auditoria §5.15–5.22](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Pequenas inconsistências somadas fazem o produto parecer inacabado: enums crus na tela, três vocabulários de score, três formatações de salário, `sourceId` (cuid) exibido como nome da fonte, datas que deslocam 1 dia em UTC-3, delete sem confirmação e empty states que recarregam o app.

## Evidência

- `apps/web/src/pages/analytics.tsx:149`, `dashboard.tsx:62`, `profile.tsx:915` — enum cru.
- `match-label.ts`, `dashboard.tsx:45`, `profile.tsx:1312` — três faixas de score.
- `jobs.tsx:336`, `job-detail.tsx:141`, `profile.tsx:851` — três formatações de salário.
- `jobs.tsx:344` — `job.sourceId` como nome.
- `applications.tsx:636`, `profile.tsx:1417` — data `YYYY-MM-DD` desloca 1 dia.
- `jobs.tsx:195-198` — filtro omite `EXTRACTING`/`ANALYZING`.
- `settings.tsx:547` e ~12 pontos — delete sem confirmação.
- `empty-state.tsx:43-46` — `<a href>` recarrega o app.

## Correção

1. Um mapa único de labels PT-BR em `packages/shared` para status, senioridade, nível, recomendação e ATS.
2. Uma função de faixas de score (`matchLabelFor`) usada em todas as telas.
3. `formatSalary`, `formatDate` e `formatLocation` únicos em `packages/shared`.
4. `job.source.name` no card; nunca exibir `sourceId`.
5. `AlertDialog` para toda ação destrutiva.
6. Empty states com `<Link>` do react-router.
7. Completar o filtro de status com `EXTRACTING` e `ANALYZING`.

## Critérios de aceite

- [ ] Nenhum enum cru aparece na UI.
- [ ] Um único vocabulário de score no app.
- [ ] Salário e data formatados igual em todas as telas.
- [ ] Nome da fonte sempre legível.
- [ ] Toda ação destrutiva pede confirmação.
- [ ] Nenhum `<a href>` interno recarrega o app.
- [ ] Filtro lista todos os status possíveis.

## Testes

- Teste de snapshot dos formatadores.
- Teste de que nenhuma página renderiza `/[A-Z_]{4,}/` como texto visível.
- Teste de confirmação de delete.

## Comments
