import { describe, it, expect, vi } from 'vitest';
import { daysIdleSince, nextFollowUpDate } from './follow-up.js';

/**
 * Ticket 28: cálculo de "dias parados" com timezone America/Sao_Paulo.
 *
 * O cálculo compara apenas a data (dia/mês/ano) no fuso de SP, independent
 * do horário. Uma interação às 23h de ontem conta como 1 dia parado às
 * 00h01 de hoje.
 */

describe('daysIdleSince — fuso America/Sao_Paulo', () => {
  const spNow = new Date('2026-10-28T10:00:00-03:00'); // 28/10/2026 em SP

  it('mesmo dia = 0 dias parados', () => {
    expect(daysIdleSince(new Date('2026-10-28T08:00:00-03:00'), spNow)).toBe(0);
    expect(daysIdleSince(new Date('2026-10-28T23:00:00-03:00'), spNow)).toBe(0);
  });

  it('ontem = 1 dia parado, mesmo se ainda é "ontem" em UTC', () => {
    // 27/10 às 23h em SP é 28/10 às 02h em UTC. referenceNow é 28/10 às 10h SP.
    expect(daysIdleSince(new Date('2026-10-27T23:00:00-03:00'), spNow)).toBe(1);
  });

  it('3 dias atrás = 3 dias parados', () => {
    expect(daysIdleSince(new Date('2026-10-25T10:00:00-03:00'), spNow)).toBe(3);
  });

  it('ignora diferença de horário dentro do mesmo dia SP', () => {
    // 27/10 às 23:59 SP vs 28/10 às 00:01 SP = 1 dia parado (dias diferentes)
    expect(
      daysIdleSince(new Date('2026-10-27T23:59:00-03:00'), new Date('2026-10-28T00:01:00-03:00')),
    ).toBe(1);

    // 28/10 às 23:59 SP vs 28/10 às 00:01 SP = 0 dias (mesmo dia SP)
    expect(
      daysIdleSince(new Date('2026-10-28T00:01:00-03:00'), new Date('2026-10-28T23:59:00-03:00')),
    ).toBe(0);
  });

  it('usa now() por padrão quando não passa referenceNow', () => {
    vi.setSystemTime(new Date('2026-10-28T10:00:00-03:00'));
    expect(daysIdleSince(new Date('2026-10-25T10:00:00-03:00'))).toBe(3);
    vi.useRealTimers();
  });
});

describe('nextFollowUpDate — fuso America/Sao_Paulo', () => {
  const spNow = new Date('2026-10-28T10:00:00-03:00'); // 28/10/2026 em SP

  it('cadência 7 dias a partir de hoje = daqui a 7 dias', () => {
    const next = nextFollowUpDate(7, spNow);
    expect(spDateString(next)).toBe('04/11/2026');
  });

  it('cadência 1 dia = amanhã', () => {
    const next = nextFollowUpDate(1, spNow);
    expect(spDateString(next)).toBe('29/10/2026');
  });

  function spDateString(date: Date): string {
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
});
