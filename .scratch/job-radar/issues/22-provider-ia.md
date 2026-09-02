# 22 — Provider de IA configurável

## Question

Decidir provider e modelo inicial:

- **OpenAI** (`gpt-4o-mini` barato, `gpt-4o` melhor)
- **Anthropic** (`claude-haiku-4-5` barato, `claude-sonnet-4-5` melhor)
- **Google** (`gemini-2.5-flash` free tier generoso)
- **Ollama local** (grátis, depende de hardware)

Para começar grátis/cheap: Gemini 2.5 Flash ou Claude Haiku. Interface abstrata `AIProvider` com `extract()`, `summarize()`, `analyze()`.

Configurável por env var. Fallback entre providers.

## Type

grilling

## Status

done

## Resolution

**Provider de IA customizável** (`apps/api/src/services/ai-provider.ts`):

**Configuração via Settings (UI):**
- `ai.baseUrl` — URL da API (padrão: https://api.openai.com/v1)
- `ai.apiKey` — Chave de API (criptografada)
- `ai.model` — Nome do modelo (padrão: gpt-4o-mini)

**Formato OpenAI-compatible:**
- Funciona com OpenAI, Ollama, Together AI, Groq, Anthropic (compatível), etc.
- Endpoint: `{baseUrl}/chat/completions`

**Funções:**
- `extractCvData()` — extrai dados estruturados do CV
- `analyzeJob()` — analisa match vaga vs perfil
- `summarizeJob()` — resume descrição da vaga
- `testConnection()` — testa conexão com a API
- `runAiOperation()` — execução genérica com auditoria

**Auditoria:** Todas as chamadas são logadas em `ai_runs` (tokens, latência, status)

**Endpoint:** `POST /api/ai/test` — testa configuração

**Migration:** `add_summarize_type` (novo tipo de AI run)

**Validação:**
- `pnpm typecheck` ✓
