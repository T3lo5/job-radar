import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { PrismaClient } from '../generated/prisma/index.js';
import { setupRoutesWith } from './setup.js';
import { settingsRoutesWith } from './settings.js';
import { settingsService } from '../services/settings-service.js';
import { setupCronSchedule, isValidCronExpression, nextRunFor } from '../workers/job-collection.js';

/**
 * Ticket 14: salvar o cron precisa reagendar de verdade.
 *
 * A rota agora recebe a função de reagendamento por injeção; o teste prova que
 * ela é chamada, que o padrão inválido não é persistido e que a leitura expõe
 * o próximo horário. O teste da fila usa um `upsertJobScheduler` falso para não
 * mexer no Redis de desenvolvimento.
 */
const prisma = new PrismaClient({ log: ['error'] });
const CHAVES = ['settings:cron:jobCollectionCron', 'settings:cron:dailyReportCron'];

function fakeSchedule(jobCollectionCron = '0 6 * * *') {
  return {
    jobCollectionCron,
    dailyReportCron: '5 18 * * *',
    nextJobCollectionRun: nextRunFor(jobCollectionCron),
    nextDailyReportRun: nextRunFor('5 18 * * *'),
  };
}

async function appDeps(overrides?: {
  rescheduleCron?: () => Promise<ReturnType<typeof fakeSchedule>>;
}) {
  const turno = overrides?.rescheduleCron ?? (async () => fakeSchedule());
  return { rescheduleCron: turno };
}

async function limparSettings() {
  await prisma.setting.deleteMany({ where: { key: { in: CHAVES } } });
  // Limpa também o cache L2 para o próximo teste ler o banco, não o valor antigo.
  const { redis } = await import('../db/redis.js');
  if (redis.status === 'ready' || redis.status === 'wait') {
    await redis.del(...CHAVES);
  }
}

beforeAll(async () => {
  await prisma.$connect();
  await limparSettings();
});
afterAll(async () => {
  await limparSettings();
  await prisma.$disconnect();
});
beforeEach(async () => {
  await limparSettings();
});

describe('validação de expressão cron', () => {
  it('aceita padrões reais e rejeita lixo', () => {
    expect(isValidCronExpression('0 6 * * *')).toBe(true);
    expect(isValidCronExpression('*/15 * * * *')).toBe(true);
    expect(isValidCronExpression('0 9 * * 1-5')).toBe(true);
    expect(isValidCronExpression('99 99 * * *')).toBe(false);
    expect(isValidCronExpression('todo dia às 6')).toBe(false);
    expect(isValidCronExpression('')).toBe(false);
  });

  it('nextRunFor devolve ISO no futuro e null para padrão inválido', () => {
    const iso = nextRunFor('0 6 * * *');
    expect(iso).not.toBeNull();
    expect(new Date(iso!).getTime()).toBeGreaterThan(Date.now());
    expect(nextRunFor('99 99 * * *')).toBeNull();
  });
});

describe('POST /api/setup/cron', () => {
  it('persiste, reagenda e devolve o próximo horário', async () => {
    const f = Fastify({ logger: false });
    f.setValidatorCompiler(validatorCompiler);
    f.setSerializerCompiler(serializerCompiler);
    const rescheduleCron = vi.fn(async () => fakeSchedule('0 9 * * 1-5'));
    await f.register(setupRoutesWith({ rescheduleCron }));

    const r = await f.inject({
      method: 'POST',
      url: '/api/setup/cron',
      payload: { jobCollectionCron: '0 9 * * 1-5', dailyReportCron: '5 18 * * *' },
    });

    expect(r.statusCode).toBe(200);
    expect(r.json().jobCollectionCron).toBe('0 9 * * 1-5');
    expect(r.json().nextJobCollectionRun).toBeTruthy();
    expect(rescheduleCron).toHaveBeenCalledTimes(1);
    expect(await settingsService.get('cron', 'jobCollectionCron')).toBe('0 9 * * 1-5');
    await f.close();
  });

  it('rejeita cron inválido com 400 sem persistir nem reagendar', async () => {
    await settingsService.set('cron', 'jobCollectionCron', '0 6 * * *');

    const f = Fastify({ logger: false });
    f.setValidatorCompiler(validatorCompiler);
    f.setSerializerCompiler(serializerCompiler);
    const rescheduleCron = vi.fn(async () => fakeSchedule());
    await f.register(setupRoutesWith({ rescheduleCron }));

    const r = await f.inject({
      method: 'POST',
      url: '/api/setup/cron',
      payload: { jobCollectionCron: '99 99 * * *' },
    });

    expect(r.statusCode).toBe(400);
    expect(rescheduleCron).not.toHaveBeenCalled();
    expect(await settingsService.get('cron', 'jobCollectionCron')).toBe('0 6 * * *');
    await f.close();
  });
});

describe('GET /api/settings/cron', () => {
  it('expõe o próximo horário real dos dois agendamentos', async () => {
    await settingsService.set('cron', 'jobCollectionCron', '*/15 * * * *');
    await settingsService.set('cron', 'dailyReportCron', '5 18 * * *');

    const f = Fastify({ logger: false });
    f.setValidatorCompiler(validatorCompiler);
    f.setSerializerCompiler(serializerCompiler);
    await f.register(settingsRoutesWith(await appDeps()));

    const r = await f.inject({ method: 'GET', url: '/api/settings/cron' });

    expect(r.statusCode).toBe(200);
    expect(r.json().settings.jobCollectionCron).toBe('*/15 * * * *');
    expect(new Date(r.json().nextRuns.jobCollectionCron).getTime()).toBeGreaterThan(Date.now());
    expect(r.json().nextRuns.dailyReportCron).toBeTruthy();
    await f.close();
  });

  it('POST no escopo cron reagenda; em outro escopo não', async () => {
    const f = Fastify({ logger: false });
    f.setValidatorCompiler(validatorCompiler);
    f.setSerializerCompiler(serializerCompiler);
    const rescheduleCron = vi.fn(async () => fakeSchedule());
    await f.register(settingsRoutesWith({ rescheduleCron }));

    const ai = await f.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { scope: 'ai', key: 'model', value: 'gpt-4o-mini' },
    });
    expect(ai.statusCode).toBe(204);
    expect(rescheduleCron).not.toHaveBeenCalled();

    const cron = await f.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { scope: 'cron', key: 'jobCollectionCron', value: '0 7 * * *' },
    });
    expect(cron.statusCode).toBe(204);
    expect(rescheduleCron).toHaveBeenCalledTimes(1);
    await f.close();
  });
});

describe('setupCronSchedule troca o padrão do scheduler existente', () => {
  it('faz upsert com os mesmos ids e o padrão novo', async () => {
    await settingsService.set('cron', 'jobCollectionCron', '*/5 * * * *');
    await settingsService.set('cron', 'dailyReportCron', '5 18 * * *');

    const upsertJobScheduler = vi.fn(async () => ({}));
    const queue = { upsertJobScheduler } as unknown as Parameters<typeof setupCronSchedule>[0];

    const primeira = await setupCronSchedule(queue);
    expect(primeira.jobCollectionCron).toBe('*/5 * * * *');
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'job-collection-scheduler',
      { pattern: '*/5 * * * *' },
      { name: 'collect-jobs' },
    );

    await settingsService.set('cron', 'jobCollectionCron', '0 9 * * 1-5');
    upsertJobScheduler.mockClear();

    const segunda = await setupCronSchedule(queue);
    expect(segunda.jobCollectionCron).toBe('0 9 * * 1-5');
    // Mesmo scheduler id: o BullMQ substitui o agendamento anterior.
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      'job-collection-scheduler',
      { pattern: '0 9 * * 1-5' },
      { name: 'collect-jobs' },
    );
  });
});
