/**
 * Textos do painel de resultado da coleta/processamento.
 *
 * Funções puras de propósito: o painel em si é JSX com estado do react-query,
 * que não tem cobertura (sem testing-library). A parte que decide O QUE dizer
 * — plural, contagem, erros — fica aqui, testada.
 */

export interface ResultadoColeta {
  /** Vagas novas gravadas. */
  coletadas: number;
  /** Uma entrada por fonte que falhou (ou lista vazia). */
  erros: string[];
}

export interface TextoResultado {
  titulo: string;
  detalhe: string;
  temErro: boolean;
}

export function textoResultadoColeta(r: ResultadoColeta): TextoResultado {
  const temErro = r.erros.length > 0;

  if (r.coletadas === 0 && !temErro) {
    return {
      titulo: 'Coleta concluída — nenhuma vaga nova',
      detalhe: 'As fontes responderam, mas nada passou nos filtros ou tudo já estava salvo.',
      temErro: false,
    };
  }

  const vagas = r.coletadas === 1 ? '1 vaga nova' : `${r.coletadas} vagas novas`;
  return {
    titulo: temErro ? `Coleta parcial — ${vagas}` : `Coleta concluída — ${vagas}`,
    detalhe: temErro
      ? `${r.erros.length} ${r.erros.length === 1 ? 'fonte falhou' : 'fontes falharam'} (as outras entraram).`
      : 'Prontas para processamento na fila.',
    temErro,
  };
}

export function textoResultadoProcessamento(quantidade: number): TextoResultado {
  if (quantidade === 0) {
    return {
      titulo: 'Nada para processar',
      detalhe: 'Não há vagas aguardando (status RAW). Colete primeiro.',
      temErro: false,
    };
  }
  return {
    titulo: `Processamento enfileirado — ${quantidade} ${quantidade === 1 ? 'vaga' : 'vagas'}`,
    detalhe: 'Extração, matching e análise rodam na fila; o status de cada vaga anda sozinho.',
    temErro: false,
  };
}

/** "42s", "1m05s", "3m00s" — para o indicador de progresso. */
export function formatElapsed(totalSegundos: number): string {
  const s = Math.max(0, Math.floor(totalSegundos));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const resto = s % 60;
  return `${m}m${String(resto).padStart(2, '0')}s`;
}
