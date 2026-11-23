import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLinkedInJobs, resolveApifyBaseUrl } from './linkedin-apify.js';
import { fetchWithTimeout } from '../utils/http.js';

/**
 * Ticket 27: o token do Apify ia na query string (`?token=...`) e o `baseUrl`
 * vinha do settings sem allowlist — qualquer host recebia o token.
 */

const estado = vi.hoisted(() => ({
  token: 'segredo-apify' as string | null,
  baseUrl: null as string | null,
}));

vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../services/settings-service.js', () => ({
  settingsService: {
    get: vi.fn(async (_scope: string, key: string) => {
      if (key === 'token') return estado.token;
      if (key === 'baseUrl') return estado.baseUrl;
      return null;
    }),
  },
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

const ITEM = {
  title: 'Pessoa Desenvolvedora',
  company: 'ACME',
  location: 'São Paulo',
  linkedinJobId: '42',
  url: 'https://www.linkedin.com/jobs/view/42',
  datePosted: '2026-10-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  estado.token = 'segredo-apify';
  estado.baseUrl = null;
  fetchMock.mockResolvedValue(new Response(JSON.stringify([ITEM]), { status: 200 }));
});

describe('fetchLinkedInJobs — token e destino', () => {
  it('manda o token no header Authorization, nunca na URL', async () => {
    await fetchLinkedInJobs({ keywords: ['react'], remoteOnly: false });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).not.toContain('token');
    expect(url).not.toContain('segredo-apify');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer segredo-apify');
  });

  it('aceita outro ator no host permitido e descarta query da configuração', async () => {
    estado.baseUrl =
      'https://api.apify.com/v2/acts/outro~ator/run-sync-get-dataset-items?token=vazado';

    await fetchLinkedInJobs({ keywords: ['react'], remoteOnly: false });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe('https://api.apify.com/v2/acts/outro~ator/run-sync-get-dataset-items');
    expect(url).not.toContain('token');
  });

  it('recusa host fora da allowlist sem fazer a requisição', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    estado.baseUrl = 'https://atacante.example.com/coletar';

    await expect(fetchLinkedInJobs({ keywords: ['react'], remoteOnly: false })).resolves.toEqual(
      [],
    );

    expect(fetchMock).not.toHaveBeenCalled();
    // A mensagem não ecoa a URL configurada: ela pode conter token colado.
    expect(warn).toHaveBeenCalledWith(expect.not.stringContaining('atacante.example.com'));

    warn.mockRestore();
  });

  it('recusa http:// mesmo no host permitido', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    estado.baseUrl = 'http://api.apify.com/v2/acts/outro~ator/run';

    await expect(fetchLinkedInJobs({ keywords: ['react'], remoteOnly: false })).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it('sem token configurado, não faz requisição', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    estado.token = null;

    await expect(fetchLinkedInJobs({ keywords: ['react'], remoteOnly: false })).resolves.toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe('resolveApifyBaseUrl', () => {
  it('usa o ator padrão quando não há configuração', () => {
    expect(resolveApifyBaseUrl(null)).toContain('api.apify.com');
  });

  it('rejeita URL inválida, host estranho e credenciais embutidas', () => {
    expect(resolveApifyBaseUrl('nao-e-url')).toBeNull();
    expect(resolveApifyBaseUrl('https://example.com/ator')).toBeNull();
    expect(resolveApifyBaseUrl('https://user:senha@api.apify.com/v2/acts/x/run')).toBeNull();
  });
});
