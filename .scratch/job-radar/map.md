# Wayfinder: Job Radar

## Destination

Plataforma pessoal rodando localmente (`docker compose up`) com: perfil + CV, coleta de vagas, pipeline de processamento, matching com score, análise IA, dashboard com filtros, sistema de candidaturas (mini ATS), notificações Telegram diárias, automação diária configurável e analytics com métricas. A IA respeita a regra de "não inventar experiência".

## Notes

- Tracker: local markdown (`.scratch/job-radar/`)
- Domínio: ver `CONTEXT.md` quando existir
- Idioma: PT-BR
- Granularidade: 1 ticket por item de checklist
- Regra de ouro: "Primeiro fazer o Job Radar encontrar 10 vagas boas e ajudar a aplicar em 10 minutos. Depois fazer ele ficar inteligente."
- Skills relevantes por sessão: `implement`, `grilling`, `domain-modeling`, `prototype`, `research`
- **ADR-0005**: settings editáveis via UI (IA, Telegram, Cron, Fontes) com criptografia AES-256-GCM; `.env` só guarda o mínimo crítico (connection strings, portas, NODE_ENV, `SETTINGS_ENCRYPTION_KEY`)
- Toda config sensível em código deve vir de `SettingsService`, nunca de `process.env`

## Decisions so far

<!-- índice: uma linha por ticket fechado, depois o link para o detalhe -->

- [01 — Criar repositório e monorepo](./issues/01-criar-repositorio-monorepo.md): pnpm workspaces, apps/api (Fastify) + apps/web (Vite/React) + packages/shared com tipos do `CONTEXT.md`; tsconfig e eslint base compartilhados; smoke test OK (health + match label endpoint).
- [02 — TypeScript, ESLint, Prettier](./issues/02-config-typescript-eslint-prettier.md): tsconfig variants (node/react/react-library), ESLint 9 flat config (presets base/node/react), Prettier 3.9 com format:check, Husky+lint-staged opcional; `pnpm typecheck/lint/format:check` todos OK.
- [03 — Docker Compose](./issues/03-docker-compose.md): postgres:16-alpine, redis:7-alpine, api (multi-stage dev/prod), web (vite dev), web-prod (nginx). Healthchecks em todos, volumes nomeados, profiles dev/prod. Validado end-to-end: 5 containers healthy, /api/health via nginx retorna 200, pg_isready/redis-cli ping OK.
- [04 — Backend Fastify + Prisma + Zod](./issues/04-backend-framework-orm.md): Fastify 5 com `fastify-type-provider-zod`, Prisma ORM (client output em `src/generated/prisma`), validação Zod, logger Pino. Health checks (`/health` e `/health/ready`). Migration inicial aplicada.
- [07 — Schema completo do banco](./issues/07-schema-banco.md): Todas as entidades modeladas (users, profiles, skills, resumes, jobs, matches, analyses, applications, notifications, ai_runs, settings). Enums tipados, índices para dedup e busca. Migration `init_full_schema` aplicada.
- [08 — Migrations e seed](./issues/08-migrations-seed.md): Seed com 95 skills base categorizados + 1 usuário demo com perfil completo. Script `pnpm db:seed` idempotente.
- [14 — Interface JobSource + RemoteOK](./issues/14-interface-jobsource.md): Interface `JobSource` em `@job-radar/shared`, tipos `NormalizedJob`/`SourceQuery`. Primeira fonte: RemoteOK (sem auth, JSON público). Registry com coleta paralela e isolamento de erros.
- [10 — API CRUD Perfil](./issues/10-api-perfil.md): Endpoints REST para gerenciar perfil (GET/PUT profile, POST/DELETE skills, PUT preferences). Validação Zod. Upsert de skills no catálogo global.
- [41 — Settings via UI (backend)](./issues/41-settings-via-ui.md): SettingsService com AES-256-GCM, cache L1/L2/L3, endpoints de setup/settings, completion gate. Frontend pendente.
- [15 — Worker de coleta](./issues/15-worker-coleta.md): BullMQ queue `job-collection`, cron schedule, coleta paralela de todas as sources, dedup por hash, endpoints admin. Worker iniciado no boot.
- [05 — Frontend Stack](./issues/05-frontend-stack.md): Vite + React 18 + Tailwind + Radix UI + TanStack Query + react-hook-form/zod + react-router-dom v6. Páginas: Dashboard, Profile, Jobs, Setup, Settings.
- [06 — Validação de env](./issues/06-env-e-segredos.md): Zod schema para variáveis de ambiente. Falha rápido no boot se faltar variável crítica.
- [09 — README e CI](./issues/09-readme-ci.md): README completo com setup, endpoints, contribuição. CI GitHub Actions (lint, typecheck, format, test).
- [16 — Deduplicação](./issues/16-deduplicacao.md): Hash SHA256, source_count para vagas duplicadas. Endpoints GET /api/jobs com paginação e filtros.
- [19 — Matching Engine](./issues/19-matching-engine.md): Score com pesos (tech 35%, exp 20%, seniority 15%, location 10%, cloud 10%, lang 5%, other 5%). Skill matching com sinonímia e relatedness.
- [11 — Frontend Perfil](./issues/11-frontend-perfil.md): Formulários react-hook-form + zod para editar perfil, skills, visualização de educação/certificações/projetos.
- [12 — Upload/parse CV](./issues/12-upload-parse-cv.md): Upload PDF/DOCX, extração de texto (pdf-parse + mammoth), armazenamento filesystem. CRUD completo.
- [17 — Status processamento](./issues/17-status-processamento.md): JobProcessingLog para auditoria de transições de status. Serviço com updateJobStatus transacional.
- [20 — Classificação match](./issues/20-classificacao-match.md): Já implementado no shared (matchLabelFor + MATCH_LABELS).
- [25 — Dashboard](./issues/25-dashboard-principal.md): Contadores, gráficos (Recharts), top matches, vagas recentes. Refresh 5min.
- [26 — Listagem Vagas](./issues/26-listagem-vagas.md): Filtros (busca, modalidade, status), cards com match badge, paginação infinita.
- [22 — Provider IA customizável](./issues/22-provider-ia.md): URL, apiKey e modelo configuráveis via UI. Formato OpenAI-compatible. Funções: extractCvData, analyzeJob, summarizeJob. Auditoria em ai_runs.
- [28 — Sistema Candidaturas](./issues/28-sistema-candidaturas.md): Mini ATS com 8 status. CRUD completo, eventos de transição, notas/contatos/salário.
- [27 — Detalhe Vaga](./issues/27-detalhe-vaga.md): Página /jobs/:id com header, score badge, breakdown, descrição, ações.
- [29 — Kanban Candidaturas](./issues/29-kanban-candidaturas.md): Board com 8 colunas (status), drag-and-drop @dnd-kit, cards com vaga/empresa.
- [30 — Notificações](./issues/30-modulo-notificacoes.md): TelegramChannel com grammy, retry/backoff, auditoria em notifications.
- [31 — Bot Telegram](./issues/31-bot-telegram-comandos.md): Comandos /start, /hoje, /top, /stats, /help.
- [32 — Resumo Diário](./issues/32-resumo-diario-telegram.md): Relatório diário com stats + top vagas. Endpoint manual.
- [33 — Rotina Diária](./issues/33-rotina-diaria.md): Orquestração com BullMQ, cron configurável, collection + report schedulers.
- [34 — Métricas Analytics](./issues/34-metricas-analytics.md): Endpoint GET /api/analytics/overview com jobs, aplicações, rates, matches, skills.
- [35 — Página Analytics](./issues/35-pagina-analytics.md): Tela /analytics com KPIs, gráficos, filtros de período.
- [36 — Logs Observabilidade](./issues/36-logs-observabilidade.md): Request ID, queue status, AI runs com custo estimado, alerta de custo.
- [37 — Testes Matching](./issues/37-testes-matching.md): 9 testes unitários para o matching engine.
- [38 — Testes Pipeline](./issues/38-testes-pipeline.md): 7 testes de integração para o pipeline.
- [39 — Segurança](./issues/39-seguranca-privacidade.md): Rate limiting, Dependabot, Zod validation, AI audit.
- [40 — Segunda Fonte](./issues/40-segunda-fonte.md): Remotive como segunda fonte de vagas.
- [18 — Worker Extração](./issues/18-worker-extracao.md): Extração de requisitos via IA, integrado ao pipeline.
- [13 — Extração CV IA](./issues/13-extracao-cv-ia.md): POST /api/resumes/:id/extract, extração de dados do CV.
- [21 — Análise IA](./issues/21-analise-ia.md): Worker de análise IA completo, integrado ao pipeline.
- [23 — CV Optimizer](./issues/23-cv-optimizer.md): POST /api/cv/optimize, otimização de CV para vaga.
- [24 — Export PDF](./issues/24-export-pdf.md): Geração de PDF com pdfkit, versões de CV.

## Not yet specified

- Política de rotação da `SETTINGS_ENCRYPTION_KEY` (re-criptografar tudo) — pode ficar para depois do MVP
- Política de backup do `.env` (a chave mestra é a única coisa crítica)
- Migração de dados quando uma fonte de vaga ganha nova credencial opcional (ex: Adzuna adicionar `partner_id`) — depende de #14
- Política de retentativa para fontes de vaga que falham — depende de #14
- Formato exato do prompt de extração de requisitos — depende de #13
- Pesos finais do score de matching (os 35/20/15/10/10/5/5 são um chute inicial) — depende de #19
- Critérios para "descrição suspeita" de vaga — fora do MVP, ver Out of scope
- UX de "skipped" no wizard (passos 2 e 4 são opcionais — usuário pode voltar depois) — depende de #41
- Como o `SettingsService` reage se o Redis cair (fallback pra DB sem cache?) — depende de #41

## Out of scope

<!-- coisas explicitamente fora do destino -->

- Fase 12 (inteligência avançada: embeddings, RAG, cover letter, preparação para entrevista, detecção de vagas repostadas, estimativa salarial por IA, análise de descrição suspeita). É trabalho pós-MVP, projeto separado.
- Mobile app. Dashboard web apenas.
- Multi-tenant / multi-usuário. É um sistema pessoal.
- Integração com LinkedIn Easy Apply / Greenhouse / Lever automatizando cliques. Apenas rastreamento.
