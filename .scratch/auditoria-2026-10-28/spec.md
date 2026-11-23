# Auditoria 2026-10-28 — especificação e índice de execução

## Origem

Relatório completo: [`docs/audits/2026-10-28-produto-e-tecnica.md`](../../docs/audits/2026-10-28-produto-e-tecnica.md).

Os tickets abaixo convertem os achados P0/P1/P2 e as oportunidades de produto da auditoria em trabalho executável.

## Contexto de priorização

- **Deploy em produção não é o objetivo atual.** Os tickets de deploy (04, 05) ficam registrados e prontos, mas marcados `ready-for-human` e só entram quando o deploy virar meta.
- O produto é **single-user**. A decisão default é **fechar o signup público** (ticket 01) em vez de construir multi-tenancy; o escopo por `userId` (ticket 02) entra como defesa em profundidade.
- Nenhuma issue aqui autoriza reescrever o que a auditoria marcou como bom (sessão, settings criptografados, testes de integração, shutdown gracioso, auditoria de custo de IA).

## Convenções

- `Status:` segue [`docs/agents/triage-labels.md`](../../docs/agents/triage-labels.md).
- `Sprint:` segue o roadmap da auditoria (§8).
- Cada ticket tem `Problema`, `Evidência`, `Correção`, `Critérios de aceite` e `Testes`.
- Tickets com `Blocked by:` só começam quando os listados estiverem fechados.

## Índice

### Sprint 0 — Não mentir e não vazar

| # | Ticket | Prioridade | Status |
|---|---|---|---|
| 01 | [Fechar o signup público](./issues/01-fechar-signup-publico.md) | P0 | resolved |
| 02 | [Escopar dados por `userId`](./issues/02-escopar-dados-por-usuario.md) | P0 | resolved |
| 03 | [Guardas de admin e setup](./issues/03-guardas-admin-e-setup.md) | P0 | resolved |
| 04 | [Produção: `baseURL` e nginx](./issues/04-producao-base-url-e-nginx.md) | P1 | ready-for-human |
| 05 | [Deploy: migrations e chave de criptografia](./issues/05-deploy-migrations-e-chave.md) | P1 | ready-for-human |
| 06 | [Commitar migrations de ATS e carta](./issues/06-comitar-migrations-ats-carta.md) | P0 | resolved |
| 07 | [Ligar botões do detalhe da vaga](./issues/07-botoes-detalhe-vaga.md) | P0 | resolved |
| 08 | [Lista de vagas abre o detalhe](./issues/08-lista-vagas-abre-detalhe.md) | P0 | resolved |
| 09 | [Atualizar Fastify](./issues/09-upgrade-fastify.md) | P0 | resolved |
| 10 | [Atualizar DOMPurify](./issues/10-upgrade-dompurify.md) | P0 | resolved |

### Sprint 1 — Consertar o que a UI promete

| # | Ticket | Prioridade | Status |
|---|---|---|---|
| 11 | [Erro de API não vira "vazio"](./issues/11-erro-de-api-nao-vira-vazio.md) | P1 | resolved |
| 12 | [Persistir `atsUsed`](./issues/12-persistir-ats-used.md) | P1 | resolved |
| 13 | [Níveis de idioma em CEFR](./issues/13-niveis-idioma-cefr.md) | P1 | resolved |
| 14 | [Cron reagenda ao salvar](./issues/14-cron-reagenda.md) | P1 | resolved |
| 15 | [Respeitar fontes desativadas](./issues/15-fontes-desativadas.md) | P1 | resolved |
| 16 | [Integridade de CV por fronteira de palavra](./issues/16-integridade-cv-fronteira-palavra.md) | P1 | resolved |
| 17 | [Calibrar o ATS checker](./issues/17-ats-checker-calibracao.md) | P1 | ready-for-human |
| 18 | [Match por vaga](./issues/18-match-por-vaga.md) | P1 | resolved |
| 19 | [Busca e ordenação no servidor](./issues/19-busca-ordenacao-servidor.md) | P1 | resolved |
| 20 | [Analytics honesto](./issues/20-analytics-honesto.md) | P1 | resolved |
| 21 | [Kanban acessível](./issues/21-kanban-acessivel.md) | P1 | resolved |
| 22 | [Allowlist do bot do Telegram](./issues/22-telegram-allowlist.md) | P1 | resolved |
| 23 | [Segredos fora do Redis em claro](./issues/23-segredos-fora-do-redis.md) | P1 | resolved |
| 24 | [CORS e rate limit atrás do proxy](./issues/24-cors-rate-limit-proxy.md) | P1 | resolved |
| 25 | [Matching sem falso parentesco](./issues/25-matching-sem-falso-parentesco.md) | P2 | resolved |
| 26 | [Pipeline resiliente e testado](./issues/26-pipeline-resiliente.md) | P2 | resolved |
| 27 | [Correções de fontes e normalização](./issues/27-fontes-e-normalizacao.md) | P2 | resolved |

### Sprint 2 — Anti-ghosting e confiança na vaga

| # | Ticket | Prioridade | Status |
|---|---|---|---|
| 28 | [Cockpit anti-ghosting](./issues/28-cockpit-anti-ghosting.md) | P1 | needs-triage |
| 29 | [Índice de confiança da vaga](./issues/29-indice-confianca-vaga.md) | P2 | needs-triage |
| 30 | [Salário primeiro](./issues/30-salario-primeiro.md) | P1 | needs-triage |
| 31 | [Kit da candidatura](./issues/31-kit-da-candidatura.md) | P1 | ready-for-agent |
| 32 | [Carta PT/EN com integridade](./issues/32-carta-pt-en-integridade.md) | P1 | ready-for-agent |

### Sprint 3 — Confiança, privacidade e alcance

| # | Ticket | Prioridade | Status |
|---|---|---|---|
| 33 | [ATS explicável e integridade visível](./issues/33-ats-explicavel.md) | P2 | needs-triage |
| 34 | [PII fora da IA + export/delete](./issues/34-pii-fora-da-ia.md) | P1 | ready-for-agent |
| 35 | [Acessibilidade e mobile](./issues/35-acessibilidade-e-mobile.md) | P2 | ready-for-agent |
| 36 | [Code splitting e virtualização](./issues/36-code-splitting-virtualizacao.md) | P2 | ready-for-agent |
| 37 | [Gates de CI: audit e drift de migrations](./issues/37-gates-de-ci.md) | P2 | ready-for-agent |
| 38 | [Consistência de UI e formatação](./issues/38-consistencia-de-ui.md) | P2 | ready-for-agent |
| 39 | [Documentação honesta](./issues/39-documentacao-honesta.md) | P2 | ready-for-agent |
| 40 | [Criptografar `AiProvider.apiKey`](./issues/40-criptografar-ai-provider-key.md) | P2 | ready-for-agent |

## Sequência sugerida

1. **Fechar o sangramento:** 01, 02, 03, 06, 07, 08, 09, 10.
2. **Parar de mentir:** 11, 12, 13, 14, 15, 16, 18, 20, 21, 22, 23, 24.
3. **Confiabilidade de dados:** 17, 19, 25, 26, 27.
4. **Produto:** 28, 30, 31, 32.
5. **Polimento e alcance:** 29, 33, 34, 35, 36, 37, 38, 39, 40.
6. **Deploy (quando virar meta):** 04, 05.

## Critério de saída global

- Nenhuma conta enxerga dados de outra.
- Nenhum botão sem ação e nenhum erro de API exibido como lista vazia.
- Features de ATS, carta e idioma persistem e são verificáveis por teste.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` e `pnpm test` continuam verdes a cada ticket.

## Comments

- 2026-10-28 — Tickets criados a partir da auditoria `docs/audits/2026-10-28-produto-e-tecnica.md`. Nenhum código alterado.
