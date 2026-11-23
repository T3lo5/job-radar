import { describe, it, expect, vi } from 'vitest';
import {
  PipelineOrchestrator,
  type PipelineProgressDb,
} from '../services/pipeline/orchestrator.js';
import type { ProcessingStep } from '../services/pipeline/step.js';

/**
 * Testes do orquestrador de verdade.
 *
 * O arquivo anterior montava arrays locais (`validTransitions`,
 * `validStatuses`) e os próprios testes — passava mesmo se o pipeline inteiro
 * fosse removido. Aqui o `PipelineOrchestrator` real roda com steps fake e um
 * banco de progresso em memória: o que se testa é a guarda de idempotência, o
 * retry depois de FAILED e a propagação do erro.
 */

interface EstadoFake {
  status: string;
  logs: Array<{ fromStatus: string | null; toStatus: string }>;
}

function criarProgressDb(inicial: string): { estado: EstadoFake; db: PipelineProgressDb } {
  const estado: EstadoFake = { status: inicial, logs: [] };

  const db: PipelineProgressDb = {
    job: {
      findUnique: async () => ({ status: estado.status }),
      update: async ({ data }) => {
        estado.status = data.status;
        return {};
      },
    },
    jobProcessingLog: {
      create: async ({ data }) => {
        estado.logs.push({ fromStatus: data.fromStatus, toStatus: data.toStatus });
        return {};
      },
      findFirst: async ({ where }) => {
        const achado = [...estado.logs]
          .reverse()
          .find((log) => log.toStatus === where.toStatus && log.fromStatus !== null);
        return achado ? { fromStatus: achado.fromStatus } : null;
      },
    },
  };

  return { estado, db };
}

function stepFake(run: ProcessingStep['run']): ProcessingStep & { run: ReturnType<typeof vi.fn> } {
  return { name: 'fake', run: vi.fn(run) } as never;
}

function orquestrador(
  steps: Record<string, ProcessingStep>,
  db: PipelineProgressDb,
  enqueueJob = vi.fn(async () => {}),
) {
  const orq = new PipelineOrchestrator(
    { enqueueJob },
    { steps: new Map(Object.entries(steps)), progressDb: db },
  );

  return { orq, enqueueJob };
}

describe('PipelineOrchestrator', () => {
  it('executa a etapa pedida', async () => {
    const { db } = criarProgressDb('RAW');
    const extract = stepFake(async () => {});
    const { orq } = orquestrador({ extract }, db);

    await orq.run('job-1', 'extract');

    expect(extract.run).toHaveBeenCalledTimes(1);
    expect(extract.run.mock.calls[0][0]).toMatchObject({ jobId: 'job-1' });
  });

  it('não repete etapa já concluída', async () => {
    const { db } = criarProgressDb('ANALYZING');
    const extract = stepFake(async () => {});
    const match = stepFake(async () => {});
    const { orq } = orquestrador({ extract, match }, db);

    await orq.run('job-1', 'extract');
    await orq.run('job-1', 'match');

    expect(extract.run).not.toHaveBeenCalled();
    expect(match.run).not.toHaveBeenCalled();
  });

  it('etapa desconhecida é ignorada sem chamar nada', async () => {
    const { db } = criarProgressDb('RAW');
    const { orq, enqueueJob } = orquestrador({}, db);

    await expect(orq.run('job-1', 'inexistente')).resolves.toBeUndefined();
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it('falha marca FAILED, registra de onde parou e propaga o erro', async () => {
    const { estado, db } = criarProgressDb('RAW');
    const extract = stepFake(async () => {
      // A extração marca EXTRACTING antes de chamar a IA; é esse status que
      // precisa sobreviver no log da falha.
      estado.status = 'EXTRACTING';
      throw new Error('IA fora do ar');
    });
    const { orq } = orquestrador({ extract }, db);

    await expect(orq.run('job-1', 'extract')).rejects.toThrow('IA fora do ar');

    expect(estado.status).toBe('FAILED');
    expect(estado.logs).toContainEqual({ fromStatus: 'EXTRACTING', toStatus: 'FAILED' });
  });

  it('retry depois de falha reprocessa a etapa que falhou', async () => {
    const { estado, db } = criarProgressDb('RAW');
    let tentativas = 0;

    const extract = stepFake(async () => {
      tentativas++;
      if (tentativas === 1) {
        estado.status = 'EXTRACTING';
        throw new Error('falha transitória');
      }
      estado.status = 'MATCHING';
    });

    const { orq } = orquestrador({ extract }, db);

    await expect(orq.run('job-1', 'extract')).rejects.toThrow('falha transitória');
    expect(estado.status).toBe('FAILED');

    // O retry do BullMQ apresenta o mesmo step; FAILED não pode contar como
    // concluído, senão a vaga ficaria presa para sempre.
    await orq.run('job-1', 'extract');

    expect(tentativas).toBe(2);
    expect(estado.status).toBe('MATCHING');
  });

  it('retry não repete etapas anteriores à falha', async () => {
    // Falhou na análise: extração e matching já tinham sido concluídos.
    const { db } = criarProgressDb('FAILED');
    await db.jobProcessingLog.create({
      data: { jobId: 'job-1', fromStatus: 'ANALYZING', toStatus: 'FAILED', message: 'boom' },
    });

    const extract = stepFake(async () => {});
    const match = stepFake(async () => {});
    const analyze = stepFake(async () => {});
    const { orq } = orquestrador({ extract, match, analyze }, db);

    await orq.run('job-1', 'extract');
    await orq.run('job-1', 'match');
    await orq.run('job-1', 'analyze');

    expect(extract.run).not.toHaveBeenCalled();
    expect(match.run).not.toHaveBeenCalled();
    expect(analyze.run).toHaveBeenCalledTimes(1);
  });

  it('FAILED antigo, sem registro de progresso, reprocessa do zero', async () => {
    const { db } = criarProgressDb('FAILED');
    const extract = stepFake(async () => {});
    const { orq } = orquestrador({ extract }, db);

    await orq.run('job-1', 'extract');

    expect(extract.run).toHaveBeenCalledTimes(1);
  });

  it('vaga inexistente não executa etapa', async () => {
    const db: PipelineProgressDb = {
      job: { findUnique: async () => null, update: async () => ({}) },
      jobProcessingLog: { create: async () => ({}), findFirst: async () => null },
    };
    const extract = stepFake(async () => {});
    const { orq } = orquestrador({ extract }, db);

    await orq.run('job-1', 'extract');

    expect(extract.run).not.toHaveBeenCalled();
  });
});
