# 22 — Allowlist do bot do Telegram

Status: resolved
Sprint: 1
Prioridade: P1
Área: api
Esforço: baixo
Origem: [auditoria §4.15](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

Qualquer pessoa que encontre o bot pode mandar `/start`; o handler salva o chat id e **sobrescreve** o chat configurado. A partir daí, `/hoje`, `/top` e `/stats` entregam títulos, empresas e candidaturas do dono para o intruso. O link do dashboard aponta para `localhost`, inútil no celular.

## Evidência

- `apps/api/src/services/telegram-bot.ts:33` — `saveChatId(ctx.chat.id)` em qualquer `/start`.
- `apps/api/src/services/telegram-bot.ts:65` — mensagens sem escape de Markdown.
- Link do dashboard hardcoded para `http://localhost:5173`.

## Correção

1. Ler o chat id configurado em settings; comparar `ctx.chat.id` antes de qualquer resposta.
2. `/start` de chat desconhecido: ignorar silenciosamente (ou responder "não autorizado") e **nunca** salvar.
3. Trocar o chat id só por ação explícita dentro do app (com confirmação), nunca por mensagem ao bot.
4. Escapar Markdown em títulos/empresas de terceiros (também no relatório diário, `daily-report.ts:83-90`).
5. URL pública do dashboard vinda de setting (`APP_PUBLIC_URL`) com fallback para o host da request.

## Critérios de aceite

- [x] `/start` de chat não autorizado não altera o chat configurado nem recebe dados.
- [x] Chat autorizado continua recebendo `/hoje`, `/top` e `/stats`.
- [x] Títulos com `*`, `_`, `[`, `]` não quebram a mensagem.
- [x] Link do dashboard usa a URL pública configurada.
- [x] Teste cobre chat desconhecido e caractere especial em título.

## Testes

- `apps/api/tests/telegram-bot.test.ts` com update fake de chat desconhecido.
- Teste de formatação Markdown com payload adversarial.

## Comments

- 2026-10-28 — Bot só responde ao chat configurado.
  - `createChatGuard` (`telegram-format.ts`) roda como `bot.use`, antes de qualquer comando: lê `telegram.chatId`, compara com `ctx.chat.id` e, se não bater (ou se não houver chat configurado), retorna sem chamar `next()`. Silencioso de propósito — responder "não autorizado" confirma a existência do bot.
  - `saveChatId` foi removido. `/start` não escreve mais nada em settings; trocar o chat só por `/api/setup/telegram` ou `POST /api/settings`.
  - `escapeMarkdown` aplicado em título/empresa/localização de `/hoje` e `/top` e em título/empresa/localização/URL do `daily-report`. `/stats` só emite números do próprio banco.
  - Link do dashboard: setting `app.publicUrl` (novo escopo `app` em `WRITABLE_SCOPES`), fallback `APP_PUBLIC_URL` (agora no schema de env e documentado no `.env.example`). Sem nenhum dos dois, o link é omitido em vez de apontar para `localhost`.
  - `createTelegramBot(token, deps)` separa registro de comandos de polling; `startTelegramBot` só injeta settings/env e chama `bot.start()`. Isso permitiu testar updates de verdade sem rede.
  - Testes: `telegram-format.test.ts` (14) cobre autorização, guard, escape (inclusive URL com parênteses), URL pública/fallback e mensagem sem localhost. `tests/telegram-bot.test.ts` (8) injeta updates fake via `handleUpdate` com a API do Telegram interceptada: chat desconhecido não recebe nenhuma chamada a `sendMessage` nem lê outro setting além do chat; sem chat configurado ninguém passa; chat autorizado recebe `/start` com a URL configurada (setting vence o fallback), `/hoje` escapado com título `Dev *Sênior* [React] (100%)`, `/top` escapado e `/stats`. `daily-report.test.ts` (3) cobre escape no relatório, relatório vazio e falha do canal registrada.
  - Verificação: API typecheck=0 lint=0 test=353.
