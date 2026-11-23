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
  /** Fontes consultadas nesta coleta (ids). */
  fontesExecutadas?: string[];
  /** Fontes desativadas que não foram consultadas (ids). */
  fontesPuladas?: string[];
}

export interface TextoResultado {
  titulo: string;
  detalhe: string;
  temErro: boolean;
}

/** "9 fontes consultadas; 1 desativada: linkedin." — vazio se não houve relatório. */
function resumoFontes(r: ResultadoColeta): string {
  const executadas = r.fontesExecutadas ?? [];
  const puladas = r.fontesPuladas ?? [];
  const partes: string[] = [];

  if (executadas.length > 0) {
    partes.push(
      `${executadas.length} ${executadas.length === 1 ? 'fonte consultada' : 'fontes consultadas'}`,
    );
  }
  if (puladas.length > 0) {
    partes.push(
      `${puladas.length} ${puladas.length === 1 ? 'desativada' : 'desativadas'}: ${puladas.join(', ')}`,
    );
  }

  return partes.length > 0 ? ` ${partes.join('; ')}.` : '';
}

export function textoResultadoColeta(r: ResultadoColeta): TextoResultado {
  const temErro = r.erros.length > 0;
  const executadas = r.fontesExecutadas ?? [];
  const puladas = r.fontesPuladas ?? [];

  // Tudo desligado não é "as fontes responderam, mas nada passou": nenhuma
  // fonte foi chamada. Dizer o contrário faria o usuário caçar filtro errado.
  if (executadas.length === 0 && puladas.length > 0) {
    return {
      titulo: 'Coleta não executada — todas as fontes estão desativadas',
      detalhe: 'Nenhuma fonte foi consultada. Reative ao menos uma na lista abaixo.',
      temErro: false,
    };
  }

  const fontes = resumoFontes(r);

  if (r.coletadas === 0 && !temErro) {
    return {
      titulo: 'Coleta concluída — nenhuma vaga nova',
      detalhe: `As fontes responderam, mas nada passou nos filtros ou tudo já estava salvo.${fontes}`,
      temErro: false,
    };
  }

  const vagas = r.coletadas === 1 ? '1 vaga nova' : `${r.coletadas} vagas novas`;
  return {
    titulo: temErro ? `Coleta parcial — ${vagas}` : `Coleta concluída — ${vagas}`,
    detalhe:
      (temErro
        ? `${r.erros.length} ${r.erros.length === 1 ? 'fonte falhou' : 'fontes falharam'} (as outras entraram).`
        : 'Prontas para processamento na fila.') + fontes,
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
