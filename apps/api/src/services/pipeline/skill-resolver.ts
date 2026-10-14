/**
 * Resolução de skills em lote.
 *
 * A extração fazia, por skill: um `findFirst({ mode: 'insensitive' })` e um
 * `jobSkill.upsert`. Uma vaga com 20 skills virava 40 queries sequenciais —
 * e, pior, o passo roda uma vez por vaga na fila.
 *
 * Aqui são 3 queries para quantas skills a vaga tiver.
 */

/**
 * Só o que a resolução usa, e não o delegate inteiro do Prisma.
 *
 * O `ProcessingContext.prisma` é um adaptador com um punhado de métodos, e ele
 * satisfaz esta interface. Tipar pelo delegate completo obrigaria o adaptador a
 * expor `findUniqueOrThrow`, `createManyAndReturn` e cia — que a extração nunca
 * chama.
 */
export interface SkillResolverDb {
  findMany: (args: {
    where: { name: { in: string[]; mode: 'insensitive' } };
    select: { id: true; name: true };
  }) => Promise<Array<{ id: string; name: string }>>;
  createMany: (args: {
    data: Array<{ name: string; aliases: string[] }>;
    skipDuplicates: boolean;
  }) => Promise<{ count: number }>;
}

/** `Skill.name` é @unique, mas o Postgres compara texto com caixa. */
export function skillKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Remove vazios e repetidos ignorando caixa.
 *
 * Não é só economia: se 'React' e 'react' entrassem no mesmo `createMany`, o
 * `skipDuplicates` não impediria nada — a constraint é case-sensitive — e o
 * catálogo ganharia a duplicata que o passo inteiro existe para evitar.
 *
 * Mantém a primeira grafia vista: a entrada mais comum costuma ser a canônica.
 */
export function dedupeSkillNames(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = (raw ?? '').trim();
    const key = skillKey(name);
    if (key.length === 0 || seen.has(key)) continue;
    seen.set(key, name);
  }
  return [...seen.values()];
}

export interface ResolvedSkill {
  id: string;
  name: string;
}

/**
 * Resolve nomes de skill para IDs, criando as que faltarem.
 *
 * O mapa devolvido é indexado pela chave normalizada (`skillKey`), e não pelo
 * nome literal. Assim o chamador localiza `React` e `react` com a mesma
 * chave, que é o ponto: a comparação no resto do sistema já normaliza
 * (ver `normalizeSkillName` no engine de matching), e aqui isso deixa de ser
 * uma convenção e passa a ser garantido na escrita.
 *
 * Queries: 1 findMany + 1 createMany (se faltar algo) + 1 findMany para os
 * IDs das criadas. `createMany` não devolve os IDs, daí a segunda leitura.
 */
export async function resolveSkills(
  skill: SkillResolverDb,
  names: string[],
): Promise<Map<string, ResolvedSkill>> {
  const resolvidos = new Map<string, ResolvedSkill>();
  const unicos = dedupeSkillNames(names);
  if (unicos.length === 0) return resolvidos;

  const existentes = await skill.findMany({
    where: { name: { in: unicos, mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  for (const skill of existentes) {
    // Se o catálogo já estiver sujo (React e react), a chave colide e o
    // primeiro vence. Registrar os dois não ajudaria ninguém.
    const key = skillKey(skill.name);
    if (!resolvidos.has(key)) resolvidos.set(key, { id: skill.id, name: skill.name });
  }

  const faltando = unicos.filter((name) => !resolvidos.has(skillKey(name)));
  if (faltando.length === 0) return resolvidos;

  await skill.createMany({
    data: faltando.map((name) => ({ name, aliases: [] })),
    skipDuplicates: true,
  });

  const criadas = await skill.findMany({
    where: { name: { in: faltando, mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  for (const skill of criadas) {
    const key = skillKey(skill.name);
    if (!resolvidos.has(key)) resolvidos.set(key, { id: skill.id, name: skill.name });
  }

  return resolvidos;
}
