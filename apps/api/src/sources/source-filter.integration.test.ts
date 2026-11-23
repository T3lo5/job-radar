import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/index.js';
import type { JobSource } from '@job-radar/shared';
import {
  collectFromAllSources,
  getAllSources,
  getEnabledSourceIds,
  registerSource,
} from './index.js';

/**
 * Ticket 15: desligar uma fonte na UI precisa impedir a request de verdade.
 *
 * O registry é global, então entram aqui só fontes falsas com ids próprios
 * (`__fonteflag__*`). As fontes reais ficam desativadas para o teste não sair
 * para a rede — e são reativadas no `afterAll`, porque o banco é compartilhado.
 */
const prisma = new PrismaClient({ log: ['error'] });
const MARCA = '__fonteflag__';

const A = `${MARCA}a`;
const B = `${MARCA}b`;
const C = `${MARCA}c`;

let chamadas: string[] = [];

function fonteFalsa(id: string): JobSource {
  return {
    id,
    name: id,
    description: id,
    fetch: async () => {
      chamadas.push(id);
      return [];
    },
  };
}

function fontesReais(): string[] {
  return getAllSources()
    .map((s) => s.id)
    .filter((id) => !id.startsWith(MARCA));
}

async function desligarReais() {
  for (const id of fontesReais()) {
    await prisma.setting.create({
      data: { scope: 'sources', key: `source_${id}_enabled`, value: 'false' },
    });
  }
}

async function limparFlags() {
  await prisma.setting.deleteMany({
    where: { scope: 'sources', key: { startsWith: 'source_' } },
  });
}

beforeAll(async () => {
  await prisma.$connect();
  registerSource(fonteFalsa(A));
  registerSource(fonteFalsa(B));
  registerSource(fonteFalsa(C));
});

afterAll(async () => {
  await limparFlags();
  await prisma.$disconnect();
});

beforeEach(async () => {
  chamadas = [];
  await limparFlags();
  await desligarReais();
});

describe('collectFromAllSources respeita source_<id>_enabled', () => {
  it('setting ausente mantém a fonte habilitada; "false" desliga', async () => {
    // A e C sem setting; B explicitamente desligada.
    await prisma.setting.create({
      data: { scope: 'sources', key: `source_${B}_enabled`, value: 'false' },
    });

    const enabled = await getEnabledSourceIds();
    expect(enabled.has(A)).toBe(true);
    expect(enabled.has(C)).toBe(true);
    expect(enabled.has(B)).toBe(false);

    await collectFromAllSources({ keywords: [] });

    expect(chamadas).toEqual([A, C]);
  });

  it('com o conjunto explícito, só a fonte pedida é chamada', async () => {
    // É o caminho de "reativar sem restart": a próxima execução recalcula.
    await collectFromAllSources({ keywords: [] }, { enabledSourceIds: new Set([B]) });
    expect(chamadas).toEqual([B]);
  });

  it('conjunto vazio não chama fonte nenhuma', async () => {
    const result = await collectFromAllSources(
      { keywords: [] },
      { enabledSourceIds: new Set<string>() },
    );
    expect(result).toEqual([]);
    expect(chamadas).toEqual([]);
  });

  it('"true" conta como habilitada', async () => {
    await prisma.setting.create({
      data: { scope: 'sources', key: `source_${B}_enabled`, value: 'true' },
    });

    await collectFromAllSources({ keywords: [] });
    expect(chamadas).toEqual([A, B, C]);
  });
});
