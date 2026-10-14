import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
// Senha
//
// Usa scrypt do próprio Node (node:crypto), sem dependência externa: é
// memory-hard e não exige build nativo — o que importa aqui porque as imagens
// Docker usam Alpine/musl. O formato guardado é
// `scrypt$<salt-b64>$<hash-b64>`, então dá para trocar de esquema no futuro.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltB64, 'base64');
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(password, salt, expected.length);
  return timingSafeEqual(derived, expected);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessão
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'jr_session';
const SESSION_TTL_DAYS = 30;

/** Token opaco devolvido ao cliente. Só o hash dele vai para o banco. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isPasswordStrongEnough(password: string): boolean {
  // Só o mínimo para evitar senha óbvia; não impomos regras que irritem.
  return typeof password === 'string' && password.length >= 8;
}

/** Existe conta utilizável? Setup só fica aberto enquanto ninguém tem senha. */
export async function hasAccount(): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { password: { not: null } },
    select: { id: true },
  });
  return user !== null;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<CreatedSession> {
  const token = newToken();
  const expiresAt = sessionExpiry();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    },
  });

  return { token, expiresAt };
}

/** Valida o token e devolve o usuário, ou null. Atualiza o lastUsedAt. */
export async function resolveSession(token: string | undefined) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  // Atualização discreta: não bloqueia a request se falhar.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { session, user: session.user };
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session
    .updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});
}

export async function revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

/** Lista os dispositivos (sessões ativas) do usuário, sem expor os tokens. */
export async function listSessions(userId: string, currentToken?: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      tokenHash: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });

  const currentHash = currentToken ? hashToken(currentToken) : null;

  return sessions.map(({ tokenHash, ...session }) => ({
    ...session,
    current: currentHash !== null && tokenHash === currentHash,
  }));
}

/**
 * Cria (ou adota) a conta do primeiro boot.
 *
 * O seed cria um `demo@jobradar.local` sem senha. Detectar "tabela vazia" não
 * funcionaria nesse caso, então a regra é: enquanto nenhum usuário tiver senha,
 * o setup está aberto — e se existir exatamente um usuário sem senha, ele é
 * adotado (email/senha preenchidos), preservando o Profile já ligado a ele.
 */
export async function setupAccount(input: {
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();

  const passwordless = await prisma.user.findMany({
    where: { password: null },
    select: { id: true },
  });

  if (passwordless.length === 1) {
    const userId = passwordless[0].id;
    await prisma.user.update({
      where: { id: userId },
      data: { email, password: hashPassword(input.password) },
    });
    return { userId };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { password: hashPassword(input.password) },
    });
    return { userId: existing.id };
  }

  const created = await prisma.user.create({
    data: { email, password: hashPassword(input.password) },
    select: { id: true },
  });
  return { userId: created.id };
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user?.password) return null;
  if (!verifyPassword(password, user.password)) return null;
  return user;
}
