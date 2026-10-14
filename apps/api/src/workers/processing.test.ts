import { describe, it, expect } from 'vitest';
import { __testPipelineJobId as pipelineJobId } from './processing.js';

/**
 * O formato do ID de job do pipeline é contrato com o BullMQ.
 *
 * O BullMQ usa `:` como delimitador nas chaves do Redis e REJEITA ID
 * customizado que o contenha. Quando o ID era `extract-job:<id>`, o
 * POST /api/admin/process-all respondia 500 com "Custom Id cannot contain :"
 * — e como o erro vinha do worker de fila, o toast dizia só "Erro no
 * processamento", sem pista nenhuma.
 *
 * Este teste não precisa de Redis: ele trava o formato, que é onde estava o
 * bug. A prova contra o Redis real foi feita uma vez manualmente (addBulk
 * aceita, reenfileirar deduplica, fila limpa depois).
 */
describe('pipelineJobId — formato aceito pelo BullMQ', () => {
  it('nunca contém dois-pontos', () => {
    for (const step of ['extract-job', 'match-job', 'analyze-job']) {
      const id = pipelineJobId(step, 'cmv8aar50000aglejl3iapsiw');
      expect(id).not.toContain(':');
    }
  });

  it('é determinístico por (step, vaga)', () => {
    expect(pipelineJobId('extract-job', 'abc')).toBe(pipelineJobId('extract-job', 'abc'));
  });

  it('distingue step e vaga', () => {
    const a = pipelineJobId('extract-job', 'abc');
    expect(pipelineJobId('match-job', 'abc')).not.toBe(a);
    expect(pipelineJobId('extract-job', 'abd')).not.toBe(a);
  });

  it('não é vazio nem só o prefixo', () => {
    const id = pipelineJobId('extract-job', 'abc');
    expect(id.length).toBeGreaterThan('extract-job-'.length);
  });
});
