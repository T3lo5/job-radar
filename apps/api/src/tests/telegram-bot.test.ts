import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Update, UserFromGetMe } from 'grammy/types';
import { createTelegramBot } from '../services/telegram-bot.js';

/**
 * Ticket 22: o bot não pode aceitar /start de qualquer chat.
 *
 * A versão anterior salvava `ctx.chat.id` em TODA mensagem /start: qualquer
 * pessoa que achasse o bot sobrescrevia o chat do dono e passava a receber
 * vagas, matches e candidaturas. Aqui os updates são injetados via
 * `handleUpdate` (sem rede) e a API do Telegram é interceptada por um
 * transformer, então dá para afirmar "não respondeu nada".
 */

const db = vi.hoisted(() => ({
  job: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  jobMatch: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  application: {
    count: vi.fn(),
  },
  profile: {
    findFirst: vi.fn(),
  },
}));

vi.mock('../db/prisma.js', () => ({ prisma: db }));

const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'Radar',
  username: 'radar_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

const CHAT_AUTORIZADO = '123';

interface Sent {
  method: string;
  payload: Record<string, unknown>;
}

function updateComTexto(chatId: number, text: string): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private', first_name: 'Visitante' },
      from: { id: chatId, is_bot: false, first_name: 'Visitante' },
      text,
      entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }],
    },
  };
}

function montarBot(opcoes: { chatConfigurado: string | null; publicUrl?: string | null }) {
  const chamadas: Sent[] = [];
  const leituras: Array<{ scope: string; key: string }> = [];

  const bot = createTelegramBot('123:token-fake', {
    botInfo: BOT_INFO,
    readSetting: async (scope, key) => {
      leituras.push({ scope, key });
      if (scope === 'telegram' && key === 'chatId') return opcoes.chatConfigurado;
      if (scope === 'app' && key === 'publicUrl') return opcoes.publicUrl ?? null;
      return null;
    },
    fallbackPublicUrl: 'https://radar.exemplo.com',
  });

  // Nada de rede: registra a chamada e devolve uma resposta mínima de sucesso.
  bot.api.config.use(async (_prev, method, payload) => {
    chamadas.push({ method, payload: payload as Record<string, unknown> });
    return {
      ok: true,
      result: { message_id: chamadas.length },
    } as unknown as never;
  });

  return { bot, chamadas, leituras };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bot do Telegram — allowlist de chat', () => {
  it('/start de chat desconhecido não recebe resposta nem toca em settings', async () => {
    const { bot, chamadas, leituras } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });

    await bot.handleUpdate(updateComTexto(999, '/start'));

    expect(chamadas).toEqual([]);
    // Só LEITURA do chat configurado. Nenhuma escrita é possível a partir daqui:
    // as dependências do bot nem expõem um setter de setting.
    expect(leituras).toEqual([{ scope: 'telegram', key: 'chatId' }]);
  });

  it('sem chat configurado, nem o /start do "primeiro a chegar" passa', async () => {
    const { bot, chamadas } = montarBot({ chatConfigurado: null });

    await bot.handleUpdate(updateComTexto(999, '/start'));

    expect(chamadas).toEqual([]);
  });

  it('chat autorizado recebe o link público configurado, não localhost', async () => {
    const { bot, chamadas } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });

    await bot.handleUpdate(updateComTexto(123, '/start'));

    expect(chamadas).toHaveLength(1);
    const [envio] = chamadas;
    expect(envio.method).toBe('sendMessage');
    expect(envio.payload.chat_id).toBe(123);
    expect(envio.payload.parse_mode).toBe('Markdown');
    expect(envio.payload.text).toContain('https://radar.exemplo.com');
    expect(envio.payload.text).not.toContain('localhost');
  });

  it('o setting app.publicUrl vence o fallback do ambiente', async () => {
    const { bot, chamadas } = montarBot({
      chatConfigurado: CHAT_AUTORIZADO,
      publicUrl: 'https://radar.meudominio.com/',
    });

    await bot.handleUpdate(updateComTexto(123, '/start'));

    expect(chamadas[0].payload.text).toContain('https://radar.meudominio.com');
    expect(chamadas[0].payload.text).not.toContain('radar.exemplo.com');
  });
});

describe('bot do Telegram — escape de Markdown', () => {
  it('/hoje não quebra com título e empresa cheios de metacaracteres', async () => {
    db.job.findMany.mockResolvedValue([
      {
        title: 'Dev *Sênior* [React] (100%)',
        company: 'Empresa_Com_Underscore',
        location: 'São Paulo - SP',
      },
    ]);

    const { bot, chamadas } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });
    await bot.handleUpdate(updateComTexto(123, '/hoje'));

    expect(chamadas).toHaveLength(1);
    const texto = chamadas[0].payload.text as string;

    // O título de terceiro vai escapado; os asteriscos que restam são os do
    // próprio template (negrito do título e do número).
    expect(texto).toContain(
      '• *Dev \\*Sênior\\* \\[React\\] \\(100%\\)* — Empresa\\_Com\\_Underscore',
    );
    // Nenhum `[` sem escape sobra fora do template.
    expect(texto.replace(/\\\[/g, '')).not.toContain('[');
    expect(texto).toContain('Vagas de hoje (1)');
  });

  it('/top escapa título e empresa do match', async () => {
    db.profile.findFirst.mockResolvedValue({ id: 'perfil-1' });
    db.jobMatch.findMany.mockResolvedValue([
      {
        score: 95,
        job: { title: 'Vaga [Urgente]*', company: 'ACME_Inc' },
      },
    ]);

    const { bot, chamadas } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });
    await bot.handleUpdate(updateComTexto(123, '/top'));

    const texto = chamadas[0].payload.text as string;
    expect(texto).toContain('Vaga \\[Urgente\\]\\*');
    expect(texto).toContain('ACME\\_Inc');
  });

  it('/hoje sem vagas responde o vazio sem chamar o template de lista', async () => {
    db.job.findMany.mockResolvedValue([]);

    const { bot, chamadas } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });
    await bot.handleUpdate(updateComTexto(123, '/hoje'));

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].payload.text).toBe('📭 Nenhuma vaga coletada hoje.');
  });

  it('/stats do chat autorizado continua respondendo', async () => {
    db.job.count.mockResolvedValue(12);
    db.jobMatch.count.mockResolvedValue(7);
    db.application.count.mockResolvedValue(3);
    db.job.groupBy.mockResolvedValue([{ status: 'DONE', _count: 10 }]);

    const { bot, chamadas } = montarBot({ chatConfigurado: CHAT_AUTORIZADO });
    await bot.handleUpdate(updateComTexto(123, '/stats'));

    expect(chamadas).toHaveLength(1);
    const texto = chamadas[0].payload.text as string;
    expect(texto).toContain('Total de vagas: *12*');
    expect(texto).toContain('Prontas: 10');
  });
});
