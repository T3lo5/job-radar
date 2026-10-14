import type { PrismaClient } from '../generated/prisma/index.js';
import type {
  RemoteMode as DbRemoteMode,
  Seniority as DbSeniority,
} from '../generated/prisma/index.js';

/**
 * Persistência das vagas coletadas, em lote.
 *
 * Antes, `runCollection` fazia 2 queries por vaga (`findUnique` no hash +
 * `create`/`update`), todas sequenciais dentro de um `for`. Uma coleta com 500
 * vagas virava 1000 round-trips ao Postgres, e o tempo crescia linearmente com
 * o tamanho do resultado de cada fonte.
 *
 * Aqui o mesmo trabalho sai em 3 queries por fonte, independente de quantas
 * vagas a fonte devolveu.
 *
 * Os filtros (local, senioridade, seenHashes) continuam no coletor: esta
 * módulo só decide o que gravar, e o chamador já entregou o que passou.
 */

/**
 * Teto de itens num `IN`.
 *
 * O Postgres aceita no máximo 65535 parâmetros por prepared statement. Com
 * fontes que devolvem milhares de vagas num page, estourar isso dá erro de
 * "too many bind variables" — e o sintoma aparece como falha de coleta, não
 * como problema de lote. 1000 deixa folga larga.
 */
const IN_CHUNK = 1000;

const REMOTE_MODES: readonly DbRemoteMode[] = ['ON_SITE', 'HYBRID', 'REMOTE', 'ANY', 'UNKNOWN'];

const SENIORITIES: readonly DbSeniority[] = [
  'UNKNOWN',
  'INTERN',
  'JUNIOR',
  'MID',
  'SENIOR',
  'SPECIALIST',
  'LEAD',
];

/**
 * `NormalizedJob.remote` é 'on_site' | 'hybrid' | 'remote' | 'unknown'
 * (packages/shared), e o enum do Prisma é ON_SITE | HYBRID | ... São os mesmos
 * valores em Convenções diferentes, e a ponte era `.toUpperCase() as any`.
 *
 * A ponte funciona hoje, mas é silenciosa: se o shared ganhar um valor novo
 * sem equivalente no Prisma, o INSERT passa a estourar com erro de enum do
 * Postgres. Em lote isso é pior — derruba as N vagas do lote, não só a
 * vaga culpada. Aqui o desconhecido vira UNKNOWN e o resto é registrado.
 */
export function coerceRemoteMode(value: string): DbRemoteMode {
  const upper = String(value ?? '').toUpperCase();
  return (REMOTE_MODES as readonly string[]).includes(upper) ? (upper as DbRemoteMode) : 'UNKNOWN';
}

/** `detectSeniority` devolve `string`; valor fora do enum vira null (campo é opcional). */
export function coerceSeniority(value: string | null | undefined): DbSeniority | null {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  return (SENIORITIES as readonly string[]).includes(upper) ? (upper as DbSeniority) : null;
}

export interface JobCandidate {
  title: string;
  company: string;
  description: string;
  location: string | null;
  remote: string;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  url: string;
  externalId: string | null;
  publishedAt: Date | null;
  hash: string;
}

export interface PersistOutcome {
  /** Vagas novas efetivamente gravadas. */
  inserted: number;
  /** Vagas que já existiam e tiveram sourceCount incrementado. */
  touched: number;
  /** IDs das vagas novas, para enfileirar no pipeline. */
  newJobIds: string[];
  /**
   * Quantas vagas do lote deixaram de ser inseridas por conflito de unicidade.
   *
   * É só a contagem porque `createMany` diz quantas linhas pula, não quais.
   * Chutar quais serían inventar número.
   */
  duplicateCount: number;
}

/**
 * Subconjunto do Prisma usado aqui. Tipar pelo que a função precisa (e não
 * pelo PrismaClient inteiro) é o que permite trocar por uma dupla no teste.
 */
export type PersistPrisma = Pick<PrismaClient, 'job'>;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function persistSourceJobs(deps: {
  prisma: PersistPrisma;
  sourceId: string;
  candidates: JobCandidate[];
  now?: Date;
}): Promise<PersistOutcome> {
  const { prisma, sourceId } = deps;
  const now = deps.now ?? new Date();
  const outcome: PersistOutcome = {
    inserted: 0,
    touched: 0,
    newJobIds: [],
    duplicateCount: 0,
  };

  if (deps.candidates.length === 0) return outcome;

  // Deduplicação dentro do lote. A de entre lotes é do chamador (seenHashes):
  // uma vaga que apareceu na fonte A não deve ser processada de novo na B.
  const uniqueByHash = new Map<string, JobCandidate>();
  for (const candidate of deps.candidates) {
    if (!uniqueByHash.has(candidate.hash)) uniqueByHash.set(candidate.hash, candidate);
  }
  const unique = [...uniqueByHash.values()];
  const hashes = unique.map((c) => c.hash);

  // 1. Uma consulta para descobrir quais já existem. Passa por chunk pelos
  //    mesmos motivos do createMany: um IN de 70 mil valores estoura o limite
  //    de parâmetros do Postgres.
  const existing: Array<{ id: string; hash: string }> = [];
  for (const group of chunk(hashes, IN_CHUNK)) {
    existing.push(
      ...(await prisma.job.findMany({
        where: { hash: { in: group } },
        select: { id: true, hash: true },
      })),
    );
  }
  const existingHashes = new Set(existing.map((row) => row.hash));

  // 2. Um updateMany para todas as repetidas. O incremento é o mesmo para
  //    todas, então não precisa ser uma query por vaga.
  if (existing.length > 0) {
    for (const group of chunk(
      existing.map((row) => row.hash),
      IN_CHUNK,
    )) {
      await prisma.job.updateMany({
        where: { hash: { in: group } },
        data: { sourceCount: { increment: 1 }, collectedAt: now },
      });
    }
    outcome.touched = existing.length;
  }

  const toCreate = unique.filter((c) => !existingHashes.has(c.hash));
  if (toCreate.length === 0) return outcome;

  // 3. Um createMany para as novas. skipDuplicates protege contra a corrida em
  //    que outra coleta insere a mesma vaga entre a consulta acima e aqui — o
  //    hash é @unique, então a duplicata seria erro.
  let created = 0;
  for (const group of chunk(toCreate, IN_CHUNK)) {
    const result = await prisma.job.createMany({
      data: group.map((candidate) => ({
        title: candidate.title,
        company: candidate.company,
        description: candidate.description,
        location: candidate.location,
        remote: coerceRemoteMode(candidate.remote),
        seniority: coerceSeniority(candidate.seniority),
        salaryMin: candidate.salaryMin,
        salaryMax: candidate.salaryMax,
        salaryCurrency: candidate.salaryCurrency,
        url: candidate.url,
        sourceId,
        externalId: candidate.externalId,
        publishedAt: candidate.publishedAt,
        hash: candidate.hash,
        status: 'RAW' as const,
        sourceCount: 1,
      })),
      skipDuplicates: true,
    });
    created += result.count;
    outcome.duplicateCount += group.length - result.count;
  }
  outcome.inserted = created;

  // 4. Uma consulta para pegar os IDs das novas (createMany não os devolve).
  //    Pode incluir uma vaga que outra coleta inseriu na corrida acima — sem
  //    problema: o pipeline é idempotente por status, então reprocessar é no-op.
  const createdRows: Array<{ id: string }> = [];
  for (const group of chunk(
    toCreate.map((c) => c.hash),
    IN_CHUNK,
  )) {
    createdRows.push(
      ...(await prisma.job.findMany({
        where: { hash: { in: group } },
        select: { id: true },
      })),
    );
  }
  outcome.newJobIds = createdRows.map((row) => row.id);

  return outcome;
}
