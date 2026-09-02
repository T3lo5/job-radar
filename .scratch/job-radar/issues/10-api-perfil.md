# 10 — API CRUD de perfil profissional

## Question

Endpoints REST:

- `GET /api/profile` — perfil atual
- `PUT /api/profile` — atualizar perfil
- `POST /api/profile/skills` — adicionar skill com nível e anos
- `DELETE /api/profile/skills/:id`
- `PUT /api/profile/preferences` — cargos desejados, localidades, modalidade, faixa salarial, techs prioritárias

Validação Zod. Documentação OpenAPI (via `@fastify/swagger` se Fastify).

## Type

task

## Status

done

## Resolution

**Endpoints implementados** (`apps/api/src/routes/profile.ts`):

- `GET /api/profile` — perfil atual com skills, educação, certificações, projetos, idiomas
- `PUT /api/profile` — atualizar perfil (title, seniority, location, remote, salary, summary)
- `POST /api/profile/skills` — adicionar skill (upsert skill no catálogo + associar ao perfil)
- `DELETE /api/profile/skills/:id` — remover skill do perfil
- `PUT /api/profile/preferences` — atualizar preferências (cargo, localidade, modalidade, salário)

**Validações Zod:**
- Enums: `skillLevel`, `seniority`, `remoteMode` (mesmos do schema Prisma)
- CUID params para DELETE
- Limits de string, números positivos, currency 3 chars

**Regras:**
- Single-user: `findFirst()` retorna o primeiro perfil
- Skills: upsert no catálogo global + upsert na relação profile_skill
- 404 se perfil não existe

**Validação:**
- `pnpm typecheck` ✓
- `pnpm lint` ✓ (warnings não bloqueantes em seed.ts)
