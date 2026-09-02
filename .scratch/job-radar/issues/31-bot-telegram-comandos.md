# 31 — Bot do Telegram: comandos básicos

## Question

Criar bot e configurar comandos:

- `/start` — mensagem de boas-vindas + link do dashboard
- `/hoje` — vagas de hoje (resumo)
- `/top` — top 5 matches
- `/stats` — estatísticas gerais
- `/help` — lista de comandos

Webhook ou polling. Armazenar `chat_id` no perfil do usuário.

## Type

task

## Status

done

## Resolution

**Bot Telegram** (`apps/api/src/services/telegram-bot.ts`):

**Comandos:**
- `/start` — boas-vindas + link dashboard + salva chatId
- `/hoje` — vagas coletadas hoje
- `/top` — top 5 matches com badge
- `/stats` — estatísticas gerais
- `/help` — lista de comandos

**Polling** (sem necessidade de webhook)
**Salva chatId** automaticamente no `/start`

**Validação:**
- `pnpm typecheck` ✓
