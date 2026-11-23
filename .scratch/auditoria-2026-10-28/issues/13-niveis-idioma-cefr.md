# 13 — Níveis de idioma em CEFR

Status: resolved
Sprint: 1
Prioridade: P1
Área: api + web
Esforço: médio
Origem: [auditoria §4.3](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

A UI oferece níveis CEFR (`A1..C2`), a API só aceita o enum antigo (`BASIC/INTERMEDIATE/...`). Adicionar ou editar idioma retorna `400`. Se o usuário não mexer no select, grava `INTERMEDIATE` e o perfil exibe "Inglês (INTERMEDIATE)". Além disso, o nível não é independente por idioma.

## Evidência

- `apps/web/src/pages/profile.tsx:170` — `level: 'INTERMEDIATE'` como default (não existe na lista renderizada).
- `apps/web/src/pages/profile.tsx:971-975` — renderiza `LANGUAGE_LEVELS` com `A1..C2`.
- `apps/api/src/routes/profile.ts:50-53` — `z.enum(['BASIC','INTERMEDIATE','ADVANCED','FLUENT','NATIVE'])`.

## Correção

1. Adotar CEFR como vocabulário único: `A1, A2, B1, B2, C1, C2, NATIVE`.
2. Migration Prisma: novo enum + conversão dos valores antigos (`BASIC→A2`, `INTERMEDIATE→B1`, `ADVANCED→C1`, `FLUENT→C1`, `NATIVE→NATIVE`), documentando o mapeamento.
3. Compartilhar o enum em `packages/shared` para API e web usarem a mesma fonte.
4. Default do formulário: vazio/placeholder obrigatório, nunca um valor fixo.
5. Nível por idioma: cada linha de idioma carrega seu próprio nível.

## Critérios de aceite

- [x] POST/PUT de idioma com `B2` retorna 2xx e persiste.
- [x] Perfil exibe "Inglês (B2)", nunca o enum cru.
- [x] Migration converte dados existentes sem perder informação.
- [x] Formulário não envia nível default sem o usuário escolher.
- [x] Testes de API e de componente cobrem o fluxo completo.

## Testes

- `apps/api/tests/profile.test.ts`: cada valor CEFR aceito; valor antigo rejeitado.
- Teste de migração com registros antigos.
- Teste de UI: adicionar idioma sem escolher nível mostra erro de validação.

## Comments

- 2026-10-28 — CEFR adotado como vocabulário único em `packages/shared` (`LANGUAGE_LEVEL_CODES`, `isLanguageLevel`, `levelLabel`).
  - Enum Prisma `LanguageLevel` virou `A1, A2, B1, B2, C1, C2, NATIVE`, default `B1`; API valida com `z.enum(LANGUAGE_LEVEL_CODES)`.
  - Migration `20261028130000_language_level_cefr` cria o tipo novo, converte (`BASIC→A2`, `INTERMEDIATE→B1`, `ADVANCED→C1`, `FLUENT→C1`, `NATIVE→NATIVE`) e só então renomeia. Validada em banco descartável com os cinco valores antigos: resultado `A2/B1/C1/C1/NATIVE`, enum e default corretos.
  - Formulário começa com nível vazio, `SelectValue` tem placeholder e `languageFormError` bloqueia envio sem idioma/nível (inclusive valor legado). `levelLabel` exibe `B2` e `Nativo`, com fallback para valores antigos em cache.
  - Testes: API `profile.integration.test.ts` (7 testes, inclui todos os CEFR e rejeição do vocabulário antigo); web `language-form.test.ts` (4); shared compara a lista com o enum do Prisma.
  - Verificação: shared test=23 build=0; API typecheck=0 lint=0 test=267; web typecheck=0 lint=0 test=80 build=0.
