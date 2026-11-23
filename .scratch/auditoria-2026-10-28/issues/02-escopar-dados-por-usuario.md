# 02 — Escopar dados por `userId`

Status: resolved
Sprint: 0
Prioridade: P0
Área: api
Esforço: médio
Origem: [auditoria §3.1](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Quase todas as rotas e serviços buscam o "primeiro" perfil/CV/candidatura com `findFirst()` sem filtrar pelo usuário da sessão. Fechar o signup (ticket 01) reduz a exposição, mas não elimina o bug: qualquer conta pré-existente ou criada por engano continua vendo os dados da conta dona. Isso também impede evoluir para multi-user depois.

## Evidência

- `apps/api/src/routes/profile.ts:83` — `prisma.profile.findFirst()` sem `userId`.
- Mesmo padrão em:
  - `apps/api/src/routes/resumes.ts`
  - `apps/api/src/routes/cv-optimizer.ts`
  - `apps/api/src/routes/pdf-export.ts`
  - `apps/api/src/services/resume-service.ts`
  - `apps/api/src/services/application-service.ts`
  - `apps/api/src/services/pipeline/matching-step.ts`
  - `apps/api/src/workers/job-collection.ts`
- `apps/api/src/services/job-service.ts` — `listMatches(profileId)` recebe id, mas o id vem do `findFirst()` acima.

## Correção

1. Criar um helper único `getCurrentProfile(request)` (ex.: `apps/api/src/lib/current-user.ts`) que deriva `request.user.id` e busca `profile.findUnique({ where: { userId } })`, retornando `404 PROFILE_NOT_FOUND` quando não existir.
2. Substituir **todos** os `profile.findFirst()` por esse helper. Não deixar `findFirst()` sem `where: { userId }` no código.
3. Passar `userId`/`profileId` explicitamente para serviços e steps do pipeline; nenhum serviço deve consultar "o primeiro" registro.
4. Em `workers/job-collection.ts`, iterar perfis existentes de forma explícita (hoje assume um só) ou documentar que a coleta é global e o matching é por perfil.
5. Adicionar lint rule simples ou grep no CI proibindo `profile.findFirst(` sem `userId` (pode ser um teste que varre `src/`).

## Critérios de aceite

- [x] Nenhuma ocorrência de `profile.findFirst()` sem `userId` em `apps/api/src`.
- [x] `GET /api/profile`, `GET /api/resumes`, `GET /api/applications`, `POST /api/cv/optimize` e `GET /api/export/pdf` usam o perfil da sessão.
- [x] Teste de integração cria usuários A e B, cada um com perfil/CV/candidatura, e verifica que B não acessa nada de A (incluindo 404, não 403 com dados).
- [x] Testes existentes continuam verdes.

## Testes

- `apps/api/tests/isolation.test.ts`: dois usuários, dois perfis, dois CVs, duas candidaturas; cada token só vê o próprio.
- Teste de regressão que falha se `profile.findFirst(` aparecer sem `userId` em `apps/api/src`.

## Comments

- 2026-10-28 — Implementado.
  - `apps/api/src/lib/current-user.ts` centraliza `request.user` e o perfil da sessão.
  - Rotas de profile/resumes/applications/cv-optimizer/pdf-export/jobs derivam o escopo da sessão; serviços recebem `userId`/`profileId` explícitos.
  - Background permanece global por desenho: `matching-step` e `analysis-step` iteram todos os perfis (um upsert por perfil); coleta e bot documentam o perfil mais antigo com `orderBy`.
  - Testes: `routes/isolation.integration.test.ts` (A x B em perfil, CV, candidatura e itens do perfil) e `tests/profile-scope.test.ts` (varredura contra reintrodução de `profile.findFirst` fora da allowlist de background).
