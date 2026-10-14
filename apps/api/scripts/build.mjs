/**
 * Build da API.
 *
 * Duas armadilhas que este script resolve:
 *
 * 1. `incremental: true` (packages/typescript-config/base.json) faz o `tsc`
 *    gravar `tsconfig.tsbuildinfo`. Quando esse arquivo existe mas `dist/` foi
 *    apagado (ex.: `pnpm clean`, ou depois de um `tsc --noEmit` do `typecheck`),
 *    o `tsc` conclui que "nada mudou" e **não emite nenhum `.js`** — o build
 *    passa sem erro e devolve um `dist/` vazio. Apagá-lo antes força o build
 *    completo e determinístico.
 *
 * 2. O client do Prisma é gerado em `src/generated/prisma` e fica fora do
 *    `exclude`/compilação por design (só `.js` + `.d.ts`, sem `.ts` para
 *    compilar). O runtime importa `../generated/prisma/index.js`, então o
 *    diretório precisa existir dentro de `dist/`.
 */
import { rmSync, existsSync, cpSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
process.chdir(ROOT)

// 1. Garante build completo
rmSync('tsconfig.tsbuildinfo', { force: true })
rmSync('dist', { recursive: true, force: true })

// 2. Compila
execSync('tsc', { stdio: 'inherit' })

// 3. Torna dist/ auto-suficiente para o runtime
const GENERATED = 'src/generated'
if (!existsSync(GENERATED)) {
  console.error(
    `\n[build] ${GENERATED} não existe.\n` +
      '       Rode: pnpm --filter @job-radar/api db:generate\n',
  )
  process.exit(1)
}
cpSync(GENERATED, 'dist/generated', { recursive: true })
console.log('[build] client do Prisma copiado para dist/generated')
