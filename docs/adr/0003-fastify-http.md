# ADR 0003: Fastify como framework HTTP

## Status

Aceito (2026-08-31, decisão durante resolução do #01)

## Contexto

Escolha entre Fastify e NestJS para a API. Conforme ADR-0002, projeto pessoal, 2 apps, sem time grande.

## Decisão

**Fastify 5** com TypeScript nativo e `@fastify/cors`.

## Razões

- Performance: 2-3x mais rápido que Express
- TypeScript first-class (sem decorators exigidos)
- Schema-first via TypeBox/Zod (validável em runtime)
- Logger pino integrado (leve, estruturado, rápido)
- Ecossistema oficial enxuto mas suficiente: `@fastify/cors`, `@fastify/helmet`, etc.
- Para um projeto pessoal pequeno/médio, NestJS é overengineering (DI containers, decorators, módulos obrigatórios)

## Consequências

- Sem decorators para DI. Usamos factory functions simples (`buildServer()`)
- Sem GraphQL out-of-the-box. Se precisar, `@fastify/mercurius` ou trocar
- Validação com Zod via `fastify-type-provider-zod` (será adicionado no #04 ou #10)
- ORM a decidir no #04 (Prisma ou Drizzle)

## Alternativas consideradas

- **NestJS**: estrutura familiar para quem vem de Angular/Spring, mas overhead desnecessário aqui
- **Express**: maduro mas sem TS first-class, mais boilerplate
- **Hono**: muito novo, sem ecossistema
- **Elysia**: interessante, mas menor ecossistema
