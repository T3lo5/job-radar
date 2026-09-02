# 30 — Módulo de notificações (interface + Telegram)

## Question

Interface `NotificationChannel`:

```ts
interface NotificationChannel {
  id: string
  name: string
  send(message: Message): Promise<SendResult>
}
```

Implementar `TelegramChannel` primeiro usando `node-telegram-bot-api` ou `grammy` (mais moderno, type-safe).

Mensagens formatadas com Markdown. Retry com backoff. Log de envios em `notifications`.

## Type

grilling

## Status

done

## Resolution

**Módulo de Notificações** (`apps/api/src/services/notifications.ts`):

**Interface `NotificationChannel`:**
- `id`, `name`, `send(message)`

**`TelegramChannel`:**
- Usa `grammy` (moderno, type-safe)
- Retry com backoff exponencial (3 tentativas)
- Mensagens em Markdown

**Endpoints:**
- `POST /api/notifications/test` — testa conexão Telegram
- `POST /api/notifications/send` — envia notificação de teste

**Auditoria:** Todos os envios logados na tabela `notifications`

**Dependência:** `grammy`

**Validação:**
- `pnpm typecheck` ✓
