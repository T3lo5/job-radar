# Roadmap de Melhorias ATS — Job Radar

Baseado no guia de boas práticas de currículos ATS (Applicant Tracking Systems).

## P0 — Correções de integridade

### 1. Extração de JSON do campo `reasoning`

- **Problema**: Modelo `sensenova-6.8-flash-lite` devolve resposta no campo `reasoning` em vez de `content`.
- **Arquivo**: `apps/api/src/services/ai/client.ts`, `apps/api/src/services/ai/cv-optimizer.ts`
- **Solucao**: Extrai `message.content` primeiro, cai para `message.reasoning`. Funcao `extractJson()` localiza o primeiro `{` e o ultimo `}`.

### 2. Preservar estrutura original do CV

- **Problema**: O modelo renomeava secoes e adicionava um titre de capa "CV Optimized".
- **Arquivo**: `apps/api/src/services/ai/cv-optimizer.ts`
- **Solucao**: Regras 12-15 no prompt de `optimizeWithProfile` e regras de formatacao no `optimize`.

### 3. Timeout de chamada de IA

- **Problema**: Timeout fixo de 15s era insuficiente para prompts grandes.
- **Arquivo**: `apps/api/src/services/ai/client.ts`, `apps/api/src/services/ai/cv-optimizer.ts`
- **Solucao**: `timeoutMs: 120_000` em ambos os metodos.

### 4. Limite de tokens de saida

- **Problema**: `maxTokens: 4000` cortava a resposta no meio (JSON incompleto) ou voltava vazio.
- **Arquivo**: `apps/api/src/services/ai/cv-optimizer.ts`
- **Solucao**: `maxTokens: 8000`.

## P1 — Verificador de ATS-friendliness

- **Arquivo novo**: `apps/api/src/services/cv-ats-checker.ts`
- **Endpoint**: `GET /api/resumes/:id/ats-check`
- **O que verifica**:
  - Tabelas (linhas com multiplos separadores)
  - Layout em multiplas colunas
  - Ausencia de bloco de contato
  - Tamanho estimado em paginas
  - Score de 0-100
- **Frontend**: Exibe resultado na secao de Currículos do perfil, com badge de score.

## P2 — Enriquecimento do perfil

### Idiomas padronizados

- **Arquivo**: `packages/shared/src/utils/language-levels.ts`
- **Solucao**: Select com codigos CEFR (A1-C2) em vez de textos livres.
  - `C1` → "English: Professional working proficiency (C1)"

### Traducao de cargos e formacao

- **Arquivo**: `packages/shared/src/utils/cv-translations.ts`
- **Solucao**: Mapeamentos:
  - "Analista de Sistemas Pleno" → "Software Engineer (Mid-level)"
  - "Bacharelado em Sistemas de Informacao" → "Bachelor's Degree in Information Systems"

### Detecao de achievements (metricas)

- **Arquivo**: `packages/shared/src/utils/achievements.ts`
- **Solucao**: Detecta bullets com porcentagens, tempos, etc. Exibe badge 📊.

## P3 — Keyword gap analysis

- **Arquivo novo**: `apps/api/src/services/keyword-gap-analyzer.ts`
- **Endpoint**: `GET /api/jobs/:id/keyword-gap`
- **O que faz**:
  - Usa o matching engine para classificar skills em matched/partial/missing
  - Separa keywords em obrigatórias (`required`) e desejáveis (`nice-to-have`)
  - Extrai keywords adicionais da descrição textual
  - Gera sugestoes de acao para cada gap
- **Frontend**: Card de "Analise de Keywords" na página de detalhes da vaga.

## P4 — Cover letter e seguimento de candidaturas

### Cover letter por IA

- **Arquivo novo**: `apps/api/src/services/cover-letter.ts`
- **Endpoint**: `POST /api/cv/cover-letter`
- **Solucao**: Gera carta em ingles, personalizada para a vaga, destacando 2-3 conquistas reais.

### ATS tracking

- **Arquivo**: `apps/api/prisma/schema.prisma` (novo campo `atsUsed`)
- **Frontend**: Select de ATS no dialogo de detalhes da candidatura (Greenhouse, Lever, Workday, etc.)

### Enum de auditoria

- `AiRunType` agora inclui `COVER_LETTER`.

## P5 — Detector de dados sensíveis

- **Arquivo novo**: `packages/shared/src/utils/sensitive-data.ts`
- **Solucao**: Varre o `rawText` do CV e sinaliza:
  - CPF, RG, passaporte
  - Data de nascimento
  - Endereço completo (com CEP)
  - Estado civil
  - Referência a foto
- **Comportamento**: Não bloqueia o upload, só alerta o usuário via toast.

## Estrutura de arquivos criados

| Arquivo                                            | Proposito                      |
| -------------------------------------------------- | ------------------------------ |
| `packages/shared/src/utils/language-levels.ts`     | Niveis CEFR padronizados       |
| `packages/shared/src/utils/cv-translations.ts`     | Traducao de cargos e formacao  |
| `packages/shared/src/utils/achievements.ts`        | Detecao de metricas            |
| `packages/shared/src/utils/sensitive-data.ts`      | Detector de dados sensíveis    |
| `apps/api/src/services/cv-ats-checker.ts`          | Verificador ATS-friendliness   |
| `apps/api/src/services/keyword-gap-analyzer.ts`    | Analise de gap de keywords     |
| `apps/api/src/services/cover-letter.ts`            | Gerador de cover letter por IA |
| `apps/api/src/services/sensitive-data-detector.ts` | Re-export do detector          |
