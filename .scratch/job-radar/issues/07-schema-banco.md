# 07 — Schema inicial do banco (Prisma ou Drizzle)

## Question

Modelar as entidades principais:

- `users` (single-user por enquanto, mas estrutura multi-user ready)
- `profiles` (1:1 com user, contém cargo desejado, senioridade, localização, modalidade, pretensão salarial, idiomas, formação, certificações, projetos, preferências)
- `skills` (catálogo global de tecnologia, ex: "Node.js", "React")
- `profile_skills` (N:N com nível e anos de experiência)
- `resumes` (CVs enviados, com texto extraído)
- `resume_versions` (versões otimizadas por vaga)
- `job_sources` (cadastro de fontes, ex: "Adzuna", "RemoteOK", "LinkedIn scrape")
- `jobs` (id, title, company, description, location, remote, salary_min, salary_max, currency, url, source_id, external_id, published_at, collected_at, hash, status)
- `job_skills` (N:N)
- `job_matches` (job_id, profile_id, score, breakdown JSON, computed_at)
- `job_analysis` (job_id, profile_id, ai_summary, strengths, gaps, risks, recommendation, generated_at)
- `applications` (job_id, profile_id, status, applied_at, notes, salary, result, contacts JSON)
- `application_events` (log de transições de status)
- `notifications` (canal, payload, sent_at, status)
- `ai_runs` (auditoria de chamadas IA: tipo, custo estimado, tokens, model, latency, status)

Decidir índices importantes (hash de vaga para dedup, etc.).

## Type

grilling

## Status

done

## Resolution

Schema Prisma completo com todas as entidades do domínio:

**Entidades principais:**
- `users` + `profiles` (1:1) com skills, educação, certificações, projetos, idiomas
- `skills` (catálogo global) + `profile_skills` / `job_skills` (N:N)
- `resumes` + `resume_versions` (CVs e versões otimizadas)
- `job_sources` + `jobs` (vagas com hash único para dedup)
- `job_matches` (score + breakdown JSON)
- `job_analises` (análise IA com recommendation enum)
- `applications` + `application_events` (mini ATS com status)
- `notifications` (fila de notificações)
- `ai_runs` (auditoria de chamadas IA com custo/tokens/latency)
- `settings` (config editáveis via UI, com escopo e flag encrypted)

**Enums:** Seniority, RemoteMode, LanguageLevel, SkillLevel, JobStatus, AiRecommendation, ApplicationStatus, NotificationStatus, AiRunType, AiRunStatus

**Índices:** hash único em jobs (dedup), score em matches, status em jobs/applications/notifications, scope em settings

**Validação:**
- `pnpm typecheck` ✓
- `pnpm lint` ✓ (warnings não bloqueantes)
- `pnpm format:check` ✓
- Migration `init_full_schema` aplicada com sucesso
- Prisma client gerado em `src/generated/prisma`
