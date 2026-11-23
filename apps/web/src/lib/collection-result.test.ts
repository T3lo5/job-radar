import { describe, it, expect } from 'vitest';
import {
  textoResultadoColeta,
  textoResultadoProcessamento,
  formatElapsed,
} from './collection-result';

describe('textoResultadoColeta', () => {
  it('diz quantas vagas entraram', () => {
    const r = textoResultadoColeta({ coletadas: 34, erros: [] });
    expect(r.titulo).toContain('34 vagas novas');
    expect(r.temErro).toBe(false);
  });

  it('singular quando é uma só', () => {
    expect(textoResultadoColeta({ coletadas: 1, erros: [] }).titulo).toContain('1 vaga nova');
    expect(textoResultadoColeta({ coletadas: 1, erros: [] }).titulo).not.toContain('vagas');
  });

  it('diz que foi parcial quando alguma fonte falhou', () => {
    const r = textoResultadoColeta({ coletadas: 5, erros: ['Source linkedin: timeout'] });
    expect(r.titulo).toContain('parcial');
    expect(r.detalhe).toContain('1 fonte falhou');
    expect(r.temErro).toBe(true);
  });

  it('pluraliza fontes com erro', () => {
    const r = textoResultadoColeta({ coletadas: 5, erros: ['a', 'b'] });
    expect(r.detalhe).toContain('2 fontes falharam');
  });

  it('zero vagas sem erro explica o motivo', () => {
    const r = textoResultadoColeta({ coletadas: 0, erros: [] });
    expect(r.titulo).toContain('nenhuma vaga nova');
    expect(r.detalhe).toContain('filtros');
  });

  it('zero vagas com erro mostra o parcial', () => {
    const r = textoResultadoColeta({ coletadas: 0, erros: ['x'] });
    expect(r.titulo).toContain('parcial');
    expect(r.temErro).toBe(true);
  });
});

describe('textoResultadoProcessamento', () => {
  it('diz quantas foram enfileiradas', () => {
    const r = textoResultadoProcessamento(34);
    expect(r.titulo).toContain('34 vagas');
  });

  it('zero explica que não há RAW', () => {
    const r = textoResultadoProcessamento(0);
    expect(r.titulo).toContain('Nada para processar');
    expect(r.detalhe).toContain('RAW');
  });
});

describe('formatElapsed', () => {
  it('segundos abaixo de um minuto', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(42)).toBe('42s');
    expect(formatElapsed(59)).toBe('59s');
  });

  it('minutos com zero à esquerda nos segundos', () => {
    expect(formatElapsed(60)).toBe('1m00s');
    expect(formatElapsed(65)).toBe('1m05s');
    expect(formatElapsed(185)).toBe('3m05s');
  });

  it('arredonda para baixo e ignora negativo', () => {
    expect(formatElapsed(42.9)).toBe('42s');
    expect(formatElapsed(-5)).toBe('0s');
  });
});

describe('textoResultadoColeta — fontes desativadas', () => {
  it('lista as fontes puladas quando algumas foram desativadas', () => {
    const r = textoResultadoColeta({
      coletadas: 3,
      erros: [],
      fontesExecutadas: ['remoteok', 'remotive'],
      fontesPuladas: ['linkedin'],
    });

    expect(r.detalhe).toContain('2 fontes consultadas');
    expect(r.detalhe).toContain('1 desativada: linkedin');
    expect(r.temErro).toBe(false);
  });

  it('pluraliza as desativadas', () => {
    const r = textoResultadoColeta({
      coletadas: 0,
      erros: [],
      fontesExecutadas: ['remoteok'],
      fontesPuladas: ['linkedin', 'indeed'],
    });

    expect(r.detalhe).toContain('2 desativadas: linkedin, indeed');
  });

  it('não promete que "as fontes responderam" quando todas estão desligadas', () => {
    const r = textoResultadoColeta({
      coletadas: 0,
      erros: [],
      fontesExecutadas: [],
      fontesPuladas: ['linkedin', 'remoteok'],
    });

    expect(r.titulo).toContain('todas as fontes estão desativadas');
    expect(r.detalhe).toContain('Nenhuma fonte foi consultada');
    expect(r.detalhe).not.toContain('responderam');
  });

  it('mantém o texto antigo quando o relatório não traz a lista de fontes', () => {
    const r = textoResultadoColeta({ coletadas: 2, erros: [] });
    expect(r.detalhe).toBe('Prontas para processamento na fila.');
  });
});
