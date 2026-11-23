import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeMarkdown } from './telegram-format.js';
import { sendDailyReport } from './daily-report.js';

/**
 * Ticket 22: o relatório diário também embute título/empresa/location de
 * terceiros em Markdown. Um `*` solto faz o Telegram devolver 400 e o relatório
 * inteiro não sai — ou pior, o texto da vaga passa a controlar a formatação.
 */

const db = vi.hoisted(() => ({
  job: { count: vi.fn() },
  jobMatch: { findMany: vi.fn() },
  application: { findMany: vi.fn() },
  notification: { create: vi.fn() },
}));

const telegram = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../db/prisma.js', () => ({ prisma: db }));
vi.mock('./notifications.js', () => ({ telegramChannel: telegram }));

beforeEach(() => {
  vi.clearAllMocks();
  db.job.count.mockResolvedValue(3);
  db.jobMatch.findMany.mockResolvedValue([]);
  db.application.findMany.mockResolvedValue([]);
  db.notification.create.mockResolvedValue({});
  telegram.send.mockResolvedValue({ success: true, messageId: 1 });
});

describe('sendDailyReport', () => {
  it('escapa título, empresa, localização e URL da vaga', async () => {
    db.jobMatch.findMany.mockResolvedValue([
      {
        score: 92,
        job: {
          title: 'Dev [Sênior] (React*)',
          company: 'ACME_Inc',
          location: 'São Paulo - SP',
          salaryMin: 10000,
          salaryMax: 15000,
          url: 'https://x.test/vaga_(1)*',
        },
      },
    ]);

    const result = await sendDailyReport();

    expect(result.success).toBe(true);
    const texto = telegram.send.mock.calls[0][0].text as string;

    expect(texto).toContain(escapeMarkdown('Dev [Sênior] (React*)'));
    expect(texto).toContain(escapeMarkdown('ACME_Inc'));
    expect(texto).toContain(escapeMarkdown('https://x.test/vaga_(1)*'));

    // Os trechos crus não sobrevivem: `[Sênior]*` sem escape quebraria o
    // Markdown e o Telegram rejeitaria a mensagem inteira.
    expect(texto).not.toContain('[Sênior]');
    expect(texto).not.toContain('ACME_Inc');
  });

  it('envia o relatório vazio sem lista de vagas', async () => {
    const result = await sendDailyReport();

    expect(result.success).toBe(true);
    const texto = telegram.send.mock.calls[0][0].text as string;
    expect(texto).toContain('Nenhuma vaga avaliada hoje');
    expect(texto).toContain('Vagas encontradas: *3*');
  });

  it('registra a falha do canal em vez de dar sucesso', async () => {
    telegram.send.mockResolvedValue({ success: false, error: 'chat not found' });

    const result = await sendDailyReport();

    expect(result).toEqual({ success: false, error: 'chat not found' });
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});
