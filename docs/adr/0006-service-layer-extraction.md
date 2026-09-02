# ADR-0006: Service Layer Extraction

## Context

Route handlers in `apps/api/src/routes/` had grown to contain significant business logic: database queries, validation, transaction management, and status transitions. This made them hard to test (tied to Fastify request/reply) and prevented reuse of domain logic.

## Decision

Extracted business logic from route handlers into service layer modules:

- `services/application-service.ts` — Application CRUD, status transitions, conflict detection
- `services/job-service.ts` — Job listing/filtering, match computation, match result storage
- `services/resume-service.ts` — Resume upload, text extraction, AI parsing

Route handlers now act as thin transport layers: validate input, delegate to services, format HTTP responses.

## Consequences

**Positive:**
- Services are independently testable without Fastify context
- Business logic is reusable (e.g., `jobService.listMatches()` could be called from CLI, telegram bot, etc.)
- Route handlers reduced to 50-70 lines each, focused on HTTP concerns only
- Consistent error handling patterns across routes

**Negative:**
- Added indirection — caller must trace through service layer
- Some duplication of validation between route schemas and service (services still do their own existence checks)

## Alternatives Considered

1. **Fat routes, no services** — Original approach. Kept everything in route files for "simplicity." Rejected because testing required Fastify injector and business logic couldn't be reused.
2. **Repository pattern** — Create typed repository classes (e.g., `ApplicationRepository`) that wrap Prisma. Rejected as overkill for current complexity; direct Prisma usage in services is sufficient.
