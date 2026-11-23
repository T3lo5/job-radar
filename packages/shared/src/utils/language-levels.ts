/**
 * Níveis de idioma no vocabulário CEFR.
 *
 * A UI já oferecia `A1..C2`, mas a API validava `BASIC/INTERMEDIATE/...` —
 * adicionar idioma retornava 400 e, sem tocar no select, o perfil gravava
 * `INTERMEDIATE`, exibido cru na tela. Aqui está a fonte única usada pela
 * validação da API e pelo select do perfil.
 *
 * `NATIVE` fica fora do CEFR de propósito: é a informação que o CEFR não
 * expressa (idioma nativo).
 */
export const LANGUAGE_LEVEL_CODES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'] as const;

export type LanguageLevelCode = (typeof LANGUAGE_LEVEL_CODES)[number];

export interface LanguageLevel {
  code: LanguageLevelCode;
  /** Texto do select; o perfil exibe só o código (ex.: "Inglês (B2)"). */
  label: string;
}

export const LANGUAGE_LEVELS: LanguageLevel[] = [
  { code: 'A1', label: 'A1 — Iniciante' },
  { code: 'A2', label: 'A2 — Básico' },
  { code: 'B1', label: 'B1 — Intermediário' },
  { code: 'B2', label: 'B2 — Intermediário avançado' },
  { code: 'C1', label: 'C1 — Avançado' },
  { code: 'C2', label: 'C2 — Proficiente' },
  { code: 'NATIVE', label: 'Nativo' },
];

export function isLanguageLevel(value: unknown): value is LanguageLevelCode {
  return typeof value === 'string' && (LANGUAGE_LEVEL_CODES as readonly string[]).includes(value);
}

/**
 * Tradução defensiva do vocabulário antigo. A migration converte o banco, mas
 * uma resposta em cache/aba antiga não pode exibir "INTERMEDIATE" na tela.
 */
const LEGACY_LEVELS: Record<string, LanguageLevelCode> = {
  BASIC: 'A2',
  INTERMEDIATE: 'B1',
  ADVANCED: 'C1',
  FLUENT: 'C1',
};

export function levelLabel(code: string): string {
  // No perfil o nível aparece como "Inglês (B2)". NATIVE não é um código CEFR,
  // então vira a palavra que o usuário entende.
  if (code === 'NATIVE') return 'Nativo';
  if (LEGACY_LEVELS[code]) return LEGACY_LEVELS[code];
  return LANGUAGE_LEVELS.find((l) => l.code === code)?.code ?? code;
}
