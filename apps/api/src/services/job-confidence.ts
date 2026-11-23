/**
 * Ticket 29 — Índice de confiança da vaga.
 *
 * Calcula um índice 0–100 com sinais explícitos, sem misturar com o match score.
 * Nunca esconde vaga por default: o filtro é opt-in no frontend.
 *
 * Sinais (pesos somam 100):
 * - frescor: até 30 pts (menos de 7 dias = cheio; decai linearmente até 30 dias)
 * - recorrência (sourceCount): até 25 pts (3+ fontes = cheio)
 * - salário presente: 15 pts
 * - descrição completa: até 20 pts (>= 500 chars = cheio)
 * - URL válida: 10 pts (sempre verdadeira no modelo, mas validada)
 *
 * Critérios de aceite: corte de "baixa confiança" começa em 40.
 */

export const CONFIDENCE_LOW_THRESHOLD = 40;
export const CONFIDENCE_MEDIUM_THRESHOLD = 70;

const MAX_FRESHNESS_DAYS = 30;
const MAX_DESCRIPTION_CHARS = 500;
const MIN_SOURCE_COUNT_FOR_FULL = 3;

export interface ConfidenceResult {
  score: number; // 0–100
  label: 'baixa' | 'media' | 'alta';
  badges: ConfidenceBadge[];
  signals: ConfidenceSignals;
}

export interface ConfidenceSignals {
  freshnessDays: number | null;
  sourceCount: number;
  hasSalary: boolean;
  descriptionChars: number;
  hasValidUrl: boolean;
}

export interface ConfidenceBadge {
  type:
    | 'fresco'
    | 'antigo'
    | 'multifonte'
    | 'unifonte'
    | 'com-salario'
    | 'sem-salario'
    | 'descricao-completa'
    | 'descricao-resumida'
    | 'url-valida';
  label: string;
  description: string;
}

/** Dias corridos entre collectedAt e agora. */
function daysSince(collectedAt: Date | string | null): number | null {
  if (!collectedAt) return null;
  const collected = new Date(collectedAt);
  const now = new Date();
  const diffMs = now.getTime() - collected.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function calculateConfidence(job: {
  collectedAt: Date | string | null;
  sourceCount: number;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  url: string;
  title: string;
  company: string;
}): ConfidenceResult {
  const freshnessDays = daysSince(job.collectedAt);
  const hasSalary = job.salaryMin != null || job.salaryMax != null;
  const descriptionChars = job.description.length;
  const hasValidUrl = isValidUrl(job.url);

  // --- Sinais com pontuação ---
  let score = 0;

  // Frescor: até 30 pts. <7 dias = 30; >=30 dias = 0; decai linearmente.
  let freshnessPts = 0;
  if (freshnessDays != null) {
    if (freshnessDays <= 7) freshnessPts = 30;
    else if (freshnessDays >= MAX_FRESHNESS_DAYS) freshnessPts = 0;
    else
      freshnessPts = Math.round(
        (30 * (MAX_FRESHNESS_DAYS - freshnessDays)) / (MAX_FRESHNESS_DAYS - 7),
      );
  }
  score += freshnessPts;

  // Recorrência: até 25 pts. sourceCount >= 3 = 25; 1 = ~8; decai linearmente.
  let recurrencePts = 0;
  if (job.sourceCount >= MIN_SOURCE_COUNT_FOR_FULL) recurrencePts = 25;
  else if (job.sourceCount === 1) recurrencePts = 8;
  else recurrencePts = Math.round((8 + (25 - 8) * (job.sourceCount - 1)) / 2);
  score += recurrencePts;

  // Salário: 15 pts.
  if (hasSalary) score += 15;

  // Descrição: até 20 pts. >=500 chars = 20; <100 = 0; decai linearmente.
  let descriptionPts = 0;
  if (descriptionChars >= MAX_DESCRIPTION_CHARS) descriptionPts = 20;
  else if (descriptionChars < 100) descriptionPts = 0;
  else descriptionPts = Math.round((20 * (descriptionChars - 100)) / (MAX_DESCRIPTION_CHARS - 100));
  score += descriptionPts;

  // URL válida: 10 pts.
  if (hasValidUrl) score += 10;

  score = Math.max(0, Math.min(100, score));

  // --- Label ---
  let label: 'baixa' | 'media' | 'alta';
  if (score >= CONFIDENCE_MEDIUM_THRESHOLD) label = 'alta';
  else if (score >= CONFIDENCE_LOW_THRESHOLD) label = 'media';
  else label = 'baixa';

  // --- Selos ---
  const badges: ConfidenceBadge[] = [];

  if (freshnessDays != null) {
    if (freshnessDays <= 7) {
      badges.push({
        type: 'fresco',
        label: `Publicado há ${freshnessDays} dia(s)`,
        description: 'Vaga recente, menor risco de já estar preenchida',
      });
    } else if (freshnessDays >= 30) {
      badges.push({
        type: 'antigo',
        label: `Há ${freshnessDays} dia(s) no ar`,
        description: 'Vaga antiga, pode não estar mais disponível',
      });
    } else {
      badges.push({
        type: 'antigo',
        label: `Há ${freshnessDays} dia(s) no ar`,
        description: 'Vaga com alguns dias, verifique se ainda está aberta',
      });
    }
  }

  if (job.sourceCount >= MIN_SOURCE_COUNT_FOR_FULL) {
    badges.push({
      type: 'multifonte',
      label: `Vista em ${job.sourceCount} fontes`,
      description: 'Mesma vaga aparecendo em múltiplos canais aumenta a confiança',
    });
  } else if (job.sourceCount === 1) {
    badges.push({
      type: 'unifonte',
      label: 'Apenas 1 fonte',
      description: 'Vaga vista em um único canal',
    });
  }

  if (hasSalary) {
    badges.push({
      type: 'com-salario',
      label: 'Salário informado',
      description: 'Vaga com faixa salarial divulgada',
    });
  } else {
    badges.push({
      type: 'sem-salario',
      label: 'Sem salário',
      description: 'Vaga não divulga faixa salarial',
    });
  }

  if (descriptionChars >= MAX_DESCRIPTION_CHARS) {
    badges.push({
      type: 'descricao-completa',
      label: 'Descrição completa',
      description: 'Vaga com descrição detalhada',
    });
  } else if (descriptionChars < 100) {
    badges.push({
      type: 'descricao-resumida',
      label: 'Descrição resumida',
      description: 'Vaga com pouca informação',
    });
  }

  if (hasValidUrl) {
    badges.push({
      type: 'url-valida',
      label: 'URL válida',
      description: 'Link da vaga acessível',
    });
  }

  return {
    score,
    label,
    badges,
    signals: {
      freshnessDays,
      sourceCount: job.sourceCount,
      hasSalary,
      descriptionChars,
      hasValidUrl,
    },
  };
}

export function getConfidenceColor(
  score: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= CONFIDENCE_MEDIUM_THRESHOLD) return 'default';
  if (score >= CONFIDENCE_LOW_THRESHOLD) return 'secondary';
  return 'destructive';
}

export function confidenceLabelPt(score: number): string {
  if (score >= CONFIDENCE_MEDIUM_THRESHOLD) return 'Alta confiança';
  if (score >= CONFIDENCE_LOW_THRESHOLD) return 'Confiança média';
  return 'Baixa confiança';
}
