export type AtsIssueConfidence = 'alta' | 'media' | 'baixa';

export interface AtsIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  /** Trecho exato do CV que gerou o alerta (quando aplicável). */
  snippet?: string;
  /** Confiança de que o alerta é real (três níveis, sem falsa precisão). */
  confidence?: AtsIssueConfidence;
  /** Como corrigir, em um parágrafo direto. */
  fix?: string;
}

export interface AtsCheckResult {
  score: number;
  issues: AtsIssue[];
  stats: {
    estimatedPages: number;
    wordCount: number;
    hasContactBlock: boolean;
    hasTable: boolean;
    hasMultiColumn: boolean;
  };
}

/**
 * Verifica se o CV está em formato ATS-friendly.
 *
 * Baseado no guia de boas práticas de ATS (Applicant Tracking Systems):
 * - Uma coluna só
 * - Sem tabelas, gráficos, ícones
 * - Contato no corpo do documento
 * - Texto real, selecionável
 * - Até 2 páginas
 *
 * Aviso ao usuário (exibido no frontend): o ATS organiza o currículo; ele não
 * rejeita sozinho. Uma pontuação baixa não significa que o candidato será
 * descartado — apenas que o documento pode precisar de ajustes para ser lido
 * corretamente pelos sistemas de triagem.
 */
export class CvAtsChecker {
  check(rawText: string): AtsCheckResult {
    const issues: AtsIssue[] = [];
    const words = rawText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const estimatedPages = Math.max(1, Math.round(wordCount / 500));

    const hasTable = this.detectTable(rawText);
    const hasMultiColumn = this.detectMultiColumn(rawText);
    const hasContactBlock = this.detectContactBlock(rawText);

    if (estimatedPages > 2) {
      issues.push({
        severity: 'warning',
        code: 'TOO_LONG',
        message: `Currículo tem ~${estimatedPages} páginas. O ideal é no máximo 2. Corte informações menos relevantes.`,
        snippet: this.findSnippet(rawText, (l) => l.trim().length > 0),
        confidence: 'alta',
        fix: 'Remova experiências antigas (mais de 10-15 anos), cursos não relevantes e reduza o resumo profissional para 2-3 linhas. Mantenha apenas o que é direto para a vaga alvo.',
      });
    }

    if (hasTable) {
      const snippet = this.findSnippet(
        rawText,
        (l) => l.includes('|') || !!l.match(/\s{3,}/) || l.includes('\t'),
      );
      issues.push({
        severity: 'error',
        code: 'HAS_TABLE',
        message:
          'Tabela detectada no currículo. ATS tem dificuldade para extrair dados de tabelas. Substitua por bullet points.',
        snippet,
        confidence: 'alta',
        fix: 'Converta cada linha da tabela em um bullet point simples. Exemplo: em vez de “Cargo | Empresa | Ano”, escreva “Cargo na Empresa (Ano)”.',
      });
    }

    if (hasMultiColumn) {
      issues.push({
        severity: 'error',
        code: 'MULTI_COLUMN',
        message:
          'Layout em múltiplas colunas detectado. Use uma coluna só para garantir que o ATS leia o texto na ordem correta.',
        snippet: undefined,
        confidence: 'media',
        fix: 'Reorganize o CV em coluna única, com as seções empilhadas verticalmente (resumo, experiência, formação, skills). Evite colunas lado a lado.',
      });
    }

    if (!hasContactBlock) {
      issues.push({
        severity: 'warning',
        code: 'NO_CONTACT',
        message:
          'Não encontrei nome, e-mail ou telefone no início do currículo. Coloque essas informações no corpo do documento, sem caixas de texto ou cabeçalho separado.',
        snippet: this.findSnippet(rawText, (l) => l.trim().length > 0 && l.trim().length < 80),
        confidence: 'alta',
        fix: 'No topo do documento, inclua: nome completo, e-mail, telefone, cidade/UF e (opcional) LinkedIn. Tudo como texto simples, não como imagem ou cabeçalho de seção.',
      });
    }

    const score = this.calculateScore(issues, {
      estimatedPages,
      hasTable,
      hasMultiColumn,
      hasContactBlock,
    });

    return {
      score,
      issues,
      stats: {
        estimatedPages,
        wordCount,
        hasContactBlock,
        hasTable,
        hasMultiColumn,
      },
    };
  }

  /**
   * Encontra a primeira linha que satisfaz o predicado, para exibir como
   * trecho explicativo ao usuário. Retorna a linha limpa, truncada se for
   * muito longa.
   */
  private findSnippet(text: string, predicate: (line: string) => boolean): string | undefined {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && predicate(trimmed)) {
        return trimmed.length > 90 ? trimmed.slice(0, 87) + '...' : trimmed;
      }
    }
    return undefined;
  }

  private detectTable(text: string): boolean {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let tabularLines = 0;
    for (const line of lines) {
      const tabs = (line.match(/\t/g) ?? []).length;
      const multipleSpaces = (line.match(/\s{3,}/g) ?? []).length;
      const separators = (line.match(/[|]/g) ?? []).length;
      if (tabs >= 2 || multipleSpaces >= 2 || separators >= 2) {
        tabularLines++;
      }
    }
    return tabularLines >= 3;
  }

  private detectMultiColumn(text: string): boolean {
    const lines = text.split('\n');
    let shortLines = 0;
    let longLines = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.length < 40) shortLines++;
      else longLines++;
    }
    return shortLines > longLines * 1.5 && shortLines > 20;
  }

  private detectContactBlock(text: string): boolean {
    const head = text.slice(0, 600).toLowerCase();
    const hasEmail = /@/.test(head);
    const hasPhone = /\+?\d[\d\s().-]{7,}\d/.test(head);
    const hasName = head.split('\n').filter(Boolean).length >= 1;
    return hasName && (hasEmail || hasPhone);
  }

  private calculateScore(
    issues: AtsIssue[],
    stats: {
      estimatedPages: number;
      hasTable: boolean;
      hasMultiColumn: boolean;
      hasContactBlock: boolean;
    },
  ): number {
    let score = 100;
    for (const issue of issues) {
      score -= issue.severity === 'error' ? 30 : 10;
    }
    if (stats.estimatedPages === 1) score += 5;
    if (stats.hasContactBlock) score += 5;
    return Math.max(0, Math.min(100, score));
  }
}

export const cvAtsChecker = new CvAtsChecker();
