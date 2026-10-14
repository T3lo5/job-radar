# Política de Segurança

## Versões Suportadas

| Versão           | Suportada                       |
| ---------------- | ------------------------------- |
| `main` (atual)   | ✅ Sim                          |
| Releases antigas | ❌ Não (atualize para a `main`) |

## Reportando Vulnerabilidades

**NÃO abra issue pública para vulnerabilidades de segurança.**

Abra um [Security Advisory privado](../../security/advisories/new) com:

1. Descrição da vulnerabilidade
2. Passos para reproduzir
3. Impacto potencial
4. Sugestão de correção (se tiver)

Responderemos o quanto antes e trabalharemos na correção antes de qualquer divulgação. Créditos no CHANGELOG, se desejar.

Denúncias de conduta (não técnicas) seguem o [Código de Conduta](./CODE_OF_CONDUCT.md).

## Boas Práticas (usuários)

- **NUNCA** commite `.env`, chaves de IA, tokens ou cookies
- Gere `SETTINGS_ENCRYPTION_KEY` forte por ambiente (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) e guarde em cofre — trocá-la invalida os settings criptografados
- `CORS_ORIGINS` com o domínio real em produção (nunca vazio fora do localhost)
- HTTPS via reverse proxy; não exponha a porta 3001 diretamente
- `pnpm audit` antes de atualizar dependências; `pnpm-lock.yaml` commitado garante builds reprodutíveis
- Faça backup do volume do Postgres (`pg_dump`)

## Boas Práticas (desenvolvedores)

- Valide toda entrada na borda (schemas Zod nas rotas; `httpUrl()` bloqueia `javascript:`/`file:` e range link-local contra SSRF)
- Prisma com prepared statements (sem SQL concatenado); `dataOpcional` trata `''` como ausente em datas
- Senhas com `scrypt`; sessões opacas revogáveis em cookie HttpOnly; sem JWT em `localStorage`
- Settings sensíveis em AES-256-GCM, nunca em plain text
- Upload restrito a PDF/DOCX até 10 MB; HTML de terceiros sanitizado (DOMPurify) antes de renderizar
- Rate limiting nos endpoints sensíveis (auth, IA, coleta)
- Custo de IA auditado por operação (`ai_runs` + alerta) — pico anormal aparece na tela de Uso de IA

## Superfície autenticada

| Área                                          | Proteção                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `/api/auth/*`, `/health`, `/api/setup/status` | Públicas por desenho (login/wizard)                                              |
| Todo o resto de `/api/*`                      | Exige sessão válida (hook global; setup incompleto responde 423)                 |
| Rotas de escrita                              | Schemas Zod + validação de tipo (filtro `?type=` inválido responde 400, não 500) |

## Divulgação Responsável

Agradecemos quem segue divulgação responsável. Correções de segurança saem com prioridade sobre features.
