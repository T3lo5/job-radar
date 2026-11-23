/**
 * Regras de autorização e formatação do bot do Telegram.
 *
 * Ficam fora de `telegram-bot.ts` porque aquele arquivo fala com a rede: sem
 * separar, não há como testar "chat desconhecido é ignorado" nem "título com
 * `*` não quebra a mensagem".
 */

/**
 * Escapa Markdown legado (parse_mode: 'Markdown').
 *
 * Título/empresa vêm de fora (HTML da vaga). Um `*` solto abre negrito e a
 * mensagem inteira falha com 400 — ou pior, o texto de terceiro passa a
 * controlar a formatação do relatório.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/([\\_*[\]()`~>#+\-=|{}.!])/g, '\\$1');
}

/**
 * O chat configurado é o único autorizado.
 *
 * Sem configuração, NINGUÉM é autorizado — o contrário (primeiro /start vence)
 * era o bug: qualquer pessoa que achasse o bot sobrescrevia o chat do dono e
 * passava a receber vagas, matches e candidaturas.
 */
export function isChatAuthorized(
  chatId: number | string | null | undefined,
  configuredChatId: string | null | undefined,
): boolean {
  if (chatId === null || chatId === undefined) return false;
  const configured = configuredChatId?.trim();
  if (!configured) return false;
  return String(chatId) === configured;
}

/** Primeira URL não vazia, sem barra final. `null` se nenhuma foi configurada. */
export function resolveDashboardUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (url) return url.replace(/\/+$/, '');
  }
  return null;
}

/** Mensagem de /start. Sem URL configurada, omite o link em vez de mentir. */
export function buildStartMessage(dashboardUrl?: string | null): string {
  const linhas = [
    '👋 *Bem-vindo ao Job Radar!*',
    '',
    'Seu assistente pessoal para vagas de tecnologia.',
    '',
    'Comandos disponíveis:',
    '/hoje — Vagas de hoje',
    '/top — Top 5 matches',
    '/stats — Estatísticas',
    '/help — Ajuda',
  ];

  if (dashboardUrl) {
    linhas.push('', `🔗 Dashboard: ${dashboardUrl}`);
  }

  return linhas.join('\n');
}

/**
 * Guarda de chat para o middleware do bot.
 *
 * Recebe a leitura do setting por injeção: o teste não precisa de banco nem de
 * bot. Nunca escreve nada — trocar o chat é ação explícita no app.
 */
export function createChatGuard(getConfiguredChatId: () => Promise<string | null>) {
  return async function chatGuard(
    ctx: { chat?: { id: number } },
    next: () => Promise<void>,
  ): Promise<void> {
    const configured = await getConfiguredChatId();
    if (!isChatAuthorized(ctx.chat?.id, configured)) {
      // Silencioso de propósito: responder "não autorizado" confirma a
      // existência do bot para quem estiver sondando.
      return;
    }
    await next();
  };
}
