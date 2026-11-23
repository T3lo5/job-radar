import { describe, expect, it } from 'vitest';
import { languageFormError } from './language-form';

describe('languageFormError', () => {
  it('recusa formulário sem idioma', () => {
    expect(languageFormError({ language: '', level: 'B2' })).toBe('Informe o idioma.');
    expect(languageFormError({ language: '   ', level: 'B2' })).toBe('Informe o idioma.');
  });

  it('recusa nível vazio — o default antigo nunca deve ser enviado', () => {
    expect(languageFormError({ language: 'Inglês', level: '' })).toBe('Selecione um nível.');
  });

  it('recusa o vocabulário antigo vindo de estado legado', () => {
    expect(languageFormError({ language: 'Inglês', level: 'INTERMEDIATE' })).toBe(
      'Selecione um nível.',
    );
  });

  it('aceita CEFR e NATIVE', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE']) {
      expect(languageFormError({ language: 'Inglês', level })).toBeNull();
    }
  });
});
