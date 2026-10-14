import { describe, it, expect } from 'vitest';
import {
  resolveSkills,
  dedupeSkillNames,
  skillKey,
  type SkillResolverDb,
} from './skill-resolver.js';

/**
 * Dupla com semântica de banco: `@unique` em `skills.name` é case-sensitive
 * no Postgres, então `createMany` com skipDuplicates NÃO protege contra
 * 'React' e 'react' — e é exatamente essa a condição que o passo precisa
 * impedir antes de chegar lá.
 */
function createDb(existingNames: string[] = []) {
  const calls: string[] = [];
  const rows = new Map<string, { id: string; name: string }>();
  for (const name of existingNames) rows.set(name, { id: `id-${name}`, name });

  const key = (n: string) => n.trim().toLowerCase();

  const db: SkillResolverDb & { calls: string[] } = {
    calls,
    findMany: async (args) => {
      calls.push('findMany');
      const inList = args.where.name.in;
      const achadas = inList
        .filter((n) => [...rows.keys()].some((k) => key(k) === key(n)))
        .map((n) => [...rows.values()].find((r) => key(r.name) === key(n))!);
      // findMany pode devolver a mesma linha duas vezes se o input tiver
      // 'React' e 'react'; o banco devolveria uma só.
      const vistos = new Set<string>();
      return achadas.filter((r) => (vistos.has(r.id) ? false : (vistos.add(r.id), true)));
    },
    createMany: async (args) => {
      calls.push('createMany');
      let count = 0;
      for (const row of args.data) {
        if (rows.has(row.name)) continue; // unique exato, case-sensitive
        rows.set(row.name, { id: `id-${row.name}`, name: row.name });
        count++;
      }
      return { count };
    },
  };

  return { db, calls, rows, total: () => calls.length };
}

describe('skillKey / dedupeSkillNames', () => {
  it('normaliza ignorando caixa e espacos', () => {
    expect(skillKey('  React  ')).toBe('react');
    expect(skillKey('NODE.JS')).toBe('node.js');
  });

  it('remove repetidos ignorando caixa', () => {
    expect(dedupeSkillNames(['React', 'react', 'REACT', 'Node'])).toEqual(['React', 'Node']);
  });

  it('descarta vazios e so espacos', () => {
    expect(dedupeSkillNames(['', '   ', 'React'])).toEqual(['React']);
  });

  it('preserva simbolos que distinguem skills', () => {
    // C++ e C# sao skills diferentes; um normalizador agressivo viraria 'c'.
    expect(dedupeSkillNames(['C++', 'C#'])).toEqual(['C++', 'C#']);
  });

  it('mantem a primeira grafia vista', () => {
    expect(dedupeSkillNames(['node.js', 'Node.js'])).toEqual(['node.js']);
  });
});

describe('resolveSkills — contagem de queries', () => {
  it('N skills JA EXISTENTES usam as mesmas queries que 1', async () => {
    const uma = createDb(['React']);
    await resolveSkills(uma.db, ['React']);

    const varias = createDb(['React', 'Node', 'Python', 'Go', 'Rust', 'Java', 'SQL']);
    await resolveSkills(varias.db, ['React', 'Node', 'Python', 'Go', 'Rust', 'Java', 'SQL']);

    // Antes: 2 queries por skill. Este teste e o que impede o N+1 de voltar.
    expect(varias.total()).toBe(uma.total());
  });

  it('N skills NOVAS usam as mesmas queries que 1', async () => {
    const uma = createDb();
    await resolveSkills(uma.db, ['React']);

    const varias = createDb();
    const nomes = ['React', 'Node', 'Python', 'Go', 'Rust', 'Java', 'SQL'];
    await resolveSkills(varias.db, nomes);

    expect(varias.total()).toBe(uma.total());
  });

  it('mistura de novas e existentes nao multiplica as queries', async () => {
    const soNovas = createDb();
    await resolveSkills(soNovas.db, ['React']);

    const mistas = createDb(['React']); // 1 existe, 6 novas
    await resolveSkills(mistas.db, ['React', 'Node', 'Python', 'Go', 'Rust', 'Java', 'SQL']);

    expect(mistas.total()).toBe(soNovas.total());
  });

  it('skill ja existente usa so 1 query', async () => {
    const { db, calls } = createDb(['React', 'Node']);
    await resolveSkills(db, ['React', 'Node']);
    expect(calls).toEqual(['findMany']); // nada faltando, nem createMany
  });

  it('skill nova usa 3 queries (findMany, createMany, findMany dos IDs)', async () => {
    const { db, calls } = createDb();
    await resolveSkills(db, ['React']);
    // createMany nao devolve os IDs, dai a segunda leitura.
    expect(calls).toEqual(['findMany', 'createMany', 'findMany']);
  });

  it('lista vazia nao toca no banco', async () => {
    const { db, calls } = createDb();
    const r = await resolveSkills(db, []);
    expect(calls).toEqual([]);
    expect(r.size).toBe(0);
  });
});

describe('resolveSkills — comportamento', () => {
  it('devolve o mapa indexado pela chave normalizada', async () => {
    const { db } = createDb(['React', 'Node.js']);
    const r = await resolveSkills(db, ['REACT', 'node.js']);

    // A chave e minuscula: 'React' e 'react' sao a mesma entrada.
    expect([...r.keys()].sort()).toEqual(['node.js', 'react']);
    expect(r.get('react')?.name).toBe('React');
    expect(r.get('react')?.id).toBe('id-React');
  });

  it('cria a skill que faltava e devolve o ID', async () => {
    const { db, rows } = createDb(['React']);
    const r = await resolveSkills(db, ['React', 'Kubernetes']);

    expect(r.get('kubernetes')?.name).toBe('Kubernetes');
    expect(rows.has('Kubernetes')).toBe(true);
  });

  it('nao cria duplicata quando o catalogo tem React e o passo pede react', async () => {
    const { db, rows } = createDb(['React']);
    const r = await resolveSkills(db, ['react']);

    // Era o bug: findFirst insensitive achava 'React', mas se o catalogo
    // estivesse sujo, cada variacao criava a sua.
    expect([...rows.keys()]).toEqual(['React']);
    expect(r.get('react')?.name).toBe('React');
  });

  it('nao cria ' + "'react' e 'React' no mesmo lote", async () => {
    const { db, rows } = createDb();
    await resolveSkills(db, ['React', 'react', 'REACT']);

    // skipDuplicates nao ajudaria: a unique do Postgres compara com caixa.
    expect([...rows.keys()]).toEqual(['React']);
  });

  it('ignora entradas invalidas', async () => {
    const { db } = createDb();
    const r = await resolveSkills(db, ['', '  ', 'React', undefined as never]);
    expect([...r.keys()]).toEqual(['react']);
  });

  it('sobrescreve nilo quando o catalogo ja nasce duplicado', async () => {
    // Cenario legado: duas linhas com mesmo nome em caixa diferente.
    const { db } = createDb(['React', 'react']);
    const r = await resolveSkills(db, ['REACT']);

    // Nao ha como escolher a certa; o primeiro vence e nao duplica mais.
    expect(r.get('react')).toBeDefined();
    expect(r.size).toBe(1);
  });
});
