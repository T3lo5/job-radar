import { Bot } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { getEnv } from '../config/env.js';
import { settingsService } from './settings-service.js';
import { prisma } from '../db/prisma.js';
import { matchLabelFor, MATCH_LABELS } from '@job-radar/shared';
import { APP_SETTINGS, SETTINGS_SCOPE, TELEGRAM_SETTINGS } from './settings-keys.js';
import {
  buildStartMessage,
  createChatGuard,
  escapeMarkdown,
  resolveDashboardUrl,
} from './telegram-format.js';

/**
 * Dependências do bot, injetáveis para teste.
 *
 * Antes, o módulo lia settings direto e chamava `bot.start()` no mesmo lugar em
 * que registrava os comandos: não dava para simular um update sem abrir conexão
 * com o Telegram. Separar também deixa explícito que nada aqui escreve setting.
 */
export interface TelegramBotDeps {
  readSetting: (scope: string, key: string) => Promise<string | null>;
  /** Fallback do link do dashboard, quando o setting não está configurado. */
  fallbackPublicUrl?: string;
  /**
   * Só para teste: evita o `getMe()` de rede na primeira atualização. Em
   * produção fica indefinido e o grammy busca os dados do bot sozinho.
   */
  botInfo?: UserFromGetMe;
}

let bot: Bot | null = null;

/**
 * Registra os comandos em um Bot já criado. Não inicia polling — quem chama
 * decide (`startTelegramBot` em produção, `handleUpdate` nos testes).
 */
export function createTelegramBot(botToken: string, deps: TelegramBotDeps): Bot {
  const created = new Bot(botToken, deps.botInfo ? { botInfo: deps.botInfo } : undefined);

  // Antes de qualquer comando: o chat precisa ser o configurado em settings.
  // A versão anterior aceitava /start de qualquer um e SALVAVA o chat id, o
  // que entregava vagas, matches e candidaturas do dono ao intruso. O chat
  // agora só muda por ação explícita em /api/setup/telegram ou /api/settings.
  created.use(
    createChatGuard(() => deps.readSetting(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.CHAT_ID)),
  );

  // Commands
  created.command('start', async (ctx) => {
    const dashboardUrl = resolveDashboardUrl(
      await deps.readSetting(SETTINGS_SCOPE.APP, APP_SETTINGS.PUBLIC_URL),
      deps.fallbackPublicUrl,
    );

    await ctx.reply(buildStartMessage(dashboardUrl), { parse_mode: 'Markdown' });
  });

  created.command('help', async (ctx) => {
    await ctx.reply(
      '📋 *Comandos do Job Radar:*\n\n' +
        '/start — Inicializar bot\n' +
        '/hoje — Vagas coletadas hoje\n' +
        '/top — Top 5 melhores matches\n' +
        '/stats — Estatísticas gerais\n' +
        '/help — Esta mensagem',
      { parse_mode: 'Markdown' },
    );
  });

  created.command('hoje', async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const jobs = await prisma.job.findMany({
      where: { collectedAt: { gte: today } },
      orderBy: { collectedAt: 'desc' },
      take: 10,
    });

    if (jobs.length === 0) {
      await ctx.reply('📭 Nenhuma vaga coletada hoje.');
      return;
    }

    let message = `📅 *Vagas de hoje (${jobs.length}):*\n\n`;
    for (const job of jobs.slice(0, 5)) {
      // Título e empresa vêm do HTML da vaga: sem escape, um `*` ou `[` solto
      // faz o Telegram rejeitar a mensagem inteira (400) ou deixa o texto de
      // terceiro controlar a formatação.
      message += `• *${escapeMarkdown(job.title)}* — ${escapeMarkdown(job.company)}\n`;
      message += `  ${escapeMarkdown(job.location ?? 'Localização N/A')}\n\n`;
    }

    if (jobs.length > 5) {
      message += `_...e mais ${jobs.length - 5} vaga(s)_`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  created.command('top', async (ctx) => {
    // Bot do Telegram é global (um chat para a instalação). Sem usuário de
    // sessão aqui, usar o perfil mais antigo explicitamente — mesmo critério da
    // coleta — em vez de depender da ordem que o Postgres devolver.
    const profile = await prisma.profile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!profile) {
      await ctx.reply('❌ Perfil não configurado.');
      return;
    }

    const matches = await prisma.jobMatch.findMany({
      where: { profileId: profile.id },
      include: { job: true },
      orderBy: { score: 'desc' },
      take: 5,
    });

    if (matches.length === 0) {
      await ctx.reply('📭 Nenhum match avaliado ainda. Use o dashboard para avaliar vagas.');
      return;
    }

    let message = '🏆 *Top 5 Matches:*\n\n';
    for (const match of matches) {
      const label = matchLabelFor(match.score);
      const visual = MATCH_LABELS[label];
      message += `${visual.emoji} *${match.score}* — ${escapeMarkdown(match.job.title)}\n`;
      message += `  ${escapeMarkdown(match.job.company)}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  created.command('stats', async (ctx) => {
    const [totalJobs, totalMatches, totalApplications, byStatus] = await Promise.all([
      prisma.job.count(),
      prisma.jobMatch.count(),
      prisma.application.count(),
      prisma.job.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));

    let message = '📊 *Estatísticas do Job Radar:*\n\n';
    message += `📋 Total de vagas: *${totalJobs}*\n`;
    message += `🎯 Matches avaliados: *${totalMatches}*\n`;
    message += `📨 Candidaturas: *${totalApplications}*\n\n`;
    message += '*Por status:*\n';
    message += `  Coletadas: ${statusMap['RAW'] ?? 0}\n`;
    message += `  Processando: ${(statusMap['EXTRACTING'] ?? 0) + (statusMap['MATCHING'] ?? 0) + (statusMap['ANALYZING'] ?? 0)}\n`;
    message += `  Prontas: ${statusMap['DONE'] ?? 0}\n`;
    message += `  Com erro: ${statusMap['FAILED'] ?? 0}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Error handler
  created.catch((err) => {
    console.error('Telegram bot error:', err);
  });

  return created;
}

export async function startTelegramBot(): Promise<void> {
  const botToken = await settingsService.get(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.BOT_TOKEN);
  if (!botToken) {
    console.log('Telegram bot token not configured, skipping bot startup');
    return;
  }

  bot = createTelegramBot(botToken, {
    readSetting: (scope, key) => settingsService.get(scope, key),
    fallbackPublicUrl: getEnv().APP_PUBLIC_URL,
  });

  bot.start();
  console.log('Telegram bot started');
}

export function getBot(): Bot | null {
  return bot;
}

export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    await bot.stop();
    bot = null;
  }
}
