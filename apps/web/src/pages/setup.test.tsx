import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { SetupPage } from './setup';
import { authApi } from '../services/api';

vi.mock('../services/api', () => ({
  setupApi: {
    getStatus: vi.fn(),
    saveAI: vi.fn(),
    saveTelegram: vi.fn(),
    saveCron: vi.fn(),
    complete: vi.fn(),
    testConnection: vi.fn(),
  },
  authApi: {
    status: vi.fn(),
    setup: vi.fn(),
  },
  aiProvidersApi: {
    create: vi.fn(),
  },
  profileApi: {
    update: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SetupPage — renderização estática', () => {
  it('renderiza o passo Conta com inputs de email e senha', () => {
    vi.mocked(authApi.status).mockResolvedValue({
      accountExists: false,
      setupComplete: false,
      needsSetup: true,
      allowSignup: true,
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/setup']}>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(html).toContain('Configuração Inicial');
    expect(html).toContain('Conta');
    expect(html).toContain('email');
    expect(html).toContain('senha');
    expect(html).toContain('Criar conta');
  });

  it('renderiza o botão Voltar desabilitado no passo 0', () => {
    vi.mocked(authApi.status).mockResolvedValue({
      accountExists: false,
      setupComplete: false,
      needsSetup: true,
      allowSignup: true,
    });

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/setup']}>
        <SetupPage />
      </MemoryRouter>,
    );

    expect(html).toContain('Voltar');
  });
});
