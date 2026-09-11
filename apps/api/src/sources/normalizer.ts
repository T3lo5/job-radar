import type { NormalizedJob, RemoteMode } from '@job-radar/shared';
import createDOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export const REMOTE_MODE_PATTERNS: Array<{ values: string[]; mode: RemoteMode }> = [
  {
    values: ['remote', 'remoto', '100% remoto', 'anywhere', 'worldwide', 'work from home'],
    mode: 'remote',
  },
  { values: ['hybrid', 'híbrido'], mode: 'hybrid' },
  { values: ['on-site', 'onsite', 'presencial'], mode: 'on_site' },
];

export function parseRemoteMode(text: string): RemoteMode {
  const lower = text.toLowerCase();
  for (const { values, mode } of REMOTE_MODE_PATTERNS) {
    if (values.some((v) => lower.includes(v))) return mode;
  }
  if (lower && lower !== 'null' && lower.trim() !== '') return 'on_site';
  return 'unknown';
}

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

export function parseSalary(salaryStr?: string): ParsedSalary {
  if (!salaryStr) return { min: null, max: null, currency: null };

  const match = salaryStr.match(/[\$R£€]?\s*([\d.,]+)\s*[-–]\s*[\$R£€]?\s*([\d.,]+)/);
  if (match) {
    const min = Number(match[1].replace(/[,.]/g, ''));
    const max = Number(match[2].replace(/[,.]/g, ''));
    const currency = detectCurrency(salaryStr);
    return { min, max, currency };
  }

  return { min: null, max: null, currency: null };
}

function detectCurrency(text: string): string | null {
  if (text.includes('R$')) return 'BRL';
  if (text.includes('€')) return 'EUR';
  if (text.includes('£')) return 'GBP';
  return 'USD';
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;

  const now = new Date();

  const dayMatch = dateStr.match(/(\d+)\s*(day|dia)s?\s*ago/i);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  const hourMatch = dateStr.match(/(\d+)\s*(hour|hora)s?\s*ago/i);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }

  if (dateStr.toLowerCase().includes('just posted') || dateStr.toLowerCase().includes('hoje')) {
    return now;
  }

  return null;
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'a',
      'span',
      'div',
      'blockquote',
      'code',
      'pre',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['on*', 'style', 'onclick', 'onload', 'onerror', 'onmouseover'],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function normalizeJobFields(raw: {
  title: string;
  company: string;
  description: string;
  location: string | null;
  salary?: string;
  url: string;
  externalId?: string;
  publishedAt?: Date | null;
  tags?: string[];
}): NormalizedJob {
  return {
    title: raw.title.trim(),
    company: raw.company.trim(),
    description: sanitizeHtml(raw.description),
    location: raw.location || null,
    remote: raw.location ? parseRemoteMode(raw.location) : 'unknown',
    salaryMin: raw.salary ? parseSalary(raw.salary).min : null,
    salaryMax: raw.salary ? parseSalary(raw.salary).max : null,
    salaryCurrency: raw.salary ? parseSalary(raw.salary).currency : null,
    url: raw.url,
    externalId: raw.externalId ?? raw.url,
    publishedAt: raw.publishedAt ?? null,
    tags: raw.tags ?? [],
  };
}
