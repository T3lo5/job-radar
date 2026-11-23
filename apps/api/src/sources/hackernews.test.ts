import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchHackerNews } from './hackernews.js';
import { fetchWithTimeout } from '../utils/http.js';

vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

const RESPOSTA = {
  hits: [
    {
      objectID: '50608390',
      title: 'CollectWise (YC F24) Is Hiring a Founding Engineer',
      url: 'https://www.ycombinator.com/companies/collectwise/jobs/abc',
      author: 'obrien',
      created_at: '2026-11-23T07:01:08Z',
      job_text: null,
    },
    {
      objectID: '50593679',
      title: 'Tasklet Is Hiring',
      url: null,
      author: 'mayop100',
      created_at: '2026-11-21T21:11:08Z',
      job_text: '<p>Role details</p>',
    },
    {
      objectID: 'no-title',
      title: '',
      author: 'ghost',
    },
  ],
  nbHits: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchHackerNews', () => {
  it('mapeia hits para NormalizedJob e infere empresa do título', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(RESPOSTA), { status: 200 }));

    const jobs = await fetchHackerNews({ keywords: ['react'], remoteOnly: false });

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe('CollectWise (YC F24) Is Hiring a Founding Engineer');
    expect(jobs[0].company).toBe('CollectWise');
    expect(jobs[0].url).toBe('https://www.ycombinator.com/companies/collectwise/jobs/abc');
    expect(jobs[0].externalId).toBe('50608390');
  });

  it('cai no link do item do HN quando a hit não tem url', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(RESPOSTA), { status: 200 }));

    const jobs = await fetchHackerNews({ keywords: [], remoteOnly: false });

    expect(jobs[1].url).toBe('https://news.ycombinator.com/item?id=50593679');
    expect(jobs[1].company).toBe('Tasklet');
  });

  it('consulta a API pública do Algolia com tags=job', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ hits: [] }), { status: 200 }));

    await fetchHackerNews({ keywords: ['react', 'node'], remoteOnly: false, limit: 10 });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v1/search_by_date');
    expect(url.searchParams.get('tags')).toBe('job');
    expect(url.searchParams.get('query')).toBe('react node');
    expect(url.searchParams.get('hitsPerPage')).toBe('10');
  });

  it('devolve lista vazia em erro HTTP sem estourar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('erro', { status: 500 }));

    await expect(fetchHackerNews({ keywords: [], remoteOnly: false })).resolves.toEqual([]);

    warn.mockRestore();
  });
});
