import { z } from 'zod';

/**
 * Cadência padrão (em dias) para reagendar o próximo follow-up após registrar
 * contato. Pode ser sobrescrita pelo setting `app.followUpCadenceDays`.
 */
export const DEFAULT_FOLLOW_UP_CADENCE_DAYS = 7;

/** Status que não são mais passíveis de follow-up. */
export const FOLLOW_UP_EXCLUDED_STATUSES = ['ARCHIVED', 'REJECTED', 'OFFER'] as const;

/**
 * Retorna a data (YYYY-MM-DD) no fuso horário de São Paulo para a data
 * informada.
 */
function spDateString(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Converte uma string DD/MM/AAAA (formato pt-BR) em um Date no meio-dia UTC.
 * Meio-dia UTC = 09:00 em SP (fuso -03, sem horário de verão no Brasil desde
 * 2019), então é sempre o mesmo dia calendário em SP. Isso evita o problema de
 * somar dias em UTC e cair no dia anterior ao converter para SP.
 */
function parseSpDate(str: string): Date {
  const [day, month, year] = str.split('/').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/**
 * Calcula quantos dias corridos se passaram desde `lastInteraction`, usando o
 * fuso horário de São Paulo (America/Sao_Paulo).
 *
 * O cálculo compara apenas a data (dia/mês/ano), não o horário: uma
 * interação às 23h de ontem conta como 1 dia parado às 00h01 de hoje.
 */
export function daysIdleSince(lastInteraction: Date, referenceNow = new Date()): number {
  const lastDay = spDateString(lastInteraction);
  const nowDay = spDateString(referenceNow);
  const diffMs = parseSpDate(nowDay).getTime() - parseSpDate(lastDay).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calcula a próxima data de follow-up somando `cadenceDays` dias a
 * `referenceNow`, usando o fuso horário de São Paulo.
 */
export function nextFollowUpDate(cadenceDays: number, referenceNow = new Date()): Date {
  const base = parseSpDate(spDateString(referenceNow));
  base.setUTCDate(base.getUTCDate() + cadenceDays);
  return base;
}

export const FollowUpCadenceSchema = z.object({
  cadenceDays: z.coerce.number().int().min(1).max(365).default(7),
});

export type FollowUpCadenceInput = z.infer<typeof FollowUpCadenceSchema>;
