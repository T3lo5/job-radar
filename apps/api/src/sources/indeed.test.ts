import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchIndeed } from './indeed.js';
import { fetchWithTimeout } from '../utils/http.js';

// A fonte é rede; o que se testa aqui é a URL que montamos — foi exatamente
// ela que quebrou (`/vagas` não existe no Indeed, tudo respondia 404).
vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

function htmlVazio(): Response {
  return new Response('<html><body>sem vagas</body></html>', { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(htmlVazio());
});

describe('fetchIndeed — URLs de busca', () => {
  it('usa /jobs no Brasil, nunca /vagas', async () => {
    // Regressão: INDEED_BRAZIL_SEARCH era `br.indeed.com/vagas`, que dá 404
    // em qualquer busca — o caminho de busca do Indeed é `/jobs`.
    await fetchIndeed({ keywords: ['react'], remoteOnly: false });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.hostname).toBe('br.indeed.com');
    expect(url.pathname).toBe('/jobs');
    expect(url.searchParams.get('q')).toBe('react');
    expect(url.searchParams.get('l')).toBe('Brazil');
  });

  it('usa o domínio global quando é só remoto', async () => {
    await fetchIndeed({ keywords: ['react'], remoteOnly: true });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.hostname).toBe('www.indeed.com');
    expect(url.pathname).toBe('/jobs');
    expect(url.searchParams.get('l')).toBeNull();
  });

  it('repasa o erro HTTP com o status (para o painel mostrar)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bloqueado', { status: 403 }));

    // O 403 do bot-protection do Indeed NÃO é bug nosso — mas a mensagem
    // precisa carregar o status para o painel dizer o que houve.
    await expect(fetchIndeed({ keywords: ['react'], remoteOnly: false })).rejects.toThrow('403');
  });

  it('devolve lista vazia quando o HTML não tem vaga (sem estourar)', async () => {
    const vagas = await fetchIndeed({ keywords: ['react'], remoteOnly: false });
    expect(vagas).toEqual([]);
  });
});
