import { describe, it, expect } from 'vitest';
import { pricingFor, estimateCostUsd, isKnownModel } from './pricing.js';

describe('pricingFor', () => {
  it('escolhe o prefixo mais longo (mini nao cai no modelo cheio)', () => {
    expect(pricingFor('gpt-4o-mini')).toEqual({
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
    });
    expect(pricingFor('gpt-4o')).toEqual({ inputPerMillion: 2.5, outputPerMillion: 10 });
  });

  it('distingue claude haiku de sonnet', () => {
    expect(pricingFor('claude-3-5-haiku-20241022').inputPerMillion).toBeLessThan(
      pricingFor('claude-3-5-sonnet-20241022').inputPerMillion,
    );
  });

  it('cobra zero de modelo local', () => {
    for (const local of ['ollama/llama3.2', 'llama3.1', 'mistral-small', 'qwen2.5-coder']) {
      expect(pricingFor(local)).toEqual({ inputPerMillion: 0, outputPerMillion: 0 });
    }
  });

  it('usa o padrao conservador para modelo desconhecido', () => {
    expect(pricingFor('modelo-que-nao-existe-2027')).toEqual({
      inputPerMillion: 3,
      outputPerMillion: 15,
    });
  });

  it('nao diferencia caixa', () => {
    expect(pricingFor('GPT-4O-MINI')).toEqual(pricingFor('gpt-4o-mini'));
  });

  it('aceita string vazia sem estourar', () => {
    expect(pricingFor('')).toEqual({ inputPerMillion: 3, outputPerMillion: 15 });
  });
});

describe('estimateCostUsd', () => {
  it('calcula o preco de uma chamada real', () => {
    // 1000 tokens de entrada em gpt-4o-mini = $0.00015
    // 2000 tokens de saida               = $0.0012
    expect(estimateCostUsd('gpt-4o-mini', 1000, 2000)).toBeCloseTo(0.00135, 6);
  });

  it('custa zero em modelo local', () => {
    expect(estimateCostUsd('ollama/llama3.2', 100000, 50000)).toBe(0);
  });

  it('cobra so a entrada quando a saida e zero', () => {
    expect(estimateCostUsd('deepseek-chat', 1_000_000, 0)).toBeCloseTo(0.27, 6);
  });

  it('nunca devolve negativo', () => {
    expect(estimateCostUsd('gpt-4o', -100, -100)).toBe(0);
  });

  it('cabe em 6 casas decimais (coluna e Decimal(10,6))', () => {
    const cost = estimateCostUsd('gpt-4o', 1, 1);
    expect(cost).toBe(0.000012);
    expect(String(cost).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
  });

  it('ordem de grandeza: mini e ~17x mais barato que o modelo cheio', () => {
    const mini = estimateCostUsd('gpt-4o-mini', 10_000, 10_000);
    const full = estimateCostUsd('gpt-4o', 10_000, 10_000);
    expect(full / mini).toBeGreaterThan(10);
  });
});

describe('isKnownModel', () => {
  it('reconhece familia conhecida', () => {
    expect(isKnownModel('gpt-4o-mini')).toBe(true);
    expect(isKnownModel('deepseek-chat')).toBe(true);
  });

  it('reconhece prefixo generico como conhecido', () => {
    expect(isKnownModel('gpt-5-turbo')).toBe(true);
  });

  it('marca desconhecido', () => {
    expect(isKnownModel('meu-modelo-finetuned')).toBe(false);
  });
});
