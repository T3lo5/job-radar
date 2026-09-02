# 28 — Sistema de candidaturas (mini ATS)

## Question

Modelo de status:

- 🔵 Encontrada (default ao coletar)
- 🟡 Interessante (usuário clicou "interesse")
- 🟣 CV preparado (gerou versão otimizada)
- 🟢 Aplicada (usuário confirmou candidatura)
- 🟠 Entrevista
- 🔴 Rejeitada
- 🏆 Oferta
- ⚫ Arquivada

Endpoints:
- `POST /api/applications` — cria ao marcar interesse
- `PATCH /api/applications/:id/status` — muda status (gera `application_event`)
- `GET /api/applications` — lista com filtros
- Notas, contatos, salário esperado, resultado

## Type

task

## Status

done

## Resolution

**Sistema de Candidaturas (mini ATS)** (`apps/api/src/routes/applications.ts`):

**Status:**
- FOUND → INTERESTING → CV_PREPARED → APPLIED → INTERVIEW → OFFER/REJECTED/ARCHIVED

**Endpoints:**
- `POST /api/applications` — cria candidatura (marca interesse)
- `GET /api/applications` — lista com filtros (status, jobId, paginação)
- `GET /api/applications/:id` — detalhes com eventos
- `PATCH /api/applications/:id/status` — muda status (gera ApplicationEvent)
- `PATCH /api/applications/:id` — atualiza notas, contatos, salário, resultado
- `DELETE /api/applications/:id` — remove candidatura

**Regras:**
- Transições de status são logadas em `application_events`
- `applied_at` é setado automaticamente ao mudar para APPLIED
- Candidatura única por job+perfil

**Validação:**
- `pnpm typecheck` ✓
