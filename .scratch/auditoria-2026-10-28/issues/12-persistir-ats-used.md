# 12 — Persistir `atsUsed`

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: trivial
Origem: [auditoria §4.2](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O usuário escolhe o ATS usado na candidatura, recebe `200`, e o valor é descartado. A informação é necessária para analytics por ATS e para o índice de confiança (tickets 20 e 29).

## Evidência

- `apps/api/src/routes/applications.ts:30` — `atsUsed` validado no PATCH.
- `apps/api/src/routes/applications.ts:126-132` — update montado sem `atsUsed`.
- `apps/api/src/services/application-service.ts:213` — service já suporta o campo.
- `apps/web/src/pages/applications.tsx:564` — select existe na UI.

## Correção

1. Repassar `atsUsed` do schema para o update do service.
2. Validar contra o enum/catálogo de ATS aceitos (incluindo "outro" com texto livre, se a UI já permitir).
3. Garantir que `atsUsed` apareça no payload de leitura e no Kanban.
4. Aceitar `null` para limpar o campo.

## Critérios de aceite

- [x] PATCH com `atsUsed: "GUPY"` persiste e retorna o valor no GET seguinte.
- [x] PATCH com `atsUsed: null` limpa o campo.
- [x] Valor inválido retorna 400 com mensagem clara.
- [x] Teste de integração cobre os três casos.

## Testes

- `apps/api/tests/applications.test.ts`: criar, atualizar com ATS, ler, limpar.

## Comments

- 2026-10-28 — `atsUsed` agora chega ao service no PATCH (antes era validado e descartado).
  - Catálogo único em `packages/shared/src/types/application.ts` (`ATS_PROVIDERS`, `isAtsProvider`), usado pela validação Zod e pelo select da UI. "Outro" é valor fechado porque a UI não coleta texto livre.
  - `null` limpa o campo; valor fora do catálogo retorna 400 pelo schema.
  - `GET /api/applications` e `GET /api/applications/:id` devolvem `atsUsed`; o Kanban/detalhe já o exibe.
  - Teste novo `apps/api/src/routes/applications-ats.integration.test.ts` cobre persistir, ler, limpar e rejeitar; `packages/shared` ganhou teste do catálogo.
  - Verificação: shared test=19 build=0; API typecheck=0 test=264; web typecheck=0 test=76 build=0.
