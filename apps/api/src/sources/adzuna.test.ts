import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdzuna } from './adzuna.js';
import { fetchWithTimeout } from '../utils/http.js';

// Fixture da resposta real da Adzuna: a API manda `salary_min`/`salary_max`
// como números soltos, sem símbolo de moeda.
vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

// Sem settings gravados: as credenciais vêm do env (abaixo).
vi.mock('../services/settings-service.js', () => ({
  settingsService: { get: vi.fn(async () => null) },
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

const RESPOSTA = {
  count: 1,
  results: [
    {
      id: '123',
      title: 'Pessoa Desenvolvedora Full Stack',
      company: { display_name: 'ACME' },
      location: { area: ['Brasil', 'São Paulo', 'São Paulo'] },
      description: '<p>Vaga</p>',
      salary_min: 8000,
      salary_max: 12000,
      redirect_url: 'https://www.adzuna.com.br/details/123',
      created: '2026-10-01T00:00:00Z',
      category: { label: 'IT Jobs' },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADZUNA_APP_ID = 'app-id';
  process.env.ADZUNA_APP_KEY = 'app-key';
});

describe('fetchAdzuna', () => {
  it('grava salário de vaga brasileira em BRL', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(RESPOSTA), { status: 200 }));

    const [job] = await fetchAdzuna({ keywords: ['react'], remoteOnly: false });

    expect(job.salaryMin).toBe(8000);
    expect(job.salaryMax).toBe(12000);
    // Regressão: sem `currency`, o parser caía em USD.
    expect(job.salaryCurrency).toBe('BRL');
    expect(job.location).toBe('Brasil, São Paulo, São Paulo');
  });

  it('consulta o país br com os termos e a localização', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(RESPOSTA), { status: 200 }));

    await fetchAdzuna({ keywords: ['react', 'node'], remoteOnly: false, location: 'Campinas' });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/v1/api/jobs/br/search/1');
    expect(url.searchParams.get('what')).toBe('react node');
    expect(url.searchParams.get('where')).toBe('Campinas');
  });

  it('devolve lista vazia em erro HTTP sem estourar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('erro', { status: 500 }));

    await expect(fetchAdzuna({ keywords: ['react'], remoteOnly: false })).resolves.toEqual([]);

    warn.mockRestore();
  });
});
