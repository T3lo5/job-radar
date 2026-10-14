import type { NormalizedJob, RemoteMode } from '@job-radar/shared';
import createDOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

export const REMOTE_MODE_PATTERNS: Array<{ values: string[]; mode: RemoteMode }> = [
  {
    values: [
      'remote',
      'remoto',
      'remota',
      'anywhere',
      'worldwide',
      'work from home',
      'home office',
      'distributed',
      'distributed',
      'teletrabalho',
    ],
    mode: 'remote',
  },
  // Sem acento também: 'hibrido' caía no default e virava on_site.
  { values: ['hybrid', 'híbrido', 'hibrido', 'semi-presencial'], mode: 'hybrid' },
  { values: ['on-site', 'onsite', 'on site', 'presencial', 'no local'], mode: 'on_site' },
];

/** Remove acentos, para casar "hibrido"/"presencial"/"remoto" sem o acento. */
function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function parseRemoteMode(text: string, tags?: string[]): RemoteMode {
  // As tags importam: o RemoteOK marca `tags: ['remote']` e costuma mandar
  // `location` vazio — sem olhar as tags, toda vaga remota dele ficava
  // 'unknown' e dependia só da descrição.
  if (tags?.length) {
    const joined = deaccent(tags.join(' '));
    for (const { values, mode } of REMOTE_MODE_PATTERNS) {
      if (values.some((v) => joined.includes(deaccent(v)))) return mode;
    }
  }

  const lower = deaccent(text ?? '');
  if (lower.trim() !== '' && lower !== 'null') {
    for (const { values, mode } of REMOTE_MODE_PATTERNS) {
      if (values.some((v) => lower.includes(deaccent(v)))) return mode;
    }
  }

  // Sem sinal de modalidade, é 'unknown' — e não 'on_site'. Assumir presencial
  // inventava informação: o filtro de localização e o matching tratam
  // 'unknown' como "não sabemos", que é o truthful.
  return 'unknown';
}

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string | null;
}

/**
 * Converte o número de um texto para Number respeitando o separador decimal.
 *
 * O bug antigo era `replace(/[,.]/g, '')`, que removia vírgula E ponto: em
 * "R$ 8.000,00" virava "800000" — inflating o salário em 100x. Agora decides
 * pelo separador:
 *   "8.000,00" (pt-BR) -> 8000        "8,000.00" (en)  -> 8000
 *   "8,000"             -> 8000        "8.000"          -> 8000
 *   "8.5"               -> 8.5         "50k" -> 50000
 */
function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '');
  const kSuffix = /k$/i.test(cleaned);
  const digits = cleaned.replace(/k$/i, '');

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  const commaCount = (digits.match(/,/g) ?? []).length;
  const dotCount = (digits.match(/\./g) ?? []).length;

  let normalized: string;

  if (commaCount > 0 && dotCount > 0) {
    // Ambos presentes: o último é o decimal, o resto é milhar.
    const decimalPos = Math.max(lastComma, lastDot);
    const intPart = digits.slice(0, decimalPos).replace(/[.,]/g, '');
    const decPart = digits.slice(decimalPos + 1).replace(/[.,]/g, '');
    normalized = decPart ? `${intPart}.${decPart}` : intPart;
  } else if (commaCount === 1 || dotCount === 1) {
    // Um separador só. É separador de milhar quando exatamente 3 dígitos
    // vêm depois dele — o padrão de "8.000"/"80,000". Com 1 ou 2 dígitos é
    // decimal ("12,5"/"12.50").
    const pos = commaCount === 1 ? lastComma : lastDot;
    const digitsAfter = digits.length - pos - 1;
    normalized = digitsAfter === 3 ? digits.replace(/[.,]/g, '') : digits.replace(',', '.');
  } else if (commaCount > 1 || dotCount > 1) {
    // Separador repetido é sempre milhar: "1.000.000".
    normalized = digits.replace(/[.,]/g, '');
  } else {
    normalized = digits;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return NaN;
  return kSuffix ? value * 1000 : value;
}

export function parseSalary(salaryStr?: string): ParsedSalary {
  if (!salaryStr) return { min: null, max: null, currency: null };

  // Faixa: "8.000,00 - 12.000,00", "80k-120k", "45.000 € - 60.000 €".
  // O símbolo da moeda pode vir antes ou entre os dois números.
  const rangeMatch = salaryStr.match(
    /([\d.,]+\s*k?)\s*(?:[\$R£€]+\s*)?(?:[-–—]|\bto\b|\ba\b|\baté\b)\s*(?:[\$R£€]+\s*)?([\d.,]+\s*k?)/i,
  );
  if (rangeMatch) {
    const min = parseAmount(rangeMatch[1]);
    const max = parseAmount(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return {
        min: Math.min(min, max),
        max: Math.max(min, max),
        currency: detectCurrency(salaryStr),
      };
    }
  }

  // Valor único: "R$ 10.000", "Salary: $90,000", "90k". Antes era descartado,
  // o que pierdia a faixa salarial de muitas vagas (comum em Adzuna/Indeed).
  const singleMatch = salaryStr.match(/[\$R£€]?\s*(\d[\d.,]*\s*k?)/i);
  if (singleMatch) {
    const value = parseAmount(singleMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return { min: value, max: null, currency: detectCurrency(salaryStr) };
    }
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
    // Usa location + tags: fontes como RemoteOK marcam a modalidade em
    // `tags` e mandam `location` vazio.
    remote: parseRemoteMode(raw.location ?? '', raw.tags),
    salaryMin: raw.salary ? parseSalary(raw.salary).min : null,
    salaryMax: raw.salary ? parseSalary(raw.salary).max : null,
    salaryCurrency: raw.salary ? parseSalary(raw.salary).currency : null,
    url: raw.url,
    externalId: raw.externalId ?? raw.url,
    publishedAt: raw.publishedAt ?? null,
    tags: raw.tags ?? [],
  };
}
