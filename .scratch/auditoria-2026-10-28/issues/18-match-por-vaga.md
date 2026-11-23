# 18 — Match por vaga

Status: resolved
Sprint: 1
Prioridade: P1
Área: api + web
Esforço: baixo
Origem: [auditoria §4.6](../../../docs/audits/2026-10-28-produto-e-tecnica.md)

## Problema

O detalhe da vaga procura o match dentro da lista `match/results`, limitada a 50. Se a vaga estiver fora do top 50, a tela diz "Esta vaga ainda não foi avaliada" mesmo já tendo sido avaliada. O dashboard também subconta vagas avaliadas.

## Evidência

- `apps/api/src/services/job-service.ts:286` — `listMatches(profileId, limit = 50)`.
- `apps/web/src/pages/job-detail.tsx` — busca o match na lista, não por id.
- `apps/web/src/pages/dashboard.tsx` — total de avaliadas derivado da mesma lista.

## Correção

1. `GET /api/jobs/:id` passa a incluir `match` (score + breakdown) do perfil da sessão, ou criar `GET /api/jobs/:id/match`.
2. `GET /api/matches/stats` (ou agregado no dashboard) retorna contagem real de vagas avaliadas, sem depender do limite da lista.
3. Detalhe usa o endpoint por vaga; não depende mais de varrer a lista.
4. Manter a lista com limite, mas retornar `total` para a UI exibir "50 de N".

## Critérios de aceite

- [x] Vaga avaliada fora do top 50 mostra score e breakdown no detalhe.
- [x] Vaga não avaliada mostra estado "ainda não avaliada" correto.
- [x] Dashboard mostra a contagem real de vagas avaliadas.
- [x] Nenhum `find` client-side em lista paginada para obter match.

## Testes

- Teste de integração: 60 matches, abrir o detalhe do 60º, score presente.
- Teste de dashboard com contagem acima de 50.

## Comments

- 2026-10-28 — Match passou a ser consultado por vaga.
  - `GET /api/jobs/:id/match` devolve `{ match }` do perfil da sessão; vaga existente sem match responde 200 com `null` (estado normal da tela), vaga inexistente responde 404.
  - `GET /api/match/stats` devolve `total`, `averageScore` e distribuição (`90+`, `80-89`, `70-79`, `60-69`, `50-59`, `<50`) sem limite de lista. `jobService.getMatchStats` agrupa por score (no máximo 101 linhas), então o agregado é exato mesmo com milhares de matches.
  - `listMatches` agora devolve `{ data, total }`; a lista continua limitada a 50, mas a tela de vagas mostra "N de M com match".
  - `job-detail` usa `matchApi.getForJob(id)` e não faz mais `find` na lista; avaliar um match invalida também `match-stats`/`match-results`.
  - Dashboard trocou as contagens derivadas da lista pelo agregado: "Vagas avaliadas" é `stats.total`, alta/média aderência e o gráfico de distribuição saem das faixas do servidor.
  - Testes: `job-match.integration.test.ts` (6) cria 60 matches (scores 40..99) e prova que a vaga de score 40 — fora do top 50 — devolve score/breakdown; lista traz 50 itens + `total: 60`; stats conta 60, média 69,5 e distribuição 10 por faixa; sem matches a média é 0.
  - Verificação: API typecheck=0 lint=0 test=320; web typecheck=0 lint=0 test=84 build=0.
