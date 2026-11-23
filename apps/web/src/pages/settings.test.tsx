import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from './settings';
import { aiProvidersApi, settingsApi, adminApi } from '../services/api';

vi.mock('../services/api', () => ({
  aiProvidersApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    test: vi.fn(),
  },
  setupApi: {
    saveCron: vi.fn(),
    testConnection: vi.fn(),
  },
  settingsApi: {
    getScope: vi.fn(),
    set: vi.fn(),
  },
  adminApi: {
    apifyToken: {
      status: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    },
    adzunaCredentials: {
      status: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    },
    collectNow: vi.fn(),
    processAll: vi.fn(),
    getSources: vi.fn(),
    toggleSource: vi.fn(),
  },
  authApi: {
    me: vi.fn(),
    sessions: vi.fn(),
    revokeSession: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const renderWithProviders = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('SettingsPage — renderização estática', () => {
  it('renderiza o cabeçalho e as abas principais', () => {
    vi.mocked(aiProvidersApi.list).mockResolvedValue({ providers: [] });
    vi.mocked(settingsApi.getScope).mockResolvedValue({ scope: 'cron', settings: {} });
    vi.mocked(adminApi.getSources).mockResolvedValue({ sources: [] });

    const html = renderWithProviders(<SettingsPage />);

    expect(html).toContain('Configurações');
    expect(html).toContain('IA');
    expect(html).toContain('Fontes');
    expect(html).toContain('Cron');
    expect(html).toContain('Conta');
  });

  it('renderiza o conteúdo da aba IA sem quebrar', () => {
    vi.mocked(aiProvidersApi.list).mockResolvedValue({ providers: [] });

    const html = renderWithProviders(<SettingsPage />);

    // Apenas verifica que não quebra a renderização
    expect(html).toContain('Configurações');
    expect(html).toContain('IA');
  });
});
