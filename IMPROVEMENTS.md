# Job Radar — Documento de Melhorias Recomendadas

> **Data:** 2026-09-11  
> **Objetivo:** Mapear oportunidades de melhoria para tornar o projeto mais fácil de usar, robusto e pronto para usuários finais não técnicos.
>
> **Status dos itens:** marcado com ✅ apenas o que tem evidência no código (teste ou commit verificável). Itens sem evidência estão reabertos com link para o ticket em `.scratch/auditoria-2026-10-28/`.

---

## Sumário Executivo

O Job Radar já possui uma base sólida: arquitetura modular (monorepo pnpm), pipeline de IA refatorado, setup automatizado (`dev-up.sh`), wizard de primeira execução e documentação extensa. No entanto, há **gaps significativos** entre "funciona para desenvolvedores" e "pronto para usuários finais".

Este documento prioriza melhorias por **impacto no usuário final** vs **esforço de implementação**. Cada item aberto aponta para um ticket em `.scratch/auditoria-2026-10-28/issues/`.

---

## 1. Experiência do Usuário Final (Alto Impacto)

### 1.1 Onboarding e Primeira Execução

| Problema Atual                                                        | Melhoria Recomendada                                                                                        | Esforço | Status                                   | Ticket |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------- | ------ |
| Usuário precisa gerar chave de criptografia manualmente via terminal  | **Gerar `SETTINGS_ENCRYPTION_KEY` automaticamente** no `dev-up.sh` se vazia                                 | Baixo   | ✅ [dev-up.sh:112-121]                   | —      |
| Setup wizard (`/setup`) não valida se IA funciona antes de prosseguir | **Teste de conexão IA obrigatório** no wizard (com botão "Pular por enquanto")                              | Médio   | ✅ [apps/web/src/pages/setup.tsx:40-438] | —      |
| Sem feedback visual do progresso do `dev-up.sh` (logs técnicos)       | **Tela de boas-vindas web** com barra de progresso: "Subindo banco..." → "Rodando migrações..." → "Pronto!" | Médio   | ⬜                                       | —      |
| Usuário não técnico não sabe o que é Docker/PostgreSQL/Redis          | **Modo "Zero Config"**: SQLite local + arquivo JSON para settings (sem Docker)                              | Alto    | ⬜                                       | —      |
| Erro genérico se porta 3001/5173 ocupada                              | **Detecção automática de porta livre** + sugestão no terminal                                               | Baixo   | ⬜                                       | —      |

### 1.2 Interface Web (Frontend)

| Área                        | Problema                                             | Melhoria                                                                                    | Status                                                 | Ticket |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| **Estados de carregamento** | Skeletons genéricos, sem feedback de ação do usuário | Skeletons contextuais + toast "Carregando vagas..." + botões desabilitados durante requests | ⬜                                                     | —      |
| **Estados vazios**          | Páginas em branco quando sem dados                   | Empty states ilustrados com call-to-action                                                  | ✅ [apps/web/src/components/empty-state.tsx]           | —      |
| **Erros**                   | Toast genérico "Erro ao carregar"                    | Erros acionáveis: "Falha ao conectar na API..." + botão "Tentar novamente"                  | ⬜                                                     | —      |
| **Responsividade**          | Tabelas quebram em mobile                            | Cards empilháveis em mobile; tabela só em desktop (>768px)                                  | ⬜                                                     | —      |
| **Acessibilidade**          | Falta aria-labels, foco visível, contraste           | Auditoria WCAG 2.1 AA; skip links; focus-visible em todos interativos                       | ⬜                                                     | 40     |
| **Tema escuro**             | Não existe                                           | Implementar `dark:` do Tailwind + toggle no header + persistir em localStorage              | ✅ [apps/web/src/components/layout.tsx + ThemeContext] | —      |
| **Navegação**               | Sidebar fixa, sem atalhos de teclado                 | Atalhos: `g d` (dashboard), `g j` (vagas), `g a` (candidaturas), `/` (busca)                | ⬜                                                     | —      |
| **Internacionalização**     | Hardcoded PT-BR                                      | i18n ready (react-i18next) — preparar para EN/ES futuro                                     | ⬜                                                     | —      |

### 1.3 Fluxos Críticos do Usuário

#### Configuração de IA (maior dor hoje)

- **Atual:** Usuário vai em Settings → IA → Adicionar → preenche 4 campos → Testar → Criar
- **Melhoria:** Wizard guiado com presets: "OpenAI (recomendado)", "Anthropic", "Ollama (local)", "Custom"
- **Validação:** Testar conexão _antes_ de salvar; mostrar custo estimado por request
- **Status:** Teste de conexão já existe no wizard ✅ [setup.tsx:51]

#### Configuração de Fontes de Vaga

- **Atual:** Lista técnica com botões Ativar/Desativar
- **Melhoria:** Cards visuais com ícone, descrição do que a fonte traz, status "Funcionando/Erro/Requer credenciais"
- **Status:** Cards visuais existem ✅ [apps/web/src/components/SourceCard.tsx]

#### Upload de Currículo

- **Atual:** Upload → extrai texto → fim
- **Melhoria:** Preview do texto extraído + botão "Editar manualmente" + validação "Seu currículo tem X skills do mercado"
- **Status:** Validação de arquivo existe (tipo + tamanho) ✅ [apps/web/src/pages/profile.tsx:1308-1323]

---

## 2. Robustez e Confiabilidade (Alto Impacto)

### 2.1 Tratamento de Erros e Resiliência

| Componente                | Gap Atual                                    | Melhoria                                                           | Status | Ticket |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | ------ | ------ |
| **Job Collection Worker** | Falha silenciosa se uma fonte cai; não retry | Exponential backoff por fonte; circuit breaker                     | ⬜     | —      |
| **IA Providers**          | Sem fallback se provider primário falha      | Fallback chain: OpenAI → Anthropic → Ollama local                  | ⬜     | —      |
| **BullMQ Workers**        | Jobs órfãos se worker crasha no meio         | Job idempotency keys; dead letter queue UI                         | ⬜     | —      |
| **Database**              | Sem backup automático                        | `pnpm db:backup` + `pnpm db:restore` scripts; agendar via cron     | ⬜     | —      |
| **Rate Limiting**         | Básico no Fastify                            | Rate limit por IP + por usuário autenticado; headers `Retry-After` | ⬜     | —      |

### 2.2 Observabilidade

| Necessidade             | Implementação                                                            | Status     | Ticket |
| ----------------------- | ------------------------------------------------------------------------ | ---------- | ------ |
| **Health checks ricos** | `/health/ready` já existe; adicionar `/health/metrics` (Prometheus)      | ⬜ Parcial | —      |
| **Logs estruturados**   | Migrar `console.log` → `pino` com `level: env.LOG_LEVEL`; correlation ID | ⬜         | —      |
| **Tracing**             | OpenTelemetry básico: spans em AI calls, DB queries, BullMQ jobs         | ⬜         | —      |
| **Dashboard de status** | Página `/admin/status`: workers vivos, fila sizes, último erro por fonte | ⬜         | —      |

### 2.3 Validação e Sanitização

- **Zod schemas** em todos routes (parcialmente feito) → completar para 100%
- **Sanitização de HTML** em descrições de vaga (XSS prevention) — `DOMPurify` no backend ✅ [sanitizeHtml]
- **Validação de arquivo** no upload: magic bytes (não só extensão), max 10MB, tipos permitidos ✅

---

## 3. Funcionalidades de Alto Valor (Médio/Alto Impacto)

### 3.1 Busca e Filtros de Vagas

| Feature                        | Descrição                                                              | Status                                                       | Ticket |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| **Busca full-text**            | PostgreSQL `tsvector` + `tsquery` em `title`, `description`, `company` | ⬜ Parcial (coluna `searchVector` existe como `Unsupported`) | —      |
| **Filtros salvos**             | "Minhas buscas": "React + Remoto + >80 match", "Python + Híbrido SP"   | ⬜                                                           | —      |
| **Alertas por email/Telegram** | "Me avise quando aparecer vaga match >85 com React"                    | ⬜                                                           | —      |
| **Ordenação inteligente**      | Default: `match_score DESC, published_at DESC`; opções                 | ⬜                                                           | —      |

### 3.2 Candidaturas (Kanban)

| Feature                    | Descrição                                                               | Status                                    | Ticket |
| -------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- | ------ |
| **Templates de nota**      | Snippets: "Aguardando retorno", "Entrevista agendada", "Contraproposta" | ⬜                                        | —      |
| **Lembretes**              | "Lembrar de fazer follow-up em 7 dias" → notificação                    | ✅ Parcial (followUpAt existe no schema)  | —      |
| **Anexos por candidatura** | Carta de apresentação, portfolio, comprovantes                          | ✅ Parcial (ApplicationAttachment existe) | —      |
| **Import/Export**          | Exportar candidaturas para CSV/JSON (backup pessoal)                    | ⬜                                        | —      |

### 3.3 IA e Matching

| Feature                           | Descrição                                                           | Status                         | Ticket |
| --------------------------------- | ------------------------------------------------------------------- | ------------------------------ | ------ |
| **Explicação do match**           | "Score 87: Tem React... faltando: GraphQL" — já existe no breakdown | ✅ [MATCH_CRITERIA, breakdown] | —      |
| **Sugestão de skills a aprender** | Baseado em gaps frequentes nas vagas de interesse                   | ⬜                             | —      |
| **Otimização de CV em lote**      | "Otimizar CV para top 5 vagas da semana" → gera 5 PDFs              | ⬜                             | —      |
| **Análise de mercado**            | "Salário médio para React Sênior remoto" agregado                   | ⬜                             | —      |

### 3.4 Perfil Profissional

| Feature                 | Descrição                                                | Status | Ticket |
| ----------------------- | -------------------------------------------------------- | ------ | ------ |
| **Import do LinkedIn**  | Colar URL do perfil → scrape público → pré-preencher     | ⬜     | —      |
| **Import do GitHub**    | Lista repos públicos → extrai tech stack → sugere skills | ⬜     | —      |
| **Validação de perfil** | "Seu perfil tem 12 skills. Média do mercado: 18"         | ⬜     | —      |
| **Versões de perfil**   | "Perfil para Frontend", "Perfil para Fullstack"          | ⬜     | —      |

---

## 4. Facilidade de Deploy e Distribuição (Alto Impacto para Adoção)

### 4.1 Instalação "One-Click" para Não-Técnicos

| Abordagem                        | Descrição                                                   | Esforço | Status                                        | Ticket        |
| -------------------------------- | ----------------------------------------------------------- | ------- | --------------------------------------------- | ------------- |
| **Docker Compose único**         | `docker compose -f docker-compose.prod.yml up -d` sobe tudo | Baixo   | ❌ **Deploy quebrado** (auditoria §3.2, §3.3) | —             |
| **Script instalador**            | `curl -fsSL install.jobradar.dev                            | bash`   | Médio                                         | ❌ Não existe | —   |
| **Binários nativos**             | `pkg`/`nexe` para Linux/macOS/Windows                       | Alto    | ❌ Não existe                                 | —             |
| **Desktop App (Tauri/Electron)** | Instalador `.exe`/`.dmg`/`.AppImage` com auto-update        | Alto    | ❌ Não existe                                 | —             |
| **Homebrew/Scoop/Chocolatey**    | `brew install job-radar`                                    | Médio   | ❌ Não existe                                 | —             |

> ⚠️ O `docker-compose.prod.yml` existe mas o deploy **não funciona de ponta a ponta**: o frontend de produção aponta para `localhost:3001`, o nginx remove o prefixo `/api` e o container não roda migrations. Ver `.scratch/auditoria-2026-10-28/issues/` tickets relacionados.

### 4.2 Configuração via UI (Eliminar .env)

- **Meta:** Usuário nunca edita `.env` após primeiro `dev-up.sh`
- **Ação:** Mover `DATABASE_URL`, `REDIS_URL`, `APP_PORT`, `WEB_PORT` para tabela `settings`
- **Exceção:** `SETTINGS_ENCRYPTION_KEY` e `POSTGRES_PASSWORD` ficam no `.env`

### 4.3 Atualizações

| Feature                   | Descrição                                                   | Status             | Ticket |
| ------------------------- | ----------------------------------------------------------- | ------------------ | ------ |
| **Auto-update check**     | Banner no dashboard: nova versão disponível                 | ❌ Não existe      | —      |
| **Migrações automáticas** | `dev-up.sh` roda `prisma migrate deploy` automaticamente    | ✅ [dev-up.sh:124] | —      |
| **Changelog visível**     | Página `/changelog` ou modal no primeiro acesso após update | ⬜                 | —      |

---

## 5. Qualidade de Código e Manutenibilidade (Médio Impacto)

### 5.1 Testes

| Camada              | Atual                     | Meta                                                                                  | Status            |
| ------------------- | ------------------------- | ------------------------------------------------------------------------------------- | ----------------- |
| **Unit (backend)**  | ~20 testes (AI, matching) | >80% coverage em services, pipeline, matching engine                                  | ✅ 485 testes API |
| **Unit (frontend)** | Placeholder apenas        | Testes em hooks, utils, componentes críticos                                          | ⬜                |
| **Integração**      | Parcial (API routes)      | Testes E2E: "Usuário completa setup → vê vaga → aplica → move no Kanban" (Playwright) | ❌ Não existe     |
| **Contrato**        | Nenhum                    | Pact ou OpenAPI validation para API ↔ Web                                             | ❌ Não existe     |

### 5.2 Documentação Técnica

| Doc                 | Status                       | Ação                                                                |
| ------------------- | ---------------------------- | ------------------------------------------------------------------- |
| **OpenAPI/Swagger** | Não existe                   | Gerar via `fastify-swagger` + `zod-to-openapi`; servir em `/docs`   |
| **ADR novo**        | 6 ADRs existentes            | Template para novos ADRs; índice em `docs/adr/README.md`            |
| **Contribuindo**    | Básico no README             | `CONTRIBUTING.md` com: setup dev, convenções de commit, como testar |
| **Arquitetura**     | `refactoring-sprint-plan.md` | Diagrama Mermaid: módulos, fluxos de dados, workers, external deps  |

### 5.3 DX (Developer Experience)

- **Pre-commit hooks:** Husky + lint-staged já configurado ✓
- **VS Code settings:** `.vscode/settings.json` com format on save, ESLint, TypeScript
- **Debug configs:** `.vscode/launch.json` para API (tsx watch), Web (Vite), Workers
- **GitHub Codespaces:** `.devcontainer/` para contribuir sem setup local — ❌ não existe

---

## 6. Segurança e Privacidade (Crítico para Confiança)

| Item                          | Status                                           | Ação                                                                 |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| **Criptografia em repouso**   | Settings secrets criptografados (AES-256-GCM) ✅ | Auditar implementação; rotacionar chave docs                         |
| **HTTPS em prod**             | Não configurado                                  | Docs: Caddy/Traefik reverse proxy com Let's Encrypt automático       |
| **Autenticação**              | Single-user (sem auth real)                      | Opção A: manter single-user + auth simples. Opção B: multi-user real |
| **Secrets no log**            | Risco de vazar API keys                          | Sanitizer no logger: mascarar `apiKey`, `token`, `password`          |
| **CORS**                      | Permissivo em dev                                | Restringir em prod para domínio configurado                          |
| **Rate limit auth endpoints** | Básico                                           | Stricter em `/api/setup`, `/api/auth*`                               |

---

## 7. Performance (Médio Impacto)

| Área              | Otimização                                                         | Status                         |
| ----------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Database**      | Índices compostos: `(status, collected_at)`, `(profile_id, score)` | ✅ Índices existem no schema   |
| **Redis**         | Cache de `JobMatch` (TTL 1h); cache de `Profile`                   | ⬜                             |
| **BullMQ**        | Concurrency por worker baseada em CPU; `maxStalledCount`           | ⬜                             |
| **IA**            | Batch requests; streaming responses                                | ⬜                             |
| **Bundle size**   | Code splitting por rota (`React.lazy`)                             | ✅ Ticket 36                   |
| **Queries**       | React Query `staleTime` apropriado; `select`                       | ⬜                             |
| **Virtualização** | Lista de vagas: `react-window` para 100+ itens                     | ✅ Ticket 36 (`react-virtual`) |
| **Imagens**       | Otimizar avatars/logos de empresas (WebP, lazy load)               | ⬜                             |

---

## 8. Acessibilidade e Inclusão (Importante)

- **Contraste:** Verificar todas as cores do Tailwind customizado — ⬜
- **Teclado:** Todos elementos interativos focáveis e operáveis por teclado — ⬜
- **Screen readers:** `aria-live` para toasts; `aria-label` em icon buttons — ⬜
- **Reduced motion:** Respeitar `prefers-reduced-motion` — ⬜
- **Idioma:** `lang="pt-BR"` no HTML; preparar i18n — ⬜

---

## 9. Priorização Sugerida (Roadmap)

### Fase 1 — "Pronto para Amigos" (2-3 semanas)

> Objetivo: Um desenvolvedor consegue instalar e usar sem ajuda

1. ✅ Gerar `SETTINGS_ENCRYPTION_KEY` auto no `dev-up.sh`
2. ✅ Empty states ilustrados + CTAs em todas páginas
3. ⬜ Toast de erro acionável + botão "Tentar novamente"
4. ❌ `docker-compose.prod.yml` otimizado + docs "Deploy em VPS" (deploy quebrado)
5. ✅ Teste de conexão IA no wizard de setup
6. ✅ Validação de arquivo no upload de currículo
7. ✅ Sanitização HTML em descrições de vaga

### Fase 2 — "Usável Diariamente" (4-6 semanas)

> Objetivo: Usuário não técnico consegue usar produtivamente

1. ✅ Tema escuro + persistência
2. ⬜ Busca full-text + filtros salvos (coluna `searchVector` existe como Unsupported)
3. ✅ Cards visuais para fontes de vaga + status
4. ✅ Lembretes/follow-up no Kanban (followUpAt existe)
5. ⬜ Exportar candidaturas (CSV/JSON)
6. ❌ Backup/restore banco (`pnpm db:backup`)
7. ⬜ Health check rico + página `/admin/status`

### Fase 3 — "Distribuível" (6-8 semanas)

> Objetivo: Qualquer pessoa instala via instalador

1. ❌ Script instalador `curl | bash` (Linux/macOS)
2. ❌ Instalador Windows (PowerShell + winget)
3. ❌ Auto-update check no dashboard
4. ❌ Auth single-user opcional (senha no settings)
5. ❌ OpenAPI/Swagger em `/docs`
6. ❌ i18n ready (estrutura, não tradução)

### Fase 4 — "Excelência" (Contínuo)

> Objetivo: Referência de qualidade

1. ❌ Testes E2E (Playwright) nos fluxos críticos
2. ❌ Accessibility audit (WCAG 2.1 AA)
3. ❌ Performance budgets (bundle < 200KB gzipped, API P95 < 200ms)
4. ❌ Desktop app (Tauri)
5. ❌ Multi-user real (se demandado)

---

## 10. Métricas de Sucesso

| Métrica                                  | Atual         | Meta Fase 1 | Meta Fase 2 |
| ---------------------------------------- | ------------- | ----------- | ----------- |
| **Tempo para primeiro "Dashboard útil"** | ~20 min (dev) | < 5 min     | < 3 min     |
| **Taxa de sucesso no setup**             | ~60% (devs)   | > 90%       | > 95%       |
| **Issues "não consigo instalar"**        | Frequentes    | Raras       | Zero        |
| **Cobertura de testes**                  | ~15%          | > 50%       | > 80%       |
| **Bundle size (web)**                    | ~400KB        | < 250KB     | < 200KB     |
| **API P95 latency**                      | Desconhecido  | < 300ms     | < 200ms     |

---

## 11. Como Contribuir com Estas Melhorias

1. **Escolha uma tarefa** da Fase 1 (não marcadas com ✅ acima)
2. **Abra issue** no GitHub com label `good first issue` ou `help wanted`
3. **Siga o fluxo:** Fork → Branch → Commit convencional → PR
4. **Teste localmente:** `./dev-up.sh && pnpm test && pnpm lint && pnpm typecheck`
5. **Documente:** Atualize `SETUP.md` ou `README.md` se mudou fluxo de usuário

> **Princípio:** Toda melhoria deve reduzir atrito para o usuário final, não adicionar complexidade para o desenvolvedor.

---

## Apêndice: Arquivos-Chave para Começar

| Melhoria                     | Arquivos Principais                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Auto-generate encryption key | `dev-up.sh`, `dev-up.ps1`                                                                                 |
| Empty states                 | `apps/web/src/components/empty-state.tsx`, páginas em `apps/web/src/pages/`                               |
| Error toasts acionáveis      | `apps/web/src/components/ui/toast.tsx`, `apps/web/src/services/api.ts`                                    |
| Docker prod                  | `docker-compose.prod.yml` (existe, mas deploy quebrado), `apps/api/Dockerfile`, `apps/web/Dockerfile`     |
| IA test no wizard            | `apps/web/src/pages/setup.tsx`, `apps/api/src/routes/ai-providers.ts`                                     |
| Busca full-text              | `apps/api/prisma/schema.prisma` (coluna `searchVector` como `Unsupported`), `apps/api/src/routes/jobs.ts` |
| Tema escuro                  | `apps/web/src/index.css`, `apps/web/tailwind.config.js`, `apps/web/src/components/layout.tsx`             |
| Backup DB                    | `apps/api/package.json` (script `db:backup` não existe)                                                   |

---

_Documento vivo — atualize conforme implementa. Cada item concluído deve ser movido para "Feito" com link para PR. Itens sem ✅ não têm evidência no código e apontam para tickets em `.scratch/auditoria-2026-10-28/issues/`._
