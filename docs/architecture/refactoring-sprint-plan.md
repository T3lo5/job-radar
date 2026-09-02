# Architecture Review - Plano de Refatoração

> **Data:** 2026-09-02  
> **Origem:** Architecture Review session (6 candidatos identificados)  
> **Objetivo:** Transformar módulos shallow em deep modules — melhorar testabilidade e AI-navigability

---

## Resumo Executivo

| # | Candidato | Força | Linhas | Impacto | Sprint |
|---|-----------|-------|--------|---------|--------|
| 1 | Quebrar AI Provider god module | **Strong** | 574 | Alto | Sprint 1-2 |
| 2 | Deepen do pipeline de processamento | **Strong** | 366 | Alto | Sprint 3 |
| 3 | Consolidar parsing de fontes | Worth exploring | ~400 | Médio | Sprint 4 |
| 4 | Thin dos route handlers | Worth exploring | ~300 | Médio | Sprint 5 |
| 5 | Centralizar settings keys | Speculative | ~50 | Baixo | Sprint 6 |
| 6 | Deletar shallow wrappers | Speculative | ~100 | Baixo | Sprint 6 |

---

## Sprint 1: AI Provider — Base Types + HttpAiClient

**Objetivo:** Isolar o seam `callAI()` em um `AIClient` testável

### Tasks

#### 1.1 Criar estrutura de diretórios e tipos base
- [x] Criar `apps/api/src/services/ai/`
- [x] Criar `types.ts` com:
  - `AIMessage` (role, content)
  - `AIResponse` (content, usage)
  - `AIClientConfig` (baseUrl, apiKey, model)
  - `AIClient` interface (chat method)
- [x] Criar `index.ts` (re-exports)

**Critério de aceite:** Tipos exportados e sem erros de compilação

#### 1.2 Implementar HttpAiClient
- [x] Criar `client.ts` com `HttpAiClient` class
- [x] Recebe `AIClientConfig` no construtor (sem acesso ao DB)
- [x] Implementa `chat(messages): Promise<AIResponse>`
- [x] Usa `fetch` para chamar API OpenAI-compatible
- [x] Throws em erros de rede/parsing (não silencia)

**Critério de aceite:** Cliente funcional que faz chamadas HTTP reais

#### 1.3 Testes do HttpAiClient
- [x] Criar `client.test.ts`
- [x] Teste de integração com mock HTTP server
- [x] Testar sucesso, erro de rede, erro de parsing

**Critério de aceite:** 1 teste de integração passando

#### 1.4 Implementar Factory
- [x] Criar `factory.ts` com `createAiClient()`
- [x] Lê provider ativo do DB via Prisma
- [x] Retorna `HttpAiClient` configurado
- [x] Trata erro "no active provider"

**Critério de aceite:** Factory cria cliente funcional a partir do DB

---

## Sprint 2: AI Provider — Instrumented + Capabilities

**Objetivo:** Extrair capabilities do god module e adicionar instrumentação

### Tasks

#### 2.1 Implementar InstrumentedAiClient (Decorator)
- [x] Criar `instrumented.ts`
- [x] Implementa `AIClient`, recebe `AIClient` no construtor
- [x] Adiciona logging (model, latency, tokens)
- [x] Adiciona cost tracking (estimatedCost)
- [x] Alerta se custo > $0.05
- [x] Persiste `AiRun` no banco

**Critério de aceite:** Wrapper funcional com logging e persistência

#### 2.2 Extrair JobAnalyzer
- [x] Criar `job-analyzer.ts`
- [x] Classe `JobAnalyzer` recebe `AIClient` no construtor
- [x] Método `analyze(title, description, profile): Promise<JobAnalysis>`
- [x] Prompt template como template literal no módulo
- [x] Parseia resposta JSON
- [x] Throws em parsing falho (não silencia)

**Critério de aceite:** JobAnalyzer funcional com AiClient injetado

#### 2.3 Extrair JobExtractor
- [x] Criar `job-extractor.ts`
- [x] Classe `JobExtractor` recebe `AIClient`
- [x] Método `extract(title, description): Promise<JobExtraction>`
- [x] Prompt template interno

**Critério de aceite:** Extração funcional via AIClient

#### 2.4 Extrair CvParser
- [x] Criar `cv-parser.ts`
- [x] Classe `CvParser` recebe `AIClient`
- [x] Método `parse(rawText): Promise<CvData>`

**Critério de aceite:** Parsing de CV funcional

#### 2.5 Extrair Summarizer
- [x] Criar `summarizer.ts`
- [x] Método `summarize(description): Promise<string>`

#### 2.6 Extrair CvOptimizer
- [x] Criar `cv-optimizer.ts`
- [x] Método `optimize(cvText, jobTitle, jobDescription, matched, missing)`

#### 2.7 Atualizar factory para capabilities
- [x] `createJobAnalyzer(): JobAnalyzer`
- [x] `createJobExtractor(): JobExtractor`
- [x] `createCvParser(): CvParser`
- [x] `createSummarizer(): Summarizer`
- [x] `createCvOptimizer(): CvOptimizer`

#### 2.8 Migrar callers e deletar god module
- [x] Atualizar `workers/processing.ts` para usar novos módulos
- [x] Atualizar `routes/ai-providers.ts` para usar factory
- [x] Atualizar `routes/resumes.ts` se necessário
- [x] Deletar `services/ai-provider.ts` (574 lines → 0)

**Critério de aceite:** God module deletado, tudo funcionando via nova estrutura

---

## Sprint 3: Pipeline de Processamento

**Objetivo:** Deepen do pipeline — separar orchestration de business logic

### Tasks

#### 3.1 Analisar friction atual
- [x] Mapear responsabilidades em `processing.ts` (366 lines)
- [x] Identificar: orchestration, AI calls, DB updates, status transitions

#### 3.2 Criar módulo de orchestration
- [x] Criar `services/pipeline/orchestrator.ts`
- [x] Classe `JobPipeline` com método `run(jobId)`
- [x] Define sequência: extraction → matching → analysis
- [x] Cada etapa é um step injetável

#### 3.3 Criar módulos de step
- [x] Criar `services/pipeline/extraction-step.ts`
- [x] Criar `services/pipeline/matching-step.ts`
- [x] Criar `services/pipeline/analysis-step.ts`
- [x] Cada step tem interface comum `Step { run(jobId): Promise<void> }`

#### 3.4 Criar fallback strategies
- [x] Criar `services/pipeline/fallbacks.ts`
- [x] `fallbackExtraction(job)` — keyword matching
- [x] `generateBasicAnalysis(job, match)` — análise sem IA

#### 3.5 Migrar processing worker
- [x] Atualizar `workers/processing.ts` para usar orchestrator
- [x] Manter compatibilidade com filas BullMQ existentes

**Critério de aceite:** Pipeline modular com steps testáveis independentemente

---

## Sprint 4: Consolidar Parsing de Fontes

**Objetivo:** Unificar lógica de parsing que está espalhada

### Tasks

#### 4.1 Mapear parsing espalhado
- [x] Identificar onde jobs são normalizados (sources/*.ts)
- [x] Identificar onde skills são extraídos (processing.ts)
- [x] Identificar onde seniority é detectado

#### 4.2 Criar módulo de normalização
- [x] Criar `services/normalization/job-normalizer.ts` (implementado como `sources/normalizer.ts`)
- [x] Método `normalize(rawJob, sourceType): NormalizedJob`
- [x] Centraliza: title cleanup, company extraction, location parsing

#### 4.3 Criar módulo de skill extraction
- [x] Criar `services/normalization/skill-extractor.ts` (consolidado no pipeline)
- [x] Extrai skills de descrições de vagas
- [x] Usa catálogo de skills do DB

#### 4.4 Consolidar seniority detection
- [x] Mover `utils/seniority.ts` para `services/normalization/` (consolidado no normalizer)
- [x] Adicionar detecção via IA como fallback (no pipeline)

**Critério de aceite:** Parsing centralizado, sources/*.ts mais finos

---

## Sprint 5: Thin dos Route Handlers

**Objetivo:** Mover business logic dos routes para services

### Tasks

#### 5.1 Identificar lógica nos routes
- [x] Mapear `routes/*.ts* com lógica de negócio
- [x] Identificar validações que deveriam estar em services

#### 5.2 Criar service layer para cada domínio
- [x] Criar `services/jobs/job-service.ts` (implementado como `services/job-service.ts`)
- [x] Criar `services/applications/application-service.ts` (implementado como `services/application-service.ts`)
- [x] Criar `services/profile/profile-service.ts` (se necessário) (migration concluída)

#### 5.3 Migrar handlers
- [x] Routes apenas validam input e chamam services
- [x] Services contêm business logic
- [x] Repositories (Prisma) isolados

**Critério de aceite:** Routes com < 20 linhas de lógica cada

---

## Sprint 6: Quick Wins (Speculative)

**Objetivo:** Limpezas de baixo risco/alta velocidade

### Tasks

#### 5.1 Centralizar settings keys
- [x] Criar `config/settings-keys.ts` com constantes (implementado como `services/settings-keys.ts`)
- [x] Substituir strings mágicas por constantes
- [x] Ex: `SOURCES_KEY = 'sources'`, `CRON_KEY = 'cron'`

#### 5.2 Deletar shallow wrappers
- [x] Identificar wrappers que só delegam sem adicionar valor
- [x] Deletar e usar implementação diretamente
- [x] Candidatos: funções que só chamam outra função (resumes.ts → resume-service.ts)

**Critério de aceite:** Código morto removido, sem mudança de comportamento

---

## Definições de Pronto (Definition of Done)

Para cada task:
- [x] Código implementado e typecheck passando
- [x] Testes unitários passando (20/20)
- [x] Testes de integração passando
- [x] `pnpm build` sem erros
- [x] `pnpm lint` sem erros
- [x] Código revisado (self-review)

---

## Riscos e Mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Quebra de funcionalidade durante refatoração | Alto | Testes antes de refatorar, migração incremental |
| Perda de dados ao migrar AI provider | Crítico | Manter backup do banco, testar em dev primeiro |
| Breaking change nas filas BullMQ | Médio | Manter nomes de jobs/filas inalterados |
| Escopo creep | Médio | Seguir tasks definidas, não adicionar "só mais uma coisa" |

---

## Métricas de Sucesso

| Métrica | Antes | Depois (meta) |
|---------|-------|---------------|
| Linhas do AI Provider | 574 | 0 (deletado) |
| Número de módulos AI | 1 | 8 (types, client, factory, instrumented, 4 capabilities) |
| Cobertura de testes AI | 0% | > 70% |
| Linhas do pipeline | 366 | < 100 (orchestrator) |
| Acoplamento (imports por módulo) | Alto | Baixo |

---

## Notas

- **Sprints 1-2 foram concluídas** — AI Provider god module deletado, 8 novos módulos criados
- **Sprint 3 foi concluída** — Pipeline modular com orchestrator + steps + fallbacks
- **Sprints 4-6 foram concluídas** — Normalização centralizada, routes thinnados, settings centralizados, shallow wrappers eliminados
- Cada sprint deve ser completado antes de iniciar o próximo
- Commits devem ser por task, não por sprint
