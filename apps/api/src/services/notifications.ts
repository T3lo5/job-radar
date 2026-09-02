import { Bot } from 'grammy'
import { settingsService } from './settings-service.js'
import { prisma } from '../db/prisma.js'
import { SETTINGS_SCOPE, TELEGRAM_SETTINGS } from './settings-keys.js'

export interface Message {
  text: string
  parseMode?: 'Markdown' | 'HTML'
  disableNotification?: boolean
}

export interface SendResult {
  success: boolean
  messageId?: number
  error?: string
}

export interface NotificationChannel {
  id: string
  name: string
  send(message: Message): Promise<SendResult>
}

class TelegramChannel implements NotificationChannel {
  id = 'telegram'
  name = 'Telegram'
  private bot: Bot | null = null
  private chatId: string | null = null

  private async init(): Promise<{ bot: Bot; chatId: string }> {
    if (this.bot && this.chatId) {
      return { bot: this.bot, chatId: this.chatId }
    }

    const [botToken, chatId] = await Promise.all([
      settingsService.get(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.BOT_TOKEN),
      settingsService.get(SETTINGS_SCOPE.TELEGRAM, TELEGRAM_SETTINGS.CHAT_ID),
    ])

    if (!botToken) {
      throw new Error('Telegram bot token not configured')
    }
    if (!chatId) {
      throw new Error('Telegram chat ID not configured')
    }

    this.bot = new Bot(botToken)
    this.chatId = chatId

    return { bot: this.bot, chatId: this.chatId }
  }

  async getBotInfo(): Promise<{ id: number; username: string }> {
    const { bot } = await this.init()
    const me = await bot.api.getMe()
    return { id: me.id, username: me.username ?? 'unknown' }
  }

  async send(message: Message, retries = 3): Promise<SendResult> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { bot, chatId } = await this.init()

        const result = await bot.api.sendMessage(chatId, message.text, {
          parse_mode: message.parseMode ?? 'Markdown',
          disable_notification: message.disableNotification,
        })

        return { success: true, messageId: result.message_id }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        const delay = Math.pow(2, attempt) * 1000

        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        return { success: false, error }
      }
    }

    return { success: false, error: 'Max retries exceeded' }
  }
}

export const telegramChannel = new TelegramChannel()

export async function sendNotification(
  channelId: string,
  message: Message,
): Promise<SendResult> {
  const channels: Record<string, NotificationChannel> = {
    telegram: telegramChannel,
  }

  const channel = channels[channelId]
  if (!channel) {
    return { success: false, error: `Unknown channel: ${channelId}` }
  }

  const result = await channel.send(message)

  // Log the notification
  await prisma.notification.create({
    data: {
      channel: channelId,
      payload: message as unknown as object,
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      error: result.error,
    },
  })

  return result
}

export async function testTelegramConnection(): Promise<{
  ok: boolean
  error?: string
  botInfo?: { id: number; username: string }
}> {
  try {
    const botInfo = await telegramChannel.getBotInfo()
    return { ok: true, botInfo }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
