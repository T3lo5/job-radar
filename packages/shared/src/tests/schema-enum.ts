import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));

/**
 * Lê um enum do schema do Prisma.
 *
 * É o que impede estas listas de voltarem a divergir do banco em silêncio.
 * SENIORITIES e APPLICATION_STATUSES ficaram meses em português minúsculo
 * enquanto a API devolvia o enum em caixa alta — e nada acusou, porque o
 * pacote não tinha teste nenhum.
 *
 * Lê o arquivo em vez de importar o cliente gerado de propósito: o gerado fica
 * em apps/api/src/generated, que não é dependência deste pacote, e puxar o
 * cliente para cá arrastaria o Prisma inteiro para um pacote de tipos.
 */
export function lerEnumDoSchema(nome: string): string[] {
  // src/tests -> src -> shared -> packages -> raiz do repo
  const caminho = resolve(aqui, '../../../../apps/api/prisma/schema.prisma');
  const schema = readFileSync(caminho, 'utf8');
  const bloco = schema.match(new RegExp(`enum ${nome}\\s*{([^}]*)}`));
  if (!bloco) throw new Error(`Enum ${nome} nao encontrado em schema.prisma`);
  return bloco[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));
}
