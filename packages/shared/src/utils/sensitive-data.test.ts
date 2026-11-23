import { describe, it, expect } from 'vitest';
import { sensitiveDataDetector } from './sensitive-data.js';

describe('sensitiveDataDetector — CPF com dígitos verificadores', () => {
  it('CPF válido com máscara é detectado', () => {
    const report = sensitiveDataDetector.check('Meu CPF é 111.444.777-35');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    expect(cpfs.length).toBe(1);
    expect(cpfs[0].match).toBe('111.444.777-35');
  });

  it('CPF válido sem máscara é detectado', () => {
    const report = sensitiveDataDetector.check('CPF 11144477735');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    expect(cpfs.length).toBe(1);
  });

  it('CPF inválido (dígitos verificadores errados) não é detectado como CPF', () => {
    const report = sensitiveDataDetector.check('CPF 111.444.777-00');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    expect(cpfs.length).toBe(0);
  });

  it('Todos os dígitos iguais não é CPF válido', () => {
    const report = sensitiveDataDetector.check('111.111.111-11');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    expect(cpfs.length).toBe(0);
  });

  it('Celular de 11 dígitos NÃO é marcado como CPF válido', () => {
    // (11) 99999-9999 = 11 dígitos, mas não passa na validação de CPF
    const report = sensitiveDataDetector.check('Meu telefone é 11999999999');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    const phones = report.issues.filter((i) => i.type === 'phone');
    expect(cpfs.length).toBe(0);
    // O celular pode ser detectado como phone (pattern geral)
    expect(phones.length).toBeGreaterThanOrEqual(0);
  });

  it('Celular com formato (11) 99999-9999 não é CPF', () => {
    const report = sensitiveDataDetector.check('Fone: (11) 99999-9999');
    const cpfs = report.issues.filter((i) => i.type === 'cpf');
    expect(cpfs.length).toBe(0);
  });
});

describe('sensitiveDataDetector — redação', () => {
  it('substitui CPF por placeholder estável', () => {
    const { redactedText, issues } = sensitiveDataDetector.redact(
      'CPF: 111.444.777-35. Nome: João.',
    );
    expect(redactedText).toContain('[CPF]');
    expect(redactedText).not.toContain('111.444.777-35');
    expect(issues.some((i) => i.type === 'cpf')).toBe(true);
  });

  it('substitui e-mail por placeholder', () => {
    const { redactedText } = sensitiveDataDetector.redact('Contato: joao.silva@email.com');
    expect(redactedText).toContain('[EMAIL]');
    expect(redactedText).not.toContain('joao.silva@email.com');
  });

  it('redação é estável (mesmo input = mesmo output)', () => {
    const texto = 'CPF 11144477735 e telefone 11999999999';
    const a = sensitiveDataDetector.redact(texto);
    const b = sensitiveDataDetector.redact(texto);
    expect(a.redactedText).toBe(b.redactedText);
  });

  it('texto sem dados sensíveis não muda', () => {
    const texto = 'Experiência em React e TypeScript. Remoto, CLT.';
    const { redactedText, issues } = sensitiveDataDetector.redact(texto);
    expect(redactedText).toBe(texto);
    expect(issues.length).toBe(0);
  });
});
