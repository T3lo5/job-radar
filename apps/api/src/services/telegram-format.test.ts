import { describe, expect, it, vi } from 'vitest';
import {
  buildStartMessage,
  createChatGuard,
  escapeMarkdown,
  isChatAuthorized,
  resolveDashboardUrl,
} from './telegram-format.js';

describe('isChatAuthorized', () => {
  it('autoriza somente o chat configurado', () => {
    expect(isChatAuthorized(123, '123')).toBe(true);
    expect(isChatAuthorized('123', ' 123 ')).toBe(true);
    expect(isChatAuthorized(999, '123')).toBe(false);
  });

  it('sem chat configurado, ninguém entra', () => {
    // Era o furo: o primeiro /start salvava o próprio id e virava o dono.
    expect(isChatAuthorized(123, null)).toBe(false);
    expect(isChatAuthorized(123, '')).toBe(false);
    expect(isChatAuthorized(undefined, '123')).toBe(false);
  });
});

describe('createChatGuard', () => {
  it('chat desconhecido é ignorado: next não roda', async () => {
    const next = vi.fn();
    const guard = createChatGuard(async () => '123');

    await guard({ chat: { id: 999 } }, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('chat autorizado segue o fluxo', async () => {
    const next = vi.fn();
    const guard = createChatGuard(async () => '123');

    await guard({ chat: { id: 123 } }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sem chat configurado, /start não passa nem para o próprio chat', async () => {
    const next = vi.fn();
    const guard = createChatGuard(async () => null);

    await guard({ chat: { id: 123 } }, next);

    expect(next).not.toHaveBeenCalled();
  });
});

describe('escapeMarkdown', () => {
  it('neutraliza os caracteres de formatação', () => {
    const hostil = 'Vaga *urgente* _agora_ [clique](http://x) `código`';
    const saida = escapeMarkdown(hostil);

    for (const char of ['*', '_', '[', ']', '`']) {
      expect(saida).toContain(`\\${char}`);
    }
    // Nenhum asterisco sobra sem escape.
    expect(saida.replace(/\\\*/g, '')).not.toContain('*');
  });

  it('texto normal passa igual', () => {
    expect(escapeMarkdown('Engenheira de Software')).toBe('Engenheira de Software');
  });

  it('título adversarial não quebra a mensagem', () => {
    // O caso do ticket: parênteses/colchetes e asteriscos no título.
    const titulo = 'Dev [Sênior] (React*)';
    expect(escapeMarkdown(titulo)).toBe('Dev \\[Sênior\\] \\(React\\*\\)');
  });

  it('escapa a URL dentro do link Markdown', () => {
    const url = 'https://x.test/vaga_(1)';
    expect(escapeMarkdown(url)).toContain('\\(');
    expect(escapeMarkdown(url)).toContain('\\)');
  });
});

describe('resolveDashboardUrl', () => {
  it('prefere a URL configurada e remove barra final', () => {
    expect(resolveDashboardUrl('https://radar.exemplo.com/', 'http://host')).toBe(
      'https://radar.exemplo.com',
    );
  });

  it('cai para o próximo candidato', () => {
    expect(resolveDashboardUrl('', null, 'http://host/')).toBe('http://host');
  });

  it('sem configuração, devolve null (não inventa localhost)', () => {
    expect(resolveDashboardUrl(undefined, '  ')).toBeNull();
  });
});

describe('buildStartMessage', () => {
  it('inclui a URL pública configurada', () => {
    const msg = buildStartMessage('https://radar.exemplo.com');
    expect(msg).toContain('Dashboard: https://radar.exemplo.com');
    expect(msg).not.toContain('localhost');
  });

  it('sem URL, omite o link em vez de apontar para localhost', () => {
    const msg = buildStartMessage(null);
    expect(msg).not.toContain('localhost');
    expect(msg).not.toContain('Dashboard:');
  });
});
