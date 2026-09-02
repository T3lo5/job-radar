import { Bot } from 'grammy'
import { settingsService } from './settings-service.js'
import { prisma } from '../db/prisma.js'
import { matchLabelFor, MATCH_LABELS } from '@job-radar/shared'
import { SETTINGS_SCOPE, TELEGRAM_SETTINGS } from './settings-keys.js'

let bot: Bot | null = null

export async function startTelegramBot(): Promise<void> {
  const botToken = await settingsService.get(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.BOT_TOKEN)
  if (!botToken) {
    console.log('Telegram bot token not configured, skipping bot startup')
    return
  }

  bot = new Bot(botToken)

  // Commands
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 *Bem-vindo ao Job Radar!*\n\n' +
        'Seu assistente pessoal para vagas de tecnologia.\n\n' +
        'Comandos disponíveis:\n' +
        '/hoje — Vagas de hoje\n' +
        '/top — Top 5 matches\n' +
        '/stats — Estatísticas\n' +
        '/help — Ajuda\n\n' +
        '🔗 Dashboard: http://localhost:5173',
      { parse_mode: 'Markdown' },
    )

    // Save chat ID
    await saveChatId(ctx.chat.id)
  })

  bot.command('help', async (ctx) => {
    await ctx.reply(
      '📋 *Comandos do Job Radar:*\n\n' +
        '/start — Inicializar bot\n' +
        '/hoje — Vagas coletadas hoje\n' +
        '/top — Top 5 melhores matches\n' +
        '/stats — Estatísticas gerais\n' +
        '/help — Esta mensagem',
      { parse_mode: 'Markdown' },
    )
  })

  bot.command('hoje', async (ctx) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const jobs = await prisma.job.findMany({
      where: { collectedAt: { gte: today } },
      orderBy: { collectedAt: 'desc' },
      take: 10,
    })

    if (jobs.length === 0) {
      await ctx.reply('📭 Nenhuma vaga coletada hoje.')
      return
    }

    let message = `📅 *Vagas de hoje (${jobs.length}):*\n\n`
    for (const job of jobs.slice(0, 5)) {
      message += `• *${job.title}* — ${job.company}\n`
      message += `  ${job.location ?? 'Localização N/A'}\n\n`
    }

    if (jobs.length > 5) {
      message += `_...e mais ${jobs.length - 5} vaga(s)_`
    }

    await ctx.reply(message, { parse_mode: 'Markdown' })
  })

  bot.command('top', async (ctx) => {
    const profile = await prisma.profile.findFirst()
    if (!profile) {
      await ctx.reply('❌ Perfil não configurado.')
      return
    }

    const matches = await prisma.jobMatch.findMany({
      where: { profileId: profile.id },
      include: { job: true },
      orderBy: { score: 'desc' },
      take: 5,
    })

    if (matches.length === 0) {
      await ctx.reply('📭 Nenhum match avaliado ainda. Use o dashboard para avaliar vagas.')
      return
    }

    let message = '🏆 *Top 5 Matches:*\n\n'
    for (const match of matches) {
      const label = matchLabelFor(match.score)
      const visual = MATCH_LABELS[label]
      message += `${visual.emoji} *${match.score}* — ${match.job.title}\n`
      message += `  ${match.job.company}\n\n`
    }

    await ctx.reply(message, { parse_mode: 'Markdown' })
  })

  bot.command('stats', async (ctx) => {
    const [totalJobs, totalMatches, totalApplications, byStatus] = await Promise.all([
      prisma.job.count(),
      prisma.jobMatch.count(),
      prisma.application.count(),
      prisma.job.groupBy({
        by: ['status'],
        _count: true,
      }),
    ])

    const statusMap = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count]),
    )

    let message = '📊 *Estatísticas do Job Radar:*\n\n'
    message += `📋 Total de vagas: *${totalJobs}*\n`
    message += `🎯 Matches avaliados: *${totalMatches}*\n`
    message += `📨 Candidaturas: *${totalApplications}*\n\n`
    message += '*Por status:*\n'
    message += `  Coletadas: ${statusMap['RAW'] ?? 0}\n`
    message += `  Processando: ${(statusMap['EXTRACTING'] ?? 0) + (statusMap['MATCHING'] ?? 0) + (statusMap['ANALYZING'] ?? 0)}\n`
    message += `  Prontas: ${statusMap['DONE'] ?? 0}\n`
    message += `  Com erro: ${statusMap['FAILED'] ?? 0}`

    await ctx.reply(message, { parse_mode: 'Markdown' })
  })

  // Error handler
  bot.catch((err) => {
    console.error('Telegram bot error:', err)
  })

  // Start polling
  bot.start()
  console.log('Telegram bot started')
}

export function getBot(): Bot | null {
  return bot
}

async function saveChatId(chatId: number): Promise<void> {
  await settingsService.set(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.CHAT_ID, String(chatId))
}

export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    await bot.stop()
    bot = null
  }
}
