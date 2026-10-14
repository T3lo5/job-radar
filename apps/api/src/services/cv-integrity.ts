/**
 * Verificação da Regra de Ouro: "a IA não inventa".
 *
 * Até aqui a regra vivia só no prompt (cv-optimizer.ts, regra 1: "NEVER
 * invent"). Isso não é garantia: um modelo pode alucinar, e o texto ia direto
 * para o PDF que o candidato envia ao recrutador.
 *
 * A verificação é determinística e roda do nosso lado: pedimos ao modelo que
 * declare quais tecnologias ele atribui ao candidato (`skillsClaimed`) e
 * conferimos cada uma contra o que existe de fato no perfil e no CV original.
 *
 * Duas checagens, com consequências diferentes:
 * - `skillsClaimed`: rejeição. Uma tecnologia inventada no corpo do CV é a
 *   própria fraude que a regra existe para impedir, e o usuário não tem como
 *   reaproveitar o resultado.
 * - `keywordsAdded`: apenas aviso, e o termo é removido do resultado. Um termo
 *   solto na lista de palavras-chave não chega ao PDF, e bloquear o usuário por
 *   isso seria exagero.
 */

export interface IntegrityResult {
  /** Keywords confirmadas contra as fontes. */
  keywordsAdded: string[];
  /** Keywords que o modelo declarou mas não existem nas fontes (descartadas). */
  droppedKeywords: string[];
  /** Tecnologias afirmadas no CV que não existem nas fontes. Vazio = aprovado. */
  fabricatedSkills: string[];
  /** Mensagem pronta para o usuário. */
  warning?: string;
}

/** Normaliza para comparar sem diferença de caixa, acento ou pontuação. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+#./ -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Monta o texto de referência com tudo que é verdade sobre o candidato.
 * `sources` recebe o CV original e o contexto do perfil.
 */
export function buildKnownTerms(sources: string[]): string {
  return normalize(sources.filter(Boolean).join('\n'));
}

/** Existe o termo em alguma fonte? Compara por fronteira de palavra. */
export function isTraceable(term: string, knownTerms: string): boolean {
  const normalized = normalize(term);
  if (normalized.length < 2) return false;

  if (knownTerms.includes(normalized)) return true;

  // "node.js" também precisa casar com "Node" e vice-versa.
  const variants = [
    normalized,
    normalized.replace(/\.(js|ts)$/g, ''),
    normalized.replace(/[^a-z0-9+#/ ]/g, ''),
  ].filter((v) => v.length >= 2);

  return variants.some((v) => knownTerms.includes(v));
}

export function checkCvIntegrity(input: {
  skillsClaimed?: string[];
  keywordsAdded?: string[];
  sources: string[];
}): IntegrityResult {
  const knownTerms = buildKnownTerms(input.sources);

  const fabricatedSkills = (input.skillsClaimed ?? [])
    .filter((skill) => skill?.trim())
    .filter((skill) => !isTraceable(skill, knownTerms));

  const verifiedKeywords: string[] = [];
  const droppedKeywords: string[] = [];
  for (const keyword of input.keywordsAdded ?? []) {
    if (!keyword?.trim()) continue;
    if (isTraceable(keyword, knownTerms)) verifiedKeywords.push(keyword);
    else droppedKeywords.push(keyword);
  }

  let warning: string | undefined;
  if (droppedKeywords.length > 0) {
    warning =
      `Estas palavras-chave não existem no seu perfil nem no CV original e foram ` +
      `removidas do resultado: ${droppedKeywords.join(', ')}.`;
  }

  return {
    keywordsAdded: verifiedKeywords,
    droppedKeywords,
    fabricatedSkills,
    warning,
  };
}

/** Mensagem de erro quando a Regra de Ouro é violada. */
export function fabricationErrorMessage(fabricated: string[]): string {
  return (
    `A otimização tentou atribuir ${fabricated.join(', ')} a você, mas isso não ` +
    'consta no seu perfil nem no CV original. Um CV otimizado não pode afirmar ' +
    'experiência que você não tem — isso prejudica a candidatura em vez de ' +
    'ajudar. Revise seu perfil e tente de novo.'
  );
}
