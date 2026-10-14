import { describe, it, expect } from 'vitest';
import { initialSeniorityList, displaySeniority, syncedSeniority } from './seniority';

describe('initialSeniorityList — o que aparece selecionado', () => {
  it('mostra a lista quando ela tem valor', () => {
    expect(initialSeniorityList({ seniority: 'JUNIOR', seniorityList: ['MID', 'SENIOR'] })).toEqual(
      ['MID', 'SENIOR'],
    );
  });

  it('cai para a senioridade unica quando a lista esta vazia', () => {
    // Este é o bug reportado: quem passou pelo setup tinha `seniority`
    // preenchida e `seniorityList` vazia, e via os botões todos apagados.
    expect(initialSeniorityList({ seniority: 'SENIOR', seniorityList: [] })).toEqual(['SENIOR']);
  });

  it('cai para a unica quando a lista e null', () => {
    expect(initialSeniorityList({ seniority: 'MID', seniorityList: null })).toEqual(['MID']);
  });

  it('devolve vazio quando nao ha nada', () => {
    expect(initialSeniorityList({ seniority: null, seniorityList: [] })).toEqual([]);
    expect(initialSeniorityList(null)).toEqual([]);
    expect(initialSeniorityList(undefined)).toEqual([]);
  });

  it('devolve copia, nao a referencia', () => {
    const lista = ['SENIOR'];
    const resultado = initialSeniorityList({ seniorityList: lista });
    expect(resultado).toEqual(lista);
    expect(resultado).not.toBe(lista);
  });
});

describe('displaySeniority — a linha no modo leitura', () => {
  it('traduz a lista com rotulos', () => {
    expect(displaySeniority({ seniorityList: ['MID', 'SENIOR'] })).toBe('Pleno, Sênior');
  });

  it('NÃO mostra em branco quando a lista esta vazia mas a unica existe', () => {
    // `[].join(', ')` é `''`, que não é nullish — o `??` antigo nunca caía
    // para a única e a linha ficava vazia.
    expect(displaySeniority({ seniority: 'SENIOR', seniorityList: [] })).toBe('Sênior');
  });

  it('mostra a unica traduzida', () => {
    expect(displaySeniority({ seniority: 'JUNIOR' })).toBe('Júnior');
  });

  it('mostra - quando nao ha nada', () => {
    expect(displaySeniority({ seniority: null, seniorityList: [] })).toBe('-');
    expect(displaySeniority(null)).toBe('-');
  });
});

describe('syncedSeniority — a unica acompanha a lista no save', () => {
  it('assume a maior da lista', () => {
    expect(syncedSeniority(['JUNIOR', 'SENIOR'], 'JUNIOR')).toBe('SENIOR');
  });

  it('mantem a atual quando a lista esta vazia', () => {
    expect(syncedSeniority([], 'SENIOR')).toBe('SENIOR');
    expect(syncedSeniority([], null)).toBeNull();
  });

  it('ignora valores nulos na lista', () => {
    expect(syncedSeniority([null, 'MID'], null)).toBe('MID');
  });
});
