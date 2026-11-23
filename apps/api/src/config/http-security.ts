/**
 * Configuração de borda: CORS, confiança no proxy e limites de requisição.
 *
 * Ficam como funções puras (fora de `server.ts`) porque são regras de segurança
 * — "produção sem CORS_ORIGINS não sobe", "sexto login em um minuto é 429",
 * "dois clientes atrás do nginx têm buckets separados" — e precisam de teste
 * sem levantar o servidor inteiro (que exige Postgres, Redis e chave mestra).
 */

export type CorsOrigin = string | RegExp;

export interface RateLimitRule {
  max: number;
  timeWindow: string;
  /** Reincidência estende o bloqueio em vez de liberar no fim da janela. */
  continueExceeding?: boolean;
}

/** Limite padrão de qualquer rota. */
export const GLOBAL_RATE_LIMIT: RateLimitRule = { max: 100, timeWindow: '1 minute' };

/** Rotas de auth em geral (`/api/auth/*`). */
export const AUTH_RATE_LIMIT: RateLimitRule = { max: 20, timeWindow: '1 minute' };

/**
 * Login/signup/setup: 5 por minuto, com backoff.
 *
 * Sem limite próprio, o limite global (100/min) deixava brute force viável: dá
 * para testar 100 senhas por minuto, por IP, sem nenhum atraso.
 */
export const CREDENTIAL_RATE_LIMIT: RateLimitRule = {
  max: 5,
  timeWindow: '1 minute',
  continueExceeding: true,
};

const CREDENTIAL_ROUTES = new Set(['/api/auth/login', '/api/auth/signup', '/api/auth/setup']);

/** `"a, b ,,c"` → `["a","b","c"]`. */
export function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Em desenvolvimento, só a própria máquina — nunca qualquer origem. */
const LOCAL_DEV_ORIGINS: CorsOrigin[] = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/**
 * Origens aceitas pelo CORS.
 *
 * Em produção, lista vazia é erro de boot: `origin: true` com `credentials`
 * reflete qualquer site e o browser passa a enviar o cookie de sessão para ele
 * (CSRF). O erro acontece no boot, com mensagem acionável, em vez de virar uma
 * configuração insegura silenciosa.
 */
export function resolveCorsOrigins(raw: string | undefined, nodeEnv: string): CorsOrigin[] {
  const origins = parseOrigins(raw);
  if (origins.length > 0) return origins;

  if (nodeEnv === 'production') {
    throw new Error(
      'CORS_ORIGINS é obrigatório em produção. Informe as origens do dashboard ' +
        'separadas por vírgula (ex.: https://radar.exemplo.com). Com cookies de ' +
        'sessão, aceitar qualquer origem permite CSRF.',
    );
  }

  return LOCAL_DEV_ORIGINS;
}

/**
 * Valor de `trustProxy` do Fastify.
 *
 * Sem isto, atrás do nginx todo mundo tem o IP do proxy: o rate limit vira um
 * único bucket compartilhado e um cliente consegue bloquear os outros. O valor
 * é o número de hops confiáveis (`1` = só o nginx da frente).
 *
 * Hops viram uma função `hop < n` em vez de repassar o número: nesta versão do
 * Fastify, `trustProxy: <number>` "falha fechado" (ignora X-Forwarded-For), o
 * que deixaria a configuração silenciosamente sem efeito.
 */
export type TrustProxyFn = (address: string, hop: number) => boolean;

export function parseTrustProxy(raw: string | undefined): boolean | TrustProxyFn {
  const value = (raw ?? '').trim().toLowerCase();

  if (value === '' || value === 'false' || value === '0') return false;
  if (value === 'true') return true;

  const hops = Number(value);
  if (Number.isInteger(hops) && hops > 0 && hops <= 10) {
    return (_address, hop) => hop < hops;
  }

  throw new Error(
    `TRUST_PROXY inválido: "${raw}". Use false, true ou o número de proxies ` +
      'confiáveis à frente da API (ex.: 1 para um nginx).',
  );
}

/**
 * Limite efetivo de uma rota de auth. `undefined` para rotas que não são de
 * auth (aí vale o limite global).
 */
export function authRateLimitFor(url: string): RateLimitRule | undefined {
  if (CREDENTIAL_ROUTES.has(url)) return CREDENTIAL_RATE_LIMIT;
  if (url.startsWith('/api/auth/')) return AUTH_RATE_LIMIT;
  return undefined;
}

/** Corpo do 429. O header `Retry-After` é adicionado pelo plugin. */
export function rateLimitErrorResponse(context: { ttl: number }): {
  statusCode: 429;
  error: string;
  message: string;
} {
  const segundos = Math.max(1, Math.ceil(context.ttl / 1000));
  return {
    statusCode: 429,
    error: 'Muitas requisições',
    message: `Muitas requisições. Tente novamente em ${segundos} segundo(s).`,
  };
}
