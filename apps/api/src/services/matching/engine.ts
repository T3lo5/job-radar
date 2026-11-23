import type {
  Job,
  Profile,
  Seniority,
  Skill,
  ProfileSkill,
  ProfileLanguage,
} from '../../generated/prisma/index.js';
import type { MatchBreakdown, SkillEvidence } from '@job-radar/shared';

export interface MatchResult {
  score: number;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  partialSkills: string[];
  missingSkills: string[];
  recommendation: 'STRONG_APPLY' | 'APPLY' | 'CONSIDER' | 'SKIP';
}

const WEIGHTS = {
  technologies: 0.4,
  experience: 0.22,
  seniority: 0.16,
  location: 0.1,
  // Sobrepõe conceitualmente a technologies (ambos olham skills), então
  // recebe menos peso.
  cloudDevOps: 0.07,
  languages: 0.05,
} as const;

/**
 * Score neutro para "não temos sinal".
 *
 * Antes o fallback era 0 em alguns criterios (perfil sem skills recebia 0/20
 * em experiencia), o que punia o candidato por informação faltando e jogava
 * todo mundo para SKIP. 50 = "não sei", e não sabermos não é o mesmo que
 * estar errado.
 */
const NEUTRAL_SCORE = 50;

const CLOUD_DEVOPS_KEYWORDS = [
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'docker',
  'kubernetes',
  'k8s',
  'terraform',
  'ci/cd',
  'github actions',
  'jenkins',
  'circleci',
  'ansible',
  'prometheus',
  'grafana',
  'elk',
  'helm',
  'ecs',
  'eks',
  'lambda',
];

/**
 * Grafias e abreviações da MESMA skill.
 *
 * O primeiro termo do grupo é a forma canônica. Isto produz match cheio
 * (`ALIAS`), não parcial: `JS` é `JavaScript`, não uma tecnologia vizinha.
 *
 * A lista é fechada de propósito. Comparar prefixos (`startsWith`/`includes`)
 * é o que fazia `java` casar com `javascript` e `react` com `r`; qualquer
 * termo novo aqui precisa ser uma grafia inequívoca, nunca um prefixo curto.
 */
const SYNONYM_GROUPS: ReadonlyArray<readonly string[]> = [
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['postgresql', 'postgres', 'psql'],
  ['nodejs', 'node'],
  ['react', 'reactjs'],
  ['vue', 'vuejs'],
  ['kubernetes', 'k8s'],
  ['aws', 'amazonwebservices'],
  ['gcp', 'googlecloud'],
  ['githubactions', 'ghactions'],
  ['cicd', 'continuousintegration', 'continuousdelivery'],
  ['csharp', 'c#'],
];

/**
 * Tecnologias vizinhas: valem meio ponto (`GROUP`).
 *
 * A comparação é por igualdade do nome canônico dentro do grupo. A versão
 * anterior usava `includes` nos dois sentidos, então o grupo `['java', ...]`
 * aceitava `javascript` porque `'javascript'.includes('java')` — e o perfil
 * ganhava crédito por uma skill que não tinha.
 *
 * Os membros dos grupos devem estar na forma canônica (já passada por
 * `SYNONYM_GROUPS`), senão `k8s` ou `js` nunca seriam encontrados aqui.
 */
const RELATED_GROUPS: ReadonlyArray<readonly string[]> = [
  ['react', 'reactnative', 'nextjs', 'gatsby', 'remix'],
  ['vue', 'nuxt', 'vuex'],
  ['angular', 'rxjs'],
  ['nodejs', 'express', 'fastify', 'nestjs', 'koa'],
  ['python', 'django', 'flask', 'fastapi'],
  ['java', 'spring', 'springboot', 'kotlin'],
  ['javascript', 'typescript', 'nodejs', 'react', 'vue', 'angular'],
  ['postgresql', 'mysql', 'mariadb', 'sql'],
  ['mongodb', 'dynamodb', 'couchdb'],
  ['redis', 'memcached', 'elasticsearch'],
  ['docker', 'kubernetes', 'helm'],
  ['aws', 'gcp', 'azure', 'cloud'],
];

const SENIORITY_LEVELS: Record<Seniority, number> = {
  UNKNOWN: 3,
  INTERN: 1,
  JUNIOR: 2,
  MID: 3,
  SENIOR: 4,
  SPECIALIST: 5,
  LEAD: 5,
};

interface JobWithSkills extends Job {
  skills?: Array<{ skill: Skill; required: boolean }>;
}

interface ProfileWithRelations extends Profile {
  skills?: Array<ProfileSkill & { skill: Skill }>;
  languages?: ProfileLanguage[];
}

/**
 * Índice das skills do perfil.
 *
 * `byNormalized` responde "é o mesmo nome?" (`Node.js` = `Node`) e
 * `byCanonical` responde "é a mesma skill escrita de outro jeito?" — inclui as
 * grafias de `SYNONYM_GROUPS` e os aliases declarados no catálogo.
 */
interface ProfileSkillLookup {
  byNormalized: Map<string, string>;
  byCanonical: Map<string, string>;
}

export function computeMatchScore(job: JobWithSkills, profile: ProfileWithRelations): MatchResult {
  const matchedSkills: string[] = [];
  const partialSkills: string[] = [];
  const missingSkills: string[] = [];
  const skillEvidence: SkillEvidence[] = [];

  // Só estas skills podem produzir um match sinônimo — ver
  // `collectRelevantSkills`. Trazer o catálogo inteiro para cá custava uma
  // query por vaga no pipeline e uma por requisição em /api/match/evaluate,
  // para varrer linhas que iam ser descartadas uma a uma.
  const relevantSkills = collectRelevantSkills(job, profile);
  const lookup = buildProfileLookup(profile);

  const techScore = computeTechnologiesScore(
    job,
    relevantSkills,
    lookup,
    matchedSkills,
    partialSkills,
    missingSkills,
    skillEvidence,
  );
  // O cloud roda DEPOIS do score de tecnologias e mutava matched/partial, o que
  // colocava a mesma skill em duas listas ao mesmo tempo ('Go' aparecia em
  // partial e em missing) e devolvia skills que não tinham-spanhado o score.
  // Aqui o cloud só classifica em lista própria, sem tocar nas anteriores.
  const cloudSkills = job.skills?.map((js) => js.skill) ?? [];
  const cloudScore = computeCloudDevOpsScore(relevantSkills, cloudSkills, lookup);
  const expScore = computeExperienceScore(profile, matchedSkills.length);
  const seniorityScore = computeSeniorityScore(job, profile);
  const locationScore = computeLocationScore(job, profile);
  const langScore = computeLanguageScore(job, profile);

  const breakdown: MatchBreakdown = {
    technologies: techScore,
    experience: expScore,
    seniority: seniorityScore,
    location: locationScore,
    cloudDevOps: cloudScore,
    languages: langScore,
    skillEvidence,
  };

  const totalScore = Math.round(
    techScore * WEIGHTS.technologies +
      expScore * WEIGHTS.experience +
      seniorityScore * WEIGHTS.seniority +
      locationScore * WEIGHTS.location +
      cloudScore * WEIGHTS.cloudDevOps +
      langScore * WEIGHTS.languages,
  );

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    breakdown,
    matchedSkills,
    partialSkills,
    missingSkills,
    recommendation: getRecommendation(totalScore),
  };
}

function computeTechnologiesScore(
  job: JobWithSkills,
  relevantSkills: Skill[],
  lookup: ProfileSkillLookup,
  matched: string[],
  partial: string[],
  missing: string[],
  evidence: SkillEvidence[],
): number {
  const jobSkills = job.skills?.map((js) => js.skill).filter(Boolean) ?? [];

  if (jobSkills.length === 0) return NEUTRAL_SCORE;

  let earnedWeight = 0;

  for (const jobSkill of jobSkills) {
    const classification = classifyJobSkill(jobSkill, relevantSkills, lookup);

    if (classification.points === 1) {
      earnedWeight += 1;
      matched.push(jobSkill.name);
    } else if (classification.points > 0) {
      earnedWeight += 0.5;
      partial.push(jobSkill.name);
    } else {
      missing.push(jobSkill.name);
    }

    if (classification.evidence) evidence.push(classification.evidence);
  }

  return Math.round((earnedWeight / jobSkills.length) * 100);
}

interface SkillClassification {
  /** 1 = exata/sinônimo; 0.5 = relacionada; 0 = ausente. */
  points: number;
  evidence: SkillEvidence | null;
}

/**
 * Classifica uma skill da vaga contra o perfil, na ordem que importa:
 * nome igual, sinônimo declarado, tecnologia vizinha. Parar na primeira evita
 * que uma skill apareça como exata e relacionada ao mesmo tempo.
 */
function classifyJobSkill(
  jobSkill: Skill,
  relevantSkills: Skill[],
  lookup: ProfileSkillLookup,
): SkillClassification {
  const normalizedName = normalizeSkillName(jobSkill.name);

  if (lookup.byNormalized.has(normalizedName)) {
    return {
      points: 1,
      evidence: { skill: jobSkill.name, reason: 'EXACT' },
    };
  }

  // Mesma skill em grafia conhecida (`JS` × `JavaScript`, `Postgres` ×
  // `PostgreSQL`). O nome normalizado difere, então não caiu no exato acima.
  const canonicalVia = lookup.byCanonical.get(canonicalSkillName(jobSkill.name));
  if (canonicalVia) {
    return {
      points: 1,
      evidence: { skill: jobSkill.name, reason: 'ALIAS', via: canonicalVia },
    };
  }

  const aliasVia = findSynonymMatch(jobSkill, relevantSkills, lookup);
  if (aliasVia) {
    return {
      points: 1,
      evidence: { skill: jobSkill.name, reason: 'ALIAS', via: aliasVia },
    };
  }

  const groupVia = findRelatedMatch(jobSkill, lookup);
  if (groupVia) {
    return {
      points: 0.5,
      evidence: { skill: jobSkill.name, reason: 'GROUP', via: groupVia },
    };
  }

  return { points: 0, evidence: null };
}

function computeExperienceScore(profile: ProfileWithRelations, matchedSkillCount: number): number {
  const skills = profile.skills ?? [];
  // Sem skills cadastradas não há como avaliar experiência: neutro, não zero.
  if (skills.length === 0) return NEUTRAL_SCORE;

  const totalYears = skills.reduce((sum: number, ps) => sum + (ps.yearsExp ?? 0), 0);
  const avgYears = totalYears / skills.length;
  const yearsScore = Math.min(100, (avgYears / 3) * 100);
  const skillBonus = Math.min(20, matchedSkillCount * 2);

  return Math.min(100, Math.round(yearsScore + skillBonus));
}

function computeSeniorityScore(job: Job, profile: Profile): number {
  // Perfil sem senioridade (ou 'UNKNOWN') não tem nível para comparar.
  if (!profile.seniority || profile.seniority === 'UNKNOWN') return NEUTRAL_SCORE;

  const jobLevel = jobSeniorityLevel(job);

  // Vaga sem senioridade nem sinal no título: não há como dizer que o
  // candidato está acima ou abaixo. O código antigo assumia MID, o que
  // penalizava todo perfil sênior em vagas que simplesmente não declararam o
  // nível — informação ausente virava evidência contra o candidato.
  if (jobLevel === null) return 100;

  const profileLevel = SENIORITY_LEVELS[profile.seniority];

  const diff = Math.abs(profileLevel - jobLevel);
  if (diff === 0) return 100;
  if (diff === 1) return 75;
  if (diff === 2) return 50;
  if (diff === 3) return 25;
  return 10;
}

/**
 * Nível de senioridade da vaga.
 *
 * `job.seniority`, extraído da descrição, é a fonte primária; o título só é
 * consultado quando o campo está ausente. Antes, um título sem "sênior" virava
 * MID mesmo com `seniority: JUNIOR` preenchido — o campo era ignorado.
 *
 * `null` significa "sem sinal", diferente de MID (3).
 */
function jobSeniorityLevel(job: Job): number | null {
  if (job.seniority && job.seniority !== 'UNKNOWN') {
    return SENIORITY_LEVELS[job.seniority];
  }

  const titleLower = job.title.toLowerCase();

  if (
    titleLower.includes('estagiár') ||
    titleLower.includes('intern') ||
    titleLower.includes('trainee')
  ) {
    return 1;
  }
  if (titleLower.includes('júnior') || titleLower.includes('junior') || titleLower.includes('jr')) {
    return 2;
  }
  if (titleLower.includes('sênior') || titleLower.includes('senior') || titleLower.includes('sr')) {
    return 4;
  }
  if (
    titleLower.includes('lead') ||
    titleLower.includes('principal') ||
    titleLower.includes('staff')
  ) {
    return 5;
  }

  return null;
}

function computeLocationScore(job: Job, profile: Profile): number {
  if (job.remote === 'REMOTE') return 100;
  if (job.remote === 'ANY') return 90;
  if (!profile.location || !job.location) return 50;

  const jobLoc = job.location.toLowerCase();
  const profileLoc = profile.location.toLowerCase();

  if (jobLoc.includes(profileLoc) || profileLoc.includes(jobLoc)) return 100;

  const brazilCities = [
    'são paulo',
    'rio',
    'belo horizonte',
    'curitiba',
    'porto alegre',
    'brasília',
    'florianópolis',
    'recife',
    'salvador',
  ];
  const jobIsBR =
    brazilCities.some((city) => jobLoc.includes(city)) ||
    jobLoc.includes('brazil') ||
    jobLoc.includes('brasil');
  const profileIsBR =
    brazilCities.some((city) => profileLoc.includes(city)) ||
    profileLoc.includes('brazil') ||
    profileLoc.includes('brasil');

  if (jobIsBR && profileIsBR) return 70;
  return 30;
}

function computeCloudDevOpsScore(
  relevantSkills: Skill[],
  jobSkills: Skill[],
  lookup: ProfileSkillLookup,
): number {
  // Comparação por igualdade/prefixo. A versão anterior aceitava `includes`
  // nos dois sentidos, o que classificava 'Go' como cloud porque
  // 'google cloud'.includes('go') — e 'R' porque 'terraform'.includes('r').
  const CLOUD_SET = new Set(CLOUD_DEVOPS_KEYWORDS.map(normalizeSkillName));
  const cloudSkills = jobSkills.filter((skill) => {
    const norm = normalizeSkillName(skill.name);
    if (!norm) return false;
    if (CLOUD_SET.has(norm)) return true;
    return [...CLOUD_SET].some((kw) => norm.startsWith(kw));
  });

  if (cloudSkills.length === 0) return 70;

  let matchedCount = 0;
  for (const skill of cloudSkills) {
    // Só match cheio conta aqui: relacionada (docker↔kubernetes) já recebe
    // meio ponto em technologies e não deve inflar o critério de cloud.
    if (classifyJobSkill(skill, relevantSkills, lookup).points === 1) {
      matchedCount++;
    }
  }

  return Math.round((matchedCount / cloudSkills.length) * 100);
}

function computeLanguageScore(job: Job, profile: ProfileWithRelations): number {
  const languages = profile.languages ?? [];
  if (languages.length === 0) return NEUTRAL_SCORE;

  const hasEnglish = languages.some(
    (l) =>
      l.language.toLowerCase().includes('english') || l.language.toLowerCase().includes('inglês'),
  );

  const titleLower = job.title.toLowerCase();
  const requiresEnglish =
    !titleLower.includes('brasil') &&
    !titleLower.includes('brazil') &&
    !titleLower.includes('português');

  if (requiresEnglish && hasEnglish) return 100;
  if (requiresEnglish && !hasEnglish) return 40;
  return 80;
}

function getRecommendation(score: number): MatchResult['recommendation'] {
  if (score >= 85) return 'STRONG_APPLY';
  if (score >= 70) return 'APPLY';
  if (score >= 50) return 'CONSIDER';
  return 'SKIP';
}

/**
 * Normaliza o nome de uma skill para comparação.
 *
 * O ponto é preservar os símbolos que carregam significado: a versão anterior
 * removia tudo que não fosse alfanumérico, então 'C++' e 'C#' viravam os dois
 * 'c' — e um perfil de C# pontuava 100% numa vaga de C++. Também nunca deve
 * devolver string vazia ('JS' virava ''), que casaria com qualquer outra vazia.
 */
function normalizeSkillName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === '') return '';

  const stripped = lower
    .replace(/^java\s*script$/, 'javascript')
    .replace(/^react\s*native$/, 'react')
    .replace(/\.js$/, '')
    .replace(/\.ts$/, '')
    .replace(/[^a-z0-9+#]/g, '');

  // Nunca devolver vazio: a comparação seria por substring com qualquer outra
  // skill vazia. Usa a forma original como identificador estável.
  return stripped === '' ? lower.replace(/\s+/g, '') : stripped;
}

/**
 * Forma canônica: normalização + grafias conhecidas da mesma skill.
 *
 * `js` → `javascript`, `postgres` → `postgresql`. Nunca aproxima skills
 * distintas: só o que está declarado em `SYNONYM_GROUPS`.
 */
function canonicalSkillName(name: string): string {
  const normalized = normalizeSkillName(name);
  return CANONICAL_BY_ALIAS.get(normalized) ?? normalized;
}

const CANONICAL_BY_ALIAS = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const canonical = group[0];
  for (const term of group) CANONICAL_BY_ALIAS.set(term, canonical);
}

/**
 * Índice das skills do perfil. `byCanonical` inclui os aliases declarados no
 * catálogo (coluna `aliases`), porque eles são a fonte de sinônimo por skill.
 */
function buildProfileLookup(profile: ProfileWithRelations): ProfileSkillLookup {
  const byNormalized = new Map<string, string>();
  const byCanonical = new Map<string, string>();

  for (const { skill } of profile.skills ?? []) {
    if (!skill) continue;

    const normalized = normalizeSkillName(skill.name);
    if (normalized && !byNormalized.has(normalized)) {
      byNormalized.set(normalized, skill.name);
    }

    for (const term of [skill.name, ...(skill.aliases ?? [])]) {
      const canonical = canonicalSkillName(term);
      if (canonical && !byCanonical.has(canonical)) {
        byCanonical.set(canonical, skill.name);
      }
    }
  }

  return { byNormalized, byCanonical };
}

/**
 * Conjunto mínimo que pode gerar match sinônimo.
 *
 * `findSynonymMatch` só produz resposta a partir de duas coisas: os aliases da
 * própria skill da vaga, e os aliases das skills do perfil. Qualquer outra linha
 * do catálogo é percorrida e descartada — e como o filtro é
 * `lookup.byNormalized.has(...)`, ela nem chega a ter os aliases lidos.
 *
 * Por isso o recorte é UNION das skills da vaga com as do perfil, e não só as
 * do perfil: sem a skill da vaga na lista, `findSynonymMatch` não a encontraria
 * por id e devolveria nulo em silencio, perdendo o match que ela mesma faria.
 *
 * Única premissa: os aliases vêm da cópia que veio na query da vaga, não de uma
 * segunda leitura do catálogo. São a mesma linha do banco — `include: { skill:
 * true }` carrega uma vez — então os aliases são idênticos. Só divergiriam se
 * alguém montasse dois objetos com o mesmo id e aliases diferentes, que é
 * justamente o que um teste ingênuo faz, produzindo uma "divergência" que não
 * existe em produção.
 */
function collectRelevantSkills(job: JobWithSkills, profile: ProfileWithRelations): Skill[] {
  const porId = new Map<string, Skill>();
  for (const { skill } of job.skills ?? []) {
    if (skill?.id) porId.set(skill.id, skill);
  }
  for (const { skill } of profile.skills ?? []) {
    if (skill?.id) porId.set(skill.id, skill);
  }
  return [...porId.values()];
}

/**
 * Sinônimo: a skill da vaga e a do perfil são a MESMA skill escrita de outro
 * jeito. Devolve o nome da skill do perfil que casou, para a evidência.
 */
function findSynonymMatch(
  targetSkill: Skill,
  relevantSkills: Skill[],
  lookup: ProfileSkillLookup,
): string | null {
  const target = relevantSkills.find((s) => s.id === targetSkill.id);
  if (!target) return null;

  for (const alias of target.aliases ?? []) {
    const via = lookup.byCanonical.get(canonicalSkillName(alias));
    if (via) return via;
  }

  const targetCanonical = canonicalSkillName(targetSkill.name);
  if (!targetCanonical) return null;

  for (const skill of relevantSkills) {
    if (!lookup.byNormalized.has(normalizeSkillName(skill.name))) continue;
    if ((skill.aliases ?? []).some((a) => canonicalSkillName(a) === targetCanonical)) {
      return skill.name;
    }
  }

  return null;
}

/**
 * Tecnologia vizinha dentro de um grupo explícito. Devolve o nome da skill do
 * perfil que casou, ou `null`.
 *
 * Sem `includes`: o casamento é por igualdade do nome canônico. É o que impede
 * `java` de casar com `javascript` e `react` de casar com `r`.
 */
function findRelatedMatch(targetSkill: Skill, lookup: ProfileSkillLookup): string | null {
  const targetCanonical = canonicalSkillName(targetSkill.name);
  if (!targetCanonical) return null;

  for (const group of RELATED_GROUPS) {
    if (!group.includes(targetCanonical)) continue;

    for (const member of group) {
      if (member === targetCanonical) continue;
      const via = lookup.byCanonical.get(member);
      if (via) return via;
    }
  }

  return null;
}
