import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDribbble, parseDribbbleHtml } from './dribbble.js';
import { fetchWithTimeout } from '../utils/http.js';

vi.mock('../utils/http.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

const fetchMock = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>;

const HTML = `
<ul>
  <li class="job-list-item   ">
    <a class="job-link" rel="nofollow" href="/jobs/311924-Graphic-Designer-Print-Brand-Web?source=index"></a>
    <div class="job-details-container">
      <div class="job-title-company-container">
        <div class="job-role ">
          <span class="job-board-job-company">Overseas Media Group</span>
        </div>
        <h4 class="job-title job-board-job-title">Graphic Designer: Print, Brand &amp; Web</h4>
        <div class="job-details job-details--mobile">
          <div class="color-deep-blue-sea-light-40">Remote</div>
        </div>
      </div>
    </div>
  </li>
  <li class="job-list-item   ">
    <a class="job-link" rel="nofollow" href="/jobs/306776-Product-Designer"></a>
    <div class="job-details-container">
      <div class="job-title-company-container">
        <div class="job-role "><span class="job-board-job-company">Acme Inc</span></div>
        <h4 class="job-title job-board-job-title">Product Designer</h4>
      </div>
    </div>
  </li>
</ul>
`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseDribbbleHtml', () => {
  it('extrai título, empresa, local e url de cada card', () => {
    const jobs = parseDribbbleHtml(HTML);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe('Graphic Designer: Print, Brand & Web');
    expect(jobs[0].company).toBe('Overseas Media Group');
    expect(jobs[0].location).toBe('Remote');
    // remove o query string e prefixa o host.
    expect(jobs[0].url).toBe('https://dribbble.com/jobs/311924-Graphic-Designer-Print-Brand-Web');
    expect(jobs[0].jobKey).toBe('311924');
  });
});

describe('fetchDribbble', () => {
  it('mapeia os cards para NormalizedJob', async () => {
    fetchMock.mockResolvedValue(new Response(HTML, { status: 200 }));

    const jobs = await fetchDribbble({ keywords: [], remoteOnly: false });

    expect(jobs).toHaveLength(2);
    expect(jobs[0].tags).toContain('design');
  });

  it('filtra por keyword quando informada', async () => {
    fetchMock.mockResolvedValue(new Response(HTML, { status: 200 }));

    const jobs = await fetchDribbble({ keywords: ['product'], remoteOnly: false });

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Product Designer');
  });

  it('respeita o limite', async () => {
    fetchMock.mockResolvedValue(new Response(HTML, { status: 200 }));

    const jobs = await fetchDribbble({ keywords: [], remoteOnly: false, limit: 1 });

    expect(jobs).toHaveLength(1);
  });

  it('devolve lista vazia em erro HTTP sem estourar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response('erro', { status: 500 }));

    await expect(fetchDribbble({ keywords: [], remoteOnly: false })).resolves.toEqual([]);

    warn.mockRestore();
  });
});
