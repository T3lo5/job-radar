import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Regressão do ticket 02 (auditoria 2026-10-28).
 *
 * O bug original era `profile.findFirst()` sem filtro: a segunda conta recebia
 * o perfil da primeira. Rotas e serviços de request agora derivam o perfil de
 * `request.user`; só o background global (coleta, bot, adaptador do pipeline)
 * pode ler "o primeiro" perfil — e mesmo assim com ordem explícita.
 *
 * Esta varredura falha se alguém reintroduzir o padrão fora da lista abaixo.
 * É mais barato que uma lint rule e roda junto com a suíte.
 */
const PERMITIDOS = new Set([
  'src/services/pipeline/orchestrator.ts', // adaptador: repassa a chamada
  'src/services/pipeline/step.ts', // declaração de tipo
  'src/services/telegram-bot.ts', // bot global, sem sessão
  'src/workers/job-collection.ts', // coleta global, sem sessão
]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    if (!caminho.endsWith('.ts')) return [];
    if (caminho.includes('/generated/')) return [];
    if (caminho.endsWith('.test.ts')) return [];
    return [caminho];
  });
}

describe('escopo de profile.findFirst', () => {
  it('só aparece na allowlist de background', () => {
    const raiz = process.cwd();
    const infratores = arquivos(join(raiz, 'src'))
      .filter((arquivo) => readFileSync(arquivo, 'utf8').includes('profile.findFirst('))
      .map((arquivo) => relative(raiz, arquivo).replaceAll('\\', '/'))
      .filter((arquivo) => !PERMITIDOS.has(arquivo));

    expect(infratores).toEqual([]);
  });

  it('as rotas não usam findFirst para descobrir o perfil', () => {
    const raiz = process.cwd();
    const rotas = arquivos(join(raiz, 'src/routes')).filter((arquivo) =>
      readFileSync(arquivo, 'utf8').includes('.profile.findFirst('),
    );

    expect(rotas).toEqual([]);
  });
});
