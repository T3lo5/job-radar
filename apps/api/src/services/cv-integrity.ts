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
 *
 * A comparação é por TOKEN, não por substring: a versão anterior usava
 * `includes`, então "Go" passava em "Google", "Java" em "JavaScript" e "R" em
 * qualquer texto. Também há grupos de alias para termos que a tokenização
 * separa ("Node.js"/"Node", "C++"/"Cpp", "CI/CD"/"CICD").
 */

/** Evidência de um termo declarado pelo modelo. */
export interface TermEvidence {
  /** Termo como o modelo escreveu. */
  term: string;
  /** Resultado da checagem (presente na evidência de skills). */
  found?: boolean;
  /** Forma efetivamente encontrada no texto, quando difere do termo. */
  matchedAlias?: string;
  /** Índice da fonte em `sources` onde o termo apareceu. */
  sourceIndex?: number;
}

export interface IntegrityResult {
  /** Keywords confirmadas contra as fontes. */
  keywordsAdded: string[];
  /** Keywords que o modelo declarou mas não existem nas fontes (descartadas). */
  droppedKeywords: string[];
  /** Tecnologias afirmadas no CV que não existem nas fontes. Vazio = aprovado. */
  fabricatedSkills: string[];
  /** Evidência das keywords aprovadas (onde e por qual alias). */
  keywordEvidence: TermEvidence[];
  /** Evidência das skills conferidas, aprovadas ou não. */
  skillEvidence: TermEvidence[];
  /** Mensagem pronta para o usuário. */
  warning?: string;
}

/**
 * Grupos de formas equivalentes.
 *
 * Cada linha é o MESMO conceito escrito de jeitos que a tokenização separa
 * (`Node.js` vira `node` + `js`; `C++` vira `cplusplus`). Só entram grupos
 * inequívocos: um alias genérico como "next" faria "Next.js" casar com a
 * palavra inglesa "next", que é exatamente o tipo de falso positivo que este
 * ticket corrige.
 */
const ALIAS_GROUPS: string[][] = [
  ['Node.js', 'NodeJS', 'Node'],
  ['Go', 'Golang'],
  ['React', 'React.js', 'ReactJS'],
  ['Next.js', 'NextJS'],
  ['Vue.js', 'VueJS', 'Vue'],
  ['Express', 'Express.js', 'ExpressJS'],
  ['NestJS', 'Nest.js'],
  ['C#', 'CSharp', 'C-Sharp'],
  ['C++', 'CPlusPlus', 'Cpp'],
  ['.NET', 'dotnet', 'dot net', 'ASP.NET'],
  [
    'CI/CD',
    'CICD',
    'CI-CD',
    'Continuous Integration',
    'Continuous Delivery',
    'Continuous Deployment',
  ],
  ['PostgreSQL', 'Postgres'],
  ['Kubernetes', 'K8s'],
  ['AWS', 'Amazon Web Services'],
  ['GCP', 'Google Cloud', 'Google Cloud Platform'],
];

/** Minúsculas, sem acento. Preserva o suficiente para os compostos. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Troca os compostos por um único token antes de tokenizar.
 *
 * `C++` e `C#` não sobrevivem a um `split` por pontuação (virariam `c`), e
 * `.NET` perderia o ponto que o distingue de "net".
 */
function prepare(value: string): string {
  return fold(value)
    .replace(/(^|[^a-z0-9])c\+\+(?![a-z0-9])/g, '$1 cplusplus ')
    .replace(/(^|[^a-z0-9])c#(?![a-z0-9])/g, '$1 csharp ')
    .replace(/(^|[^a-z0-9])\.net(?![a-z0-9])/g, '$1 dotnet ');
}

/** Tokens Unicode-aware (letras/dígitos já sem acento). */
function tokenize(value: string): string[] {
  return prepare(value).match(/[a-z0-9]+/g) ?? [];
}

interface Candidate {
  tokens: string[];
  /** Forma legível que casou (termo original ou alias do catálogo). */
  alias: string;
}

/** Índice token-sequence → formas equivalentes. */
const ALIAS_LOOKUP: Map<string, Candidate[]> = (() => {
  const map = new Map<string, Candidate[]>();

  for (const group of ALIAS_GROUPS) {
    const candidates = group
      .map((alias) => ({ alias, tokens: tokenize(alias) }))
      .filter((candidate) => candidate.tokens.length > 0);

    for (const candidate of candidates) {
      const key = candidate.tokens.join(' ');
      const existing = map.get(key) ?? [];
      for (const other of candidates) {
        if (!existing.some((e) => e.tokens.join(' ') === other.tokens.join(' '))) {
          existing.push(other);
        }
      }
      map.set(key, existing);
    }
  }

  return map;
})();

function candidatesFor(term: string): Candidate[] {
  const base = tokenize(term);
  if (base.length === 0) return [];

  const candidates: Candidate[] = [{ tokens: base, alias: term.trim() }];
  for (const alias of ALIAS_LOOKUP.get(base.join(' ')) ?? []) {
    if (!candidates.some((c) => c.tokens.join(' ') === alias.tokens.join(' '))) {
      candidates.push(alias);
    }
  }
  return candidates;
}

/** Posição da primeira ocorrência de `needle` em `haystack`, ou -1. */
function indexOfSequence(haystack: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;

  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

interface TraceResult {
  found: boolean;
  matchedAlias?: string;
  sourceIndex?: number;
}

function traceTerm(term: string, sources: string[][]): TraceResult {
  const candidates = candidatesFor(term);
  if (candidates.length === 0) return { found: false };

  // Termo de 1 caractere é ruído: "R" aparecia em qualquer texto. Antes a
  // guarda era no texto normalizado; com tokens, o equivalente é o tamanho da
  // forma canônica.
  const canonical = candidates[0].tokens.join('');
  if (canonical.length < 2) return { found: false };

  for (const candidate of candidates) {
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      if (indexOfSequence(sources[sourceIndex], candidate.tokens) >= 0) {
        return { found: true, matchedAlias: candidate.alias, sourceIndex };
      }
    }
  }

  return { found: false };
}

/**
 * Monta o texto de referência com tudo que é verdade sobre o candidato.
 * `sources` recebe o CV original e o contexto do perfil.
 */
export function buildKnownTerms(sources: string[]): string {
  return sources.filter(Boolean).map(fold).join('\n');
}

/** Existe o termo em alguma fonte? Compara por token/fronteira de palavra. */
export function isTraceable(term: string, knownTerms: string): boolean {
  return traceTerm(term, [tokenize(knownTerms)]).found;
}

export function checkCvIntegrity(input: {
  skillsClaimed?: string[];
  keywordsAdded?: string[];
  sources: string[];
}): IntegrityResult {
  const knownSources = input.sources.filter(Boolean).map(tokenize);

  const skillEvidence: TermEvidence[] = (input.skillsClaimed ?? [])
    .filter((skill) => skill?.trim())
    .map((skill) => {
      const trace = traceTerm(skill, knownSources);
      return {
        term: skill,
        found: trace.found,
        matchedAlias: trace.found ? trace.matchedAlias : undefined,
        sourceIndex: trace.found ? trace.sourceIndex : undefined,
      };
    });

  const fabricatedSkills = skillEvidence.filter((e) => !e.found).map((e) => e.term);

  const keywordEvidence: TermEvidence[] = [];
  const droppedKeywords: string[] = [];
  for (const keyword of input.keywordsAdded ?? []) {
    if (!keyword?.trim()) continue;
    const trace = traceTerm(keyword, knownSources);
    if (trace.found) {
      keywordEvidence.push({
        term: keyword,
        matchedAlias: trace.matchedAlias,
        sourceIndex: trace.sourceIndex,
      });
    } else {
      droppedKeywords.push(keyword);
    }
  }

  let warning: string | undefined;
  if (droppedKeywords.length > 0) {
    warning =
      `Estas palavras-chave não existem no seu perfil nem no CV original e foram ` +
      `removidas do resultado: ${droppedKeywords.join(', ')}.`;
  }

  return {
    keywordsAdded: keywordEvidence.map((e) => e.term),
    droppedKeywords,
    fabricatedSkills,
    keywordEvidence,
    skillEvidence,
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
