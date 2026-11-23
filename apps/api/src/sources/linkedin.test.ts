import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLinkedIn } from './linkedin.js';
import { fetchWithTimeout } from '../utils/http.js';

// O que se testa aqui é a URL de busca. Foi ela que quebrou: os termos eram
// juntados com `join('%20')` e concatenados crus, então `&` virava separador de
// parâmetro e acento ia sem codificar.
vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // HTML sem cards: a primeira página encerra o loop.
  fetchMock.mockResolvedValue(new Response('<html><body></body></html>', { status: 200 }));
});

describe('fetchLinkedIn — URL de busca', () => {
  it('preserva termos com &, # e acento', async () => {
    await fetchLinkedIn({ keywords: ['desenvolvedor', 'react & node', 'c#', 'São Paulo'] });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('keywords')).toBe('desenvolvedor react & node c# São Paulo');
    expect(url.searchParams.get('location')).toBe('Brazil');
    expect(url.searchParams.get('start')).toBe('0');
    // `#` não pode truncar a URL num fragmento.
    expect(url.hash).toBe('');
  });

  it('não injeta parâmetro a partir do termo digitado', async () => {
    await fetchLinkedIn({ keywords: ['react&location=Ukraine'] });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('keywords')).toBe('react&location=Ukraine');
    expect(url.searchParams.get('location')).toBe('Brazil');
    expect([...url.searchParams.keys()].sort()).toEqual(['keywords', 'location', 'start']);
  });

  it('usa remote como localização quando a busca é só remota', async () => {
    await fetchLinkedIn({ keywords: ['react'], remoteOnly: true });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('location')).toBe('remote');
  });
});
