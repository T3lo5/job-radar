/**
 * Detecção e redação de dados sensíveis em currículos.
 *
 * Baseado no guia ATS: "Corte CPF, RG, foto, estado civil, data de
 * nascimento, endereço completo". Dados pessoais expõem o candidato a
 * fraude e não ajudam na seleção.
 *
 * Duas responsabilidades:
 * 1. `detect()` — encontra dados sensíveis (para alertar o usuário no upload).
 * 2. `redact()` — substitui por placeholders estáveis ANTES de qualquer
 *    chamada de IA, para que CPF/RG/telefone/e-mail/endereço nunca saiam do
 *    ambiente do usuário.
 */

export interface SensitiveDataIssue {
  type:
    | 'cpf'
    | 'rg'
    | 'passport'
    | 'birthdate'
    | 'address'
    | 'marital_status'
    | 'phone'
    | 'email'
    | 'photo';
  severity: 'warning';
  match: string;
  message: string;
}

export interface SensitiveDataReport {
  issues: SensitiveDataIssue[];
  safeToApply: boolean;
}

/** Placeholders estáveis (mesmo valor toda vez, para diffs reproduzíveis). */
const PLACEHOLDERS: Record<string, string> = {
  cpf: '[CPF]',
  rg: '[RG]',
  passport: '[PASSAPORTE]',
  birthdate: '[DATA_NASCIMENTO]',
  address: '[ENDERECO]',
  marital_status: '[ESTADO_CIVIL]',
  phone: '[TELEFONE]',
  email: '[EMAIL]',
  photo: '[FOTO]',
};

function cpfCheckDigitsValid(digits: string): boolean {
  if (digits.length !== 11) return false;
  // Todos os dígitos iguais (ex: 111.111.111-11) não é CPF válido.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (nums: number[], factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < nums.length; i++) {
      sum += nums[i] * (factorStart - i);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const nums = digits.split('').map(Number);
  const d1 = calcDigit(nums.slice(0, 9), 10);
  const d2 = calcDigit(nums.slice(0, 10), 11);
  return nums[9] === d1 && nums[10] === d2;
}

/** Extrai apenas dígitos de uma string. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

const PATTERNS: Array<{
  type: SensitiveDataIssue['type'];
  regex: RegExp;
  message: string;
  /** Quando true, o match só conta se passar numa validação extra (ex: CPF). */
  validate?: (match: string) => boolean;
}> = [
  {
    type: 'cpf',
    // CPF com máscara (111.111.111-11) ou 11 dígitos seguidos.
    regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g,
    message:
      'CPF detectado. Para vagas internacionais, corte — não é necessário e expõe você a fraude.',
    validate: (match) => cpfCheckDigitsValid(onlyDigits(match)),
  },
  {
    type: 'phone',
    regex: /\+?\d[\d\s().-]{7,}\d/g,
    message: 'Telefone detectado. Corte para evitar exposição de contato pessoal.',
  },
  {
    type: 'rg',
    regex: /\b(?:RG|r\.g\.)[:\s]*\d{1,2}\.\d{3}\.\d{3}-[\dX]\b/gi,
    message: 'RG detectado. Corte para vagas internacionais.',
  },
  {
    type: 'passport',
    regex: /\b(?:Passaporte|Passport|PP)\b[:\s]*[A-Z0-9]{6,9}\b/g,
    message: 'Número de passaporte detectado. Corte.',
  },
  {
    type: 'birthdate',
    regex:
      /\b(?:data de nascimento|birth date|born|nascido em|n\.?s\.?)[:\s]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    message: 'Data de nascimento detectada. Idade não é um critério de seleção legal.',
  },
  {
    type: 'address',
    regex:
      /\b(?:rua|avenida|av\.?|estrada|rodovia|praça|pça\.?|alameda)\s+\w+(?:\s+\w+){0,3}[,.\s]+\d{1,5}(?:\s*-\s*\d{1,5})?\s*(?:,?\s*\w+\s*(?:-\s*)?\w+\s*(?:-\s*)?\w+\s*)?(?:,\s*\w{2}\s*-\s*\w{2}\s*)?(?:,\s*CEP[:\s]*\d{5}-\d{4}|,\s*\d{5}-\d{4})?\b/gi,
    message: 'Endereço completo detectado. Use apenas cidade e país (ex: "São Paulo, Brazil").',
  },
  {
    type: 'marital_status',
    regex: /\b(?:solteir[oa]|casad[oa]|viúv[oa]|separad[oa]|unid[oa] de fato)\b/gi,
    message: 'Estado civil detectado. Não é um critério de seleção — corte.',
  },
  {
    type: 'photo',
    regex: /\b(?:foto|photo|retrato|headshot)\b/gi,
    message:
      'Referência a foto detectada. Muitos ATS e recrutadores internacionais pedem currículo sem foto.',
  },
  {
    type: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    message: 'E-mail pessoal detectado. Corte para evitar exposição de contato.',
  },
];

export class SensitiveDataDetector {
  check(text: string): SensitiveDataReport {
    const issues: SensitiveDataIssue[] = [];
    const seen = new Set<string>();

    for (const { type, regex, message, validate } of PATTERNS) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        const raw = match[0];
        if (validate && !validate(raw)) continue; // ex: 11 dígitos que não são CPF (celular)
        const key = `${type}:${raw}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({ type, severity: 'warning', match: raw, message });
      }
    }

    return {
      issues,
      safeToApply: issues.length === 0,
    };
  }

  /**
   * Redige dados sensíveis substituindo por placeholders estáveis.
   * Usado ANTES de enviar texto para qualquer provedor de IA.
   */
  redact(text: string): { redactedText: string; issues: SensitiveDataIssue[] } {
    const report = this.check(text);
    let redacted = text;

    // Substitua do mais longo para o mais curto para evitar substituições parciais.
    const sorted = [...report.issues].sort((a, b) => b.match.length - a.match.length);
    for (const issue of sorted) {
      const placeholder = PLACEHOLDERS[issue.type];
      redacted = redacted.split(issue.match).join(placeholder);
    }

    return { redactedText: redacted, issues: report.issues };
  }
}

export const sensitiveDataDetector = new SensitiveDataDetector();
