import { isLanguageLevel } from '@job-radar/shared';

export interface LanguageFormValues {
  language: string;
  level: string;
}

/**
 * Validação do formulário de idioma.
 *
 * Fica fora do componente para poder ser testada sem Testing Library: o bug do
 * ticket 13 era justamente o formulário enviar um nível default que o usuário
 * nunca escolheu.
 */
export function languageFormError(form: LanguageFormValues): string | null {
  if (!form.language.trim()) return 'Informe o idioma.';
  if (!isLanguageLevel(form.level)) return 'Selecione um nível.';
  return null;
}
