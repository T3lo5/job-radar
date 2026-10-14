import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '../../generated/prisma/index.js';
import { resolveSkills, dedupeSkillNames } from './skill-resolver.js';

/**
 * O teste de unidade prova a contagem de queries e a lógica, mas a duplicata de
 * skill é um problema de banco: `skills.name` é @unique e o Postgres compara
 * texto com caixa. Nenhuma dupla reproduz isso sem mentir sobre o comportamento.
 *
 * Aqui a pergunta é direta: depois de resolver, existem duas linhas com o mesmo
 * nome ignorando caixa?
 */
// Sem log de query: com os testes de integração, cada statement virava
// ruído na saída e enterrava a asserção que falhou.
const prisma = new PrismaClient({ log: ['error'] });

// Skills de teste com prefixo próprio, para nunca colidir com o catálogo real.
const PREFIXO = '__test_resolver_';
const nomes = (...ls: string[]) => ls.map((l) => `${PREFIXO}${l}`);

// `mode: 'insensitive'` em todo filtro de prefixo: o teste cria de propósito
// uma skill em CAIXA ALTA, e um startsWith case-sensitive simplesmente não a
// enxergaria — o teste passaria por não ter encontrado nada.
const COM_PREFIXO = { startsWith: PREFIXO, mode: 'insensitive' } as const;

async function limpar() {
  // JobSkill tem onDelete: Cascade, então as linhas soltas saem junto.
  await prisma.skill.deleteMany({ where: { name: COM_PREFIXO } });
}

async function duplicatas() {
  const rows = await prisma.skill.findMany({
    where: { name: COM_PREFIXO },
    select: { name: true },
  });
  const porChave = new Map<string, string[]>();
  for (const { name } of rows) {
    const k = name.toLowerCase();
    porChave.set(k, [...(porChave.get(k) ?? []), name]);
  }
  return [...porChave.entries()].filter(([, v]) => v.length > 1);
}

beforeAll(async () => {
  await prisma.$connect();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await prisma.$disconnect();
});

beforeEach(limpar);

describe('resolveSkills contra Postgres', () => {
  it('cria a skill e devolve o ID', async () => {
    const [react] = nomes('react');
    const r = await resolveSkills(prisma.skill, [react]);

    const skill = r.get('__test_resolver_react');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe(react);
    expect(await prisma.skill.count({ where: { id: skill!.id } })).toBe(1);
  });

  it('reaproveita a skill existente em vez de criar outra', async () => {
    const [react] = nomes('react');
    const primeira = await resolveSkills(prisma.skill, [react]);
    const segunda = await resolveSkills(prisma.skill, [react]);

    expect(segunda.get('__test_resolver_react')?.id).toBe(
      primeira.get('__test_resolver_react')!.id,
    );
    expect(await prisma.skill.count({ where: { name: COM_PREFIXO } })).toBe(1);
  });

  it('encontra a skill existente mesmo com caixa diferente (ILIKE real)', async () => {
    const [react] = nomes('react');
    await resolveSkills(prisma.skill, [react]);

    // A busca case-insensitive e o que impede a duplicata. Com `equals`
    // exato, isto criaria '__test_resolver_REACT' do lado do 'react'.
    const r = await resolveSkills(prisma.skill, [react.toUpperCase()]);
    expect(r.get('__test_resolver_react')).toBeDefined();
    expect(await duplicatas()).toEqual([]);
  });

  it('lote com variacoes de caixa nao cria duplicatas', async () => {
    const [react, node] = nomes('react', 'node');
    const entrada = [react, react.toUpperCase(), react.toLowerCase(), node, node.toUpperCase()];

    const r = await resolveSkills(prisma.skill, entrada);

    expect(r.size).toBe(2);
    expect(await duplicatas()).toEqual([]);
    expect(await prisma.skill.count({ where: { name: COM_PREFIXO } })).toBe(2);
  });

  it('simula o caminho antigo e mostra que ele duplica', async () => {
    // Este e o comportamento que o lote substituiu: nome novo entrando pelo
    // `create` sem consulta case-insensitive antes. Serve de controle: se o
    // catalogo real encher de duplicata, a causa volta a ser isto.
    const [react] = nomes('react');
    await prisma.skill.create({ data: { name: react, aliases: [] } });

    // O passo antigo faria isto ao receber a mesma skill em caixa diferente
    // de uma vaga que passou pelo filtro em outro momento.
    await prisma.skill.createMany({
      data: [{ name: react.toUpperCase(), aliases: [] }],
      skipDuplicates: true,
    });

    const achadas = await duplicatas();
    expect(achadas.length).toBe(1); // skipDuplicates nao segurou
    expect(achadas[0][1]).toContain(react);
  });

  it('resolveSkills NAO produz essa duplicata no mesmo cenario', async () => {
    const [react] = nomes('react');
    await resolveSkills(prisma.skill, [react]);
    await resolveSkills(prisma.skill, [react.toUpperCase()]);

    expect(await duplicatas()).toEqual([]);
  });

  it('preserva simbolos: C++ e C# sao skills distintas', async () => {
    const [cpp, cs] = nomes('c++', 'c#');
    const r = await resolveSkills(prisma.skill, [cpp, cs]);

    expect(r.size).toBe(2);
    expect(await prisma.skill.count({ where: { name: COM_PREFIXO } })).toBe(2);
  });

  it('lote grande resolve em numero constante de queries', async () => {
    const muitas = Array.from({ length: 60 }, (_, i) => `${PREFIXO}skill${i}`);

    let q = 0;
    const counted = {
      findMany: (a: any) => {
        q++;
        return prisma.skill.findMany(a as any);
      },
      createMany: (a: any) => {
        q++;
        return prisma.skill.createMany(a as any);
      },
    } as unknown as typeof prisma.skill;

    await resolveSkills(counted, muitas);
    expect(q).toBe(3);

    q = 0;
    await resolveSkills(counted, muitas);
    expect(q).toBe(1); // agora todas existem
  });

  it('entrada invalida nao cria skill em branco', async () => {
    await resolveSkills(prisma.skill, ['', '   ', '__test_resolver_ok']);
    const rows = await prisma.skill.findMany({
      where: { name: COM_PREFIXO },
      select: { name: true },
    });
    expect(rows.map((r) => r.name)).toEqual(['__test_resolver_ok']);
  });

  it('dedupeSkillNames e a barreira contra o lote sujo', async () => {
    const [react] = nomes('react');
    const limpo = dedupeSkillNames([react, react.toUpperCase(), react.toLowerCase()]);
    expect(limpo).toEqual([react]);
  });

  it('duas resolucoes simultaneas nao criam duplicata', async () => {
    const [react, node] = nomes('react', 'node');
    const entrada = [react, node];

    await Promise.all([resolveSkills(prisma.skill, entrada), resolveSkills(prisma.skill, entrada)]);

    // Corrida estreita (findMany antes do createMany do outro). Sem unique
    // case-sensitive, esta e a janela que produz duplicata; com o dedup em
    // memoria mais a re-leitura, o resultado continua unico.
    const dups = await duplicatas();
    expect(dups).toEqual([]);
  });
});
