import type { FastifyRequest } from 'fastify';
import type { Prisma } from '../generated/prisma/index.js';
import { prisma } from '../db/prisma.js';

/**
 * Usuário da sessão atual.
 *
 * O `authGuard` global resolve a sessão e anexa `request.user` antes de
 * qualquer handler protegido. Este módulo é a única porta para ler esse dado:
 * rotas não devem buscar "o primeiro usuário" nem "o primeiro perfil" no banco.
 * Antes da auditoria de 2026-10-28, `findFirst()` sem filtro fazia a segunda
 * conta enxergar perfil, CVs e candidaturas da primeira.
 */
export interface RequestUser {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
}

export function getRequestUser(request: FastifyRequest): RequestUser {
  const user = (request as unknown as { user?: RequestUser }).user;
  if (!user?.id) {
    // Só acontece se uma rota for registrada fora do guard global. Falhar alto
    // é melhor do que cair em um `findFirst()` e vazar dados de outra conta.
    throw new Error('auth guard não anexou request.user');
  }
  return user;
}

export function getCurrentUserId(request: FastifyRequest): string {
  return getRequestUser(request).id;
}

/** Perfil do usuário da sessão, sem relações. `null` se ainda não existe. */
export function getCurrentProfile(request: FastifyRequest) {
  return prisma.profile.findUnique({
    where: { userId: getCurrentUserId(request) },
  });
}

/** Relações carregadas pelo perfil completo (dashboard, perfil, matching). */
export const PROFILE_RELATIONS = {
  skills: {
    include: { skill: true },
    orderBy: { skill: { name: 'asc' } },
  },
  education: true,
  certifications: true,
  projects: true,
  languages: true,
  workExperiences: true,
} satisfies Prisma.ProfileInclude;

/** Perfil do usuário da sessão com todas as relações do formulário. */
export function getCurrentProfileWithRelations(request: FastifyRequest) {
  return prisma.profile.findUnique({
    where: { userId: getCurrentUserId(request) },
    include: PROFILE_RELATIONS,
  });
}
