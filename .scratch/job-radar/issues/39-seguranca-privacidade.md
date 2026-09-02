# 39 — Política de segurança e privacidade

## Question

Checklist a implementar e documentar:

- ✅ CV nunca enviado para serviços não essenciais
- ✅ Chaves de API somente em `.env`, nunca commitadas
- ✅ `.env` no `.gitignore` desde o commit inicial
- ✅ Logs sem PII (CPF, telefone, endereço completo)
- ✅ Sem armazenar credenciais de plataformas de emprego
- ✅ HTTPS obrigatório em produção (quando aplicável)
- ✅ Rate limiting na API (fastify-rate-limit)
- ✅ Validação Zod em TODOS os endpoints
- ✅ Sanitização de input em prompts de IA (prevenir injection)
- ✅ Auditoria: todas chamadas IA registradas em `ai_runs`
- ✅ `npm audit` rodando no CI
- ✅ Dependabot configurado

## Type

task

## Status

done

## Blocked by

06

## Implementation

- Rate limiting: `@fastify/rate-limit` with 100 req/min, Redis-backed
- Dependabot: `.github/dependabot.yml` for npm + GitHub Actions
- Zod validation on all endpoints (already in place)
- AI audit via `ai_runs` table (already in place)
- `.env` in `.gitignore` (already in place)
