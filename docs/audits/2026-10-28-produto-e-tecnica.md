# Job Radar — Auditoria de produto e técnica

> **Data:** 2026-10-28
> **Escopo:** código atual (inclui o trabalho não commitado de ATS, carta de apresentação, keyword gap, detector de dados sensíveis, signup e traduções), documentação, deploy e pesquisas públicas sobre dores de candidatos.
> **Como foi feito:** leitura do backend/frontend, execução de `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (324 testes) e `pnpm audit`; probes para reproduzir heurísticas; pesquisa web com fontes citadas no fim.
> **Nenhum arquivo de código foi alterado por esta auditoria.**
> **Execução:** os achados foram convertidos em 40 tickets em [`.scratch/auditoria-2026-10-28/`](../../.scratch/auditoria-2026-10-28/spec.md), organizados por sprint.

---

## 1. Resumo executivo

O projeto tem uma base boa: monorepo organizado, 324 testes verdes, build funcionando, autenticação por sessão bem feita, settings criptografados, shutdown gracioso e testes de integração contra Postgres real. O problema não é falta de arquitetura — é **distância entre o que a interface promete e o que o sistema faz**.

Cinco conclusões:

1. **O deploy de produção ainda não funciona de ponta a ponta.** O frontend compilado aponta para `http://localhost:3001` (endereço da máquina do usuário), o nginx remove `/api` que a API espera, e o container não roda migrations.
2. **O cadastro público transforma um produto single-user em vazamento de dados.** Qualquer pessoa cria conta; e quase todas as rotas leem o "primeiro" perfil/CV/candidatura do banco, sem filtrar por usuário.
3. **A UI mente em vários pontos.** Erro de API vira "0 vagas"; botões principais não têm ação; uma vaga não abre o detalhe pela lista; o ATS escolhido não é salvo; o nível de idioma sempre dá 400.
4. **As features novas de ATS/CV são a maior oportunidade e o maior risco.** O verificador de ATS dá falso positivo em CV normal de uma coluna (reproduzi: score 80 + "múltiplas colunas"), e a "Regra de Ouro" usa `includes`, então "Go" passa porque "Google" contém "go".
5. **As dores reais do público validam exatamente onde investir:** ghosting, vagas fantasmas, salário escondido, burnout de candidatura e desconfiança de currículo gerado por IA. O produto já tem os dados para atacar quase todas — falta transformá-los em fluxo.

### Se você só puder fazer 8 coisas

| #   | Ação                                                       | Por quê                                                  |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 1   | Fechar `/signup` (ou escopar tudo por `userId`)            | Hoje qualquer visitante vê os dados do dono              |
| 2   | Corrigir `VITE_API_URL` + nginx + entrypoint de migrations | Produção documentada não sobe                            |
| 3   | Ligar os botões mortos e o link da lista para o detalhe    | O fluxo principal termina em beco sem saída              |
| 4   | Tratar `isError` nas queries                               | Hoje falha de API é exibida como "vazio"                 |
| 5   | Salvar `atsUsed` e corrigir níveis de idioma               | Duas features novas não funcionam                        |
| 6   | Corrigir `isTraceable` para fronteira de palavra           | A promessa central ("IA não inventa") não está garantida |
| 7   | Calibrar o ATS checker com CVs reais                       | Falso positivo destrói confiança no score                |
| 8   | Atualizar Fastify e DOMPurify                              | Versões instaladas estão em faixas com CVE relevante     |

---

## 2. Placar atual

| Verificação      | Resultado                                                                         |
| ---------------- | --------------------------------------------------------------------------------- |
| `pnpm typecheck` | ✅ passa nos 3 workspaces                                                         |
| `pnpm lint`      | ✅ 0 erros, 115 warnings (`any`, `console`, acessibilidade)                       |
| `pnpm build`     | ✅ passa; bundle web **1.118 MB** (327 KB gzip) em **chunk único**                |
| `pnpm test`      | ✅ **324 testes** (235 API + 72 web + 17 shared)                                  |
| `pnpm audit`     | 🔴 **67 vulnerabilidades**: 4 critical, 24 high, 31 moderate, 8 low               |
| CI               | ✅ existe e roda lint, typecheck, format, build, smoke test e testes com Postgres |
| Migrations novas | ⚠️ duas migrations de ATS/carta estão **untracked** no git                        |
| Deploy prod      | 🔴 quebrado em pelo menos 3 camadas independentes                                 |

---

## 3. P0 — quebrado ou inseguro

### 3.1 Cadastro público + dados não escopados por usuário = vazamento entre contas

- `apps/api/src/routes/auth.ts:92` expõe `POST /api/auth/signup` sem convite, flag ou limite.
- `apps/api/src/plugins/auth-guard.ts` valida sessão, mas **não valida papel** e libera `/api/admin/*` e `/api/setup/*` para qualquer conta.
- `apps/api/src/routes/profile.ts:83` usa `prisma.profile.findFirst()` sem `userId`. O mesmo padrão aparece em:
  - `routes/resumes.ts` (lista/baixa CV de qualquer conta)
  - `routes/cv-optimizer.ts` (otimiza o CV do "primeiro" perfil)
  - `routes/pdf-export.ts`
  - `services/resume-service.ts`
  - `services/application-service.ts`
  - `services/pipeline/matching-step.ts`
  - `workers/job-collection.ts`

**Efeito:** a segunda conta criada enxerga perfil, CVs, candidaturas e matches da primeira. Pior: pode trocar provedor de IA e Telegram (`routes/setup.ts:44-62`), redirecionando CVs e descrições para um host próprio.

**Correção mínima:**

1. Rejeitar signup quando já existe conta (produto é single-user) **ou** implementar `userId` em todas as queries e `role`/admin guard.
2. Trocar `findFirst()` por `findUnique({ where: { userId } })` e derivar o dono de `request.user.id`.
3. Adicionar teste de integração "user B não vê dados de user A".

**Esforço:** baixo para fechar signup; médio para multi-user real.

---

### 3.2 Frontend de produção aponta para `localhost` e o nginx remove `/api`

Duas falhas independentes, ambas fatais:

1. `apps/web/src/services/api.ts:4` usa `import.meta.env.VITE_API_URL ?? 'http://localhost:3001'`. `VITE_*` é **build-time**; o Dockerfile do web não recebe essa variável (`apps/web/Dockerfile`), então o bundle de produção sai apontando para a máquina do visitante.
2. `apps/web/web/nginx.conf:21` faz `proxy_pass http://api:3001/` (barra final remove `/api`), mas **todas** as rotas da API são registradas como `/api/...` (`routes/*.ts`). Resultado: 404 em tudo.

Além disso, `docker-compose.prod.yml` passa `API_URL` para o container web, mas o nginx tem `api:3001` hardcoded e o Vite não lê `API_URL` — configuração morta.

**Correção:** escolher uma das duas arquiteturas e alinhar tudo:

- **Recomendado:** `baseURL: '/api'` no cliente; nginx `proxy_pass http://api:3001` **sem** barra; build arg `VITE_API_URL` só se for usar CDN/API separada.
- **Alternativa:** manter API sem prefixo (ADR-0004) e remover `/api` de todos os handlers.

**Aceite:** `docker compose -f docker-compose.prod.yml up --build -d` + abrir o app + login + listar vagas, sem `localhost` no bundle (`grep -R "localhost:3001" apps/web/dist`).

---

### 3.3 Deploy não aplica migrations nem exige a chave de criptografia

- `apps/api/Dockerfile:52` termina em `CMD ["node", "dist/server.js"]`; não há `prisma migrate deploy`.
- `docker-compose.prod.yml` não tem serviço de migration nem entrypoint.
- O README manda exatamente `docker compose -f docker-compose.prod.yml up --build -d`, então instalação nova sobe API contra banco vazio.
- `docker-compose.yml` (dev) não injeta `SETTINGS_ENCRYPTION_KEY`, que é obrigatória em `apps/api/src/config/env.ts:13`. Quem usar o serviço `api` do compose entra em crash-loop.

**Correção:** entrypoint `pnpm --filter @job-radar/api db:deploy && node dist/server.js` (ou serviço `migrate` com `depends_on: service_completed_successfully`) e injetar a chave no compose dev ou gerar default apenas em `NODE_ENV=development`.

---

### 3.4 Botões principais sem ação no detalhe da vaga

`apps/web/src/pages/job-detail.tsx`:

- `:281` — `<Button>Marcar como aplicada</Button>` sem `onClick`.
- `:333` — `<Button variant="outline">Arquivar</Button>` sem `onClick`.

O usuário clica, nada acontece, nenhum feedback. São duas das ações mais importantes da tela.

**Correção:** ligar em `applicationsApi.create(jobId)` / `updateStatus(id, 'ARCHIVED')`, com estado de loading, toast e atualização do Kanban. Se não for para implementar agora, remover os botões — botão morto é pior que ausência.

---

### 3.5 A lista de vagas não abre o detalhe da vaga

`apps/web/src/pages/jobs.tsx:302-369`: o card só tem "Ver vaga →" (link externo), "Avaliar match" e "+". Não existe `<Link to={/jobs/${job.id}}>`. A página de detalhe — com breakdown, keyword gap, CV, carta e descrição — só é alcançável a partir do Kanban (`applications.tsx`), ou seja, **depois** de o usuário já ter criado candidatura.

**Correção:** título e card clicáveis para `/jobs/:id`; manter o link externo como ação secundária.

---

### 3.6 Versões com CVE relevante instaladas

`pnpm audit` (28/10/2026) aponta, entre outras:

- **Fastify 5.12.1** — advisory de _authentication bypass via malformed URLs_ e _request validation bypass_; corrigido em 5.12.2. O produto depende de um hook global de auth, então isso é especialmente sensível.
- **DOMPurify 3.4.15** via `isomorphic-dompurify` — bypass de `SAFE_FOR_TEMPLATES` e hook em `IN_PLACE`; corrigido em 3.4.17+.
- **Vitest/Tinypool** — critical, mas essencialmente dev-time (não vai para produção).
- **`undici`, `brace-expansion`, `source-map-js`, `follow-redirects`** — high.

**Correção:** subir Fastify para `^5.12.2`, `isomorphic-dompurify`/`dompurify` para versão corrigida, rodar `pnpm update` e adicionar `pnpm audit --audit-level high` no CI (primeiro como informativo, depois como gate).

---

## 4. P1 — sério

### 4.1 Erro de API é exibido como "vazio" em quase todo o produto

Há **0 ocorrências de `isError`** em `apps/web/src/pages` (35 `useQuery`). Com a API fora, o usuário vê:

- "Total de vagas: 0" no dashboard;
- "Nenhuma vaga encontrada";
- "Nenhuma candidatura ainda";
- "Você ainda não tem um CV salvo";
- lista de fontes vazia.

O `error-handler.ts` e os toasts existem, mas nenhuma query os usa. Único componente correto: `AiUsageCard.tsx`.

**Correção:** criar `<ErrorState onRetry={refetch}>` e usar em cada query; nunca renderizar empty state quando `isError`.

---

### 4.2 `atsUsed` é aceito, validado e descartado

- `routes/applications.ts:30` valida `atsUsed` no PATCH.
- `routes/applications.ts:126-132` monta o update **sem** `atsUsed`.
- `applications.tsx:564` mostra o select; o usuário escolhe, recebe 200 e o valor não persiste.

**Correção:** passar `atsUsed: data.atsUsed` no service (que já suporta o campo em `application-service.ts:213`).

---

### 4.3 Nível de idioma: UI envia CEFR, API só aceita enum antigo

- `profile.tsx:170` inicializa `level: 'INTERMEDIATE'` (não existe na lista).
- `profile.tsx:971-975` renderiza `LANGUAGE_LEVELS` com `A1..C2`.
- `routes/profile.ts:50-53` valida `z.enum(['BASIC','INTERMEDIATE','ADVANCED','FLUENT','NATIVE'])`.

**Efeito:** adicionar/editar idioma retorna 400; se o usuário não mexer no select, grava `INTERMEDIATE` e exibe "Inglês (INTERMEDIATE)".

**Correção:** escolher um vocabulário (recomendo CEFR), migrar o enum Prisma e mapear na borda. Também tornar o nível independente do idioma (Português nativo ≠ Inglês C1).

---

### 4.4 A "Regra de Ouro" não é garantida por código

`services/cv-integrity.ts:52-66` diz no comentário "compara por fronteira de palavra", mas usa `knownTerms.includes(normalized)`. Consequências:

- "Go" é considerado rastreável porque "Google" contém "go".
- "Java" passa porque "JavaScript" contém "java".
- "R" passa em qualquer texto com a letra r.

É exatamente o caso que a checagem existe para impedir. `CONTEXT.md` promete que a IA não inventa skills; hoje a garantia é o prompt.

**Correção:** tokenizar o texto e comparar com `\b`, ou usar o catálogo de skills + aliases como fonte da verdade. Adicionar testes com "Google/Go", "JavaScript/Java", "R".

---

### 4.5 ATS checker dá falso positivo em CV de uma coluna

Reproduzido com um CV normal, uma coluna, com bullets curtos:

```
score: 80
issues: ["MULTI_COLUMN"]
stats: { hasMultiColumn: true, hasTable: false, hasContactBlock: true }
```

`cv-ats-checker.ts:103-112` considera multi-coluna quando `shortLines > longLines * 1.5 && shortLines > 20`. Listas de skills e bullets de experiência disparam isso. `detectContactBlock` (`:114-120`) considera `hasName` sempre verdadeiro (qualquer linha), então só valida e-mail/telefone.

**Correção:** detectar colunas por gaps horizontais/proporção, não por comprimento de linha; calibrar com 10–20 CVs reais (1 e 2 colunas); transformar o resultado em "sugestão" quando a confiança for baixa. Um score que acusa o CV errado é pior que nenhum score.

---

### 4.6 Match limitado a 50 e detalhe depende dessa lista

- `services/job-service.ts:286` (`listMatches(profileId, limit = 50)`).
- `job-detail.tsx` procura o match dentro de `match/results`; se a vaga estiver fora do top 50, mostra "Esta vaga ainda não foi avaliada" mesmo já tendo sido avaliada.
- Dashboard também subconta "vagas avaliadas".

**Correção:** endpoint `GET /api/jobs/:id/match` ou incluir `score`/`breakdown` no payload de `GET /api/jobs/:id`.

---

### 4.7 Busca e ordenação são client-side e sem debounce

- `jobs.tsx:55-71` cria uma query por tecla e troca a lista por skeleton a cada caractere.
- `sortBy`/`minScore` entram na `queryKey`, então ordenar refaz request; e a ordenação só afeta a página carregada.
- `limit: 100` trunca Kanban e CVs silenciosamente.

**Correção:** `useDeferredValue`/debounce 300 ms + `keepPreviousData`; mover `sort` e `minScore` para a API; paginar por coluna no Kanban ou mostrar "100 de N".

---

### 4.8 Kanban só funciona arrastando

`applications.tsx:217` registra apenas `PointerSensor`. Não há `<select>`/menu "Mover para…". Teclado e leitor de tela não conseguem mudar status. A coluna vazia ainda instrui "Arraste cards aqui".

Além disso, o sino de follow-up (`:765`) tem `opacity-0 group-hover:opacity-100`, mas nenhum ancestral tem a classe `group` — **o botão é invisível**. E tem 24 px, abaixo do alvo mínimo confortável.

**Correção:** `KeyboardSensor` + menu de status por card; remover `opacity-0` ou adicionar `group`; `aria-label="Agendar follow-up"`.

---

### 4.9 Analytics calcula taxas erradas

`services/analytics.ts:150-154` e `:208-211` usam o **status atual**:

- `responseRate = aplicadas / total` — isso é "taxa de candidatura", não de resposta.
- `interviewRate = entrevistas / aplicadas` — quem avança para entrevista sai de `APPLIED`, então a taxa pode passar de 100% e cair conforme o usuário progride.
- `offerRate = ofertas / entrevistas` — mesma foto instantânea.

O modelo `ApplicationEvent` já guarda o histórico; ele não é usado.

**Correção:** derivar coortes de `ApplicationEvent` (quantas candidaturas chegaram a cada etapa em uma janela) e rotular explicitamente. Enquanto não fizer, renomear para "distribuição atual" para não mentir.

---

### 4.10 Carta de apresentação sempre em inglês

`services/cover-letter.ts:26` instrui "Write in English" mesmo para vaga em português; `:40` corta a descrição em 3.000 caracteres sem avisar. A rota aceita `recruiterName`, mas a UI não envia (`job-detail.tsx:316-332`). E não passa por `checkCvIntegrity`.

**Correção:** idioma como parâmetro (default = idioma da vaga), campo de recrutador na UI, e validar a carta com as mesmas fontes do CV.

---

### 4.11 Dados sensíveis do CV vão para a IA de terceiros

`routes/resumes.ts:24` detecta CPF/RG/endereço **depois** do upload e só devolve no JSON; não persiste nem redige. O otimizador e a carta enviam `resume.rawText`/perfil completos para o `baseUrl` configurado (`services/ai/client.ts:17`, `routes/cv-optimizer.ts`).

O produto promete cuidado com CPF, mas o caminho da IA faz o oposto.

**Correção:** redigir CPF/RG/telefone/endereço antes de qualquer chamada de IA; persistir os achados no `Resume` para o usuário revisar; documentar o que sai da máquina.

---

### 4.12 Segredos decifrados ficam em texto claro no Redis

`services/settings-service.ts:106` faz `redis.setex(cacheKey, TTL, value)` com o valor **já decifrado**. Quem lê o Redis (backup, réplica, `redis-cli`) obtém API keys e tokens em claro.

**Correção:** para `encrypted: true`, cachear apenas ciphertext ou pular o cache L2.

---

### 4.13 Desativar uma fonte na UI não impede a coleta

`routes/admin.ts:125-147` grava `source_<id>_enabled`, e `admin.ts:119` lê para exibir. Mas `sources/index.ts:186` (`collectFromAllSources`) usa `getAllSources()` sem filtro, e `workers/job-collection.ts` também não lê o flag.

**Correção:** filtrar por `enabled` em `collectFromAllSources` ou em `runCollection`.

---

### 4.14 Mudar o cron na UI não reagenda nada

`routes/setup.ts:74-78` grava o cron em settings, mas `upsertJobScheduler` só é chamado no boot (`server.ts:191` → `workers/job-collection.ts:59`). O usuário salva, recebe 204 e o agendamento antigo continua até reiniciar.

**Correção:** chamar `setupCronSchedule()` após salvar.

---

### 4.15 Bot do Telegram aceita qualquer chat e sobrescreve o configurado

`services/telegram-bot.ts:33` — qualquer pessoa que encontrar o bot manda `/start` e `saveChatId(ctx.chat.id)` sobrescreve o chat configurado. Depois `/hoje`, `/top` e `/stats` entregam títulos, empresas e candidaturas para esse chat. O link do dashboard é `http://localhost:5173`.

**Correção:** allowlist comparando `ctx.chat.id` com o setting; ignorar `/start` de chats desconhecidos; usar URL pública configurável.

---

### 4.16 CORS permissivo e rate limit compartilhado atrás do proxy

- `server.ts:98-101`: se `CORS_ORIGINS` estiver vazio, `origin: true` + `credentials: true`. O compose de produção não define a variável.
- `server.ts:103-107`: **um** limite global de 100 req/min, sem `trustProxy`. Atrás do nginx, todos os usuários compartilham o IP do proxy e o mesmo bucket; `/api/auth/login` não tem limite específico.

**Correção:** falhar o boot em produção se `CORS_ORIGINS` estiver vazio; `trustProxy: true`; limites por rota (`/api/auth/*`: 5/min) e chave por IP real.

---

## 5. P2 — melhorias relevantes

| #    | Achado                                                                                  | Evidência                                                     | Correção                                                           |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5.1  | `isTraceable` também não cobre variantes de marca ("Node.js" vs "Node") de forma segura | `cv-integrity.ts:52-66`                                       | Tokenização + catálogo                                             |
| 5.2  | Matching trata "Java" como relacionado a "JavaScript" e "React" a "R"                   | `matching/engine.ts:425-448` usa `includes` nos dois sentidos | Igualdade dentro de grupos + aliases explícitos                    |
| 5.3  | Senioridade do match ignora `job.seniority`                                             | `matching/engine.ts:178-210` só olha o título                 | Usar o campo extraído, título como fallback                        |
| 5.4  | Salário da Adzuna Brasil sai como USD                                                   | `sources/adzuna.ts:103` + `normalizer.ts:148`                 | Passar `currency: 'BRL'` para `country=br`                         |
| 5.5  | Localização "Cambridge"/"Brisbane" casa com filtro Brasil                               | `utils/location-filter.ts:296-300` (`includes('br')`)         | Comparar tokens                                                    |
| 5.6  | LinkedIn monta URL com `join('%20')`, quebra com `&`, `#`, acento                       | `sources/linkedin.ts:25,33`                                   | `URL` + `searchParams.set`                                         |
| 5.7  | Apify manda token na query string e aceita `baseUrl` arbitrário                         | `sources/reddit.ts:46-54`                                     | `Authorization: Bearer` + host allowlist                           |
| 5.8  | `new Redis()` por chamada de `redisConnectionOptions()` vaza conexões                   | `db/redis-connection.ts:18`                                   | Montar opções a partir da URL, sem instanciar cliente              |
| 5.9  | `FAILED` conta como etapa concluída; retry nunca reprocessa                             | `pipeline/orchestrator.ts:18-25`                              | Tratar `FAILED` como não concluído e persistir progresso por etapa |
| 5.10 | `recommendation` nunca produz `APPLY`                                                   | `pipeline/analysis-step.ts:17-28`                             | Mapear as respostas reais do prompt e logar default                |
| 5.11 | Detector de dados sensíveis confunde celular de 11 dígitos com CPF e não persiste       | `sensitive-data.ts:28`; `routes/resumes.ts:24`                | Validar dígitos verificadores; salvar no `Resume`                  |
| 5.12 | Markdown do Telegram não escapa texto de terceiros                                      | `daily-report.ts:83-90`, `telegram-bot.ts:65`                 | Escapar `*_[](<>)``                                                |
| 5.13 | `AiProvider.apiKey` em texto plano no banco                                             | `schema.prisma:453`; contraria ADR-0005                       | Migrar para `SettingsService` ou criptografar                      |
| 5.14 | Serviços de dados ignoram `request.user`                                                | `profile.ts`, `resumes.ts`, `application-service.ts`          | Escopar por `userId` (ver 3.1)                                     |
| 5.15 | Delete sem confirmação em ~12 pontos                                                    | `settings.tsx:547`, skills/experiências                       | `AlertDialog` para ações destrutivas                               |
| 5.16 | Empty states usam `<a href>` e recarregam o app                                         | `empty-state.tsx:43-46`                                       | `<Link>` do react-router                                           |
| 5.17 | Datas `YYYY-MM-DD` deslocam 1 dia em UTC-3                                              | `applications.tsx:636`, `profile.tsx:1417`                    | Normalizar para meio-dia local                                     |
| 5.18 | Filtro de status omite `EXTRACTING`/`ANALYZING`                                         | `jobs.tsx:195-198`                                            | Completar o enum                                                   |
| 5.19 | Enum cru na UI ("INTERESTING", "CV_PREPARED", "JUNIOR", "INTERMEDIATE")                 | `analytics.tsx:149`, `dashboard.tsx:62`, `profile.tsx:915`    | Um mapa único de labels PT-BR                                      |
| 5.20 | Três vocabulários de score (90/80/70/60 vs 80/60 vs 80/50)                              | `match-label.ts`, `dashboard.tsx:45`, `profile.tsx:1312`      | Uma função de faixas                                               |
| 5.21 | `job.sourceId` (cuid) exibido como se fosse nome da fonte                               | `jobs.tsx:344`                                                | Usar `job.source.name`                                             |
| 5.22 | Salário formatado de 3 jeitos e some quando só há um valor                              | `jobs.tsx:336`, `job-detail.tsx:141`, `profile.tsx:851`       | `formatSalary` único, aceitar valor único                          |
| 5.23 | Bundle único de 1,1 MB; 10 páginas eager                                                | `App.tsx:6-16`; build                                         | `React.lazy` + `manualChunks`                                      |
| 5.24 | Acessibilidade sistêmica: 1 `aria-label` no app, `span[onClick]`, labels sem `htmlFor`  | `layout.tsx`, `profile.tsx`                                   | Converter em `<button>`, `aria-label`, Radix Tabs                  |
| 5.25 | Contraste de `--error`/`--accent` abaixo de 4,5:1                                       | `index.css:17,30`                                             | Clarear tokens no tema escuro                                      |
| 5.26 | Mobile: nav de 7 itens sem menu, toast `w-96`, Kanban de 8 colunas                      | `layout.tsx:37`, `toast.tsx:101`, `applications.tsx:316`      | Nav colapsável, toast responsivo, Kanban em abas no mobile         |
| 5.27 | `pipeline.test.ts` testa um array local e passa mesmo se o pipeline sumir               | `tests/pipeline.test.ts:47-60`                                | Apagar ou reescrever contra o orchestrator                         |
| 5.28 | Migrations de ATS/carta não commitadas                                                  | `git status`: 2 pastas untracked                              | Commitar junto com o código; adicionar drift check no CI           |
| 5.29 | `jsdom` importado sem estar declarado                                                   | `normalizer.ts:3`; só `@types/jsdom`                          | Declarar em `dependencies`                                         |
| 5.30 | README/IMPROVEMENTS marcam como feito o que não está                                    | `IMPROVEMENTS.md` Fase 1/2                                    | Reabrir itens e linkar evidência                                   |

---

## 6. Dores reais do público (pesquisa web)

> Estes dados vêm de fontes públicas e servem para orientar prioridade de produto, não como verdade absoluta. Onde a amostra é de outro país, está marcado.

### 6.1 Ghosting é a dor número 1 (Brasil)

Pesquisa Convenia + Opinion Box com **1.211 profissionais brasileiros** (nov–dez/2025):

- **77%** já ficaram sem resposta após entrevistas;
- **39%** dizem que isso acontece na maioria das vezes;
- apenas **6%** nunca passaram por isso;
- salário abaixo da expectativa, demora e desorganização são os principais motivos de desistência.

**O que o Job Radar pode fazer:** o campo `followUpAt` e o sino já existem, mas não há um "cockpit anti-ghosting": lista de candidaturas paradas há X dias, próximo passo sugerido, template de cobrança e resumo no Telegram. Isso é alto impacto e baixo esforço — os dados já estão no banco.

### 6.2 Ansiedade com ATS é enorme — e cheia de desinformação

- Monster 2026 (1.001 candidatos nos EUA): **77%** temem ser descartados por software antes de um humano ver; **54%** querem banir ou regular ATS.
- Especialistas de recrutamento entrevistados em 2026 dizem que a maioria dos ATS **não rejeita sozinha** e que score de IA é pouco usado/confiável.
- A causa mais citada de falha é **mismatch de keywords** e, em segundo, **formatação** (duas colunas, fontes não padrão, texto em caixas).

**O que o Job Radar pode fazer:** posicionar o ATS checker como **educação e diagnóstico**, não como "passe no robô". Explicar por que cada item importa, mostrar trecho do CV que causou o alerta, e nunca prometer que uma keyword garante entrevista. Isso diferencia de ferramentas que vendem "ATS score" milagroso.

### 6.3 Candidatura em volume gera burnout e não gera retorno

Relatos recorrentes no Reddit (r/jobs, r/jobsearchhacks, r/cscareerquestions): "200 candidaturas, 2 entrevistas", "cada candidatura é um mini projeto", "preencher formulário é drenante". Uma estatística de fornecedor (Tracker RMS) afirma que **92% dos candidatos não completam a candidatura** — número a tratar com cautela, mas o padrão é consistente.

**O que o Job Radar pode fazer:** deslocar o produto de "volume" para **qualidade por candidatura**: um "kit da vaga" (CV versionado + carta + keywords + contato + follow-up) e um indicador de esforço/retorno por fonte. Também permite ao usuário ver que 80% do retorno veio de 20% das candidaturas.

### 6.4 Vagas fantasmas e golpes minam a confiança

- Estimativas de mercado variam de **1 em 4** a **1 em 5** vagas anunciadas que não correspondem a posições reais.
- BBC Brasil e imprensa internacional documentam "ghost jobs"; LinkedIn chegou a ser investigado no Texas.
- FTC: perdas reportadas com golpes de emprego passaram de ~US$ 90 mi (2020) para ~US$ 501 mi (2024).

**O que o Job Radar pode fazer:** como ele coleta de várias fontes, tem sinais que ninguém vê isoladamente: `sourceCount`, `collectedAt`, `publishedAt`, repetição do mesmo título/empresa, URL ausente ou de domínio suspeito, descrição genérica/copiada. Um **"índice de confiança da vaga"** (frescor, recorrência, salário, completude, duplicidade) é um diferencial forte e barato de implementar.

### 6.5 Salário escondido é critério de descarte

- **76%** dos candidatos buscam informação salarial antes de se candidatar (Você RH).
- **62%** dizem que salário é o fator que mais pesa entre duas ofertas (Convenia).
- Há pressão legislativa por transparência salarial.

**O que o Job Radar já tem:** `salaryMin`, `salaryMax`, `salaryCurrency` e parser pt-BR. **O que falta:** filtro "só com salário", normalização de moeda consistente, exibir "não informado" como sinal (e não sumir), e benchmark por skill/senioridade usando as vagas coletadas.

### 6.6 IA no currículo: adoção alta, confiança baixa

- **53,1%** dos brasileiros já usaram IA em algum momento do processo seletivo (Heach/Valor, 3.040 profissionais, set/2026).
- **39,4%** apresentaram conteúdo total ou majoritariamente feito por IA como próprio.
- Recrutadores relatam currículos genéricos, com credenciais inventadas (ex.: certificação PMP que o candidato nunca fez) e linguagem "de máquina".
- Ferramentas de currículo são acusadas de serem "wrappers" do mesmo modelo, com pouco diferencial real.

**O que o Job Radar pode fazer:**transformar a "Regra de Ouro" em **diferencial visível**: diff lado a lado, cada bullet novo precisa apontar a evidência no CV/perfil, e um selo "100% rastreável". Hoje a checagem existe, mas é frágil (ver 4.4) e não é mostrada com evidência.

### 6.7 Ferramentas de tracking reclamam de cobrança, trabalho manual e IA genérica

Reviews de Teal, Huntr, Simplify, Careerflow (2026) apontam:

- cobrança após cancelamento e políticas de reembolso ruins;
- status atualizado manualmente, candidaturas fora da extensão não capturadas;
- IA que reescreve de forma genérica, sem grounding na história real;
- planilha continua sendo o tracker mais usado.

**O que o Job Radar pode fazer:** ser **local-first, sem assinatura, com dados na infra do usuário** — isso já é a proposta, mas precisa estar explícito. E reduzir o trabalho manual: captura automática das vagas, atualização de status em um clique, import/export CSV/JSON e lembretes.

### 6.8 Gupy e processos longos (Brasil)

Reportagens e reclamações no Reclame Aqui apontam processo longo, cadastro complexo e feedback raso na Gupy. LinkedIn é o canal principal de descoberta no Brasil (Convenia).

**O que o Job Radar pode fazer:** como ele não é ATS, pode ser o "advogado do candidato": registrar em que etapa cada processo está, há quanto tempo, e sugerir quando cobrar — justamente o que a plataforma da empresa não faz.

---

## 7. Oportunidades de produto derivadas das dores

Ordenadas por impacto × esforço. As três primeiras usam dados que o projeto **já tem**.

### 7.1 Cockpit anti-ghosting (impacto alto, esforço baixo)

- Card no dashboard: "3 candidaturas sem retorno há mais de 7 dias".
- Por candidatura: última interação, dias parados, próximo passo, botão "Registrei contato".
- Templates de mensagem (follow-up, agradecimento pós-entrevista, contraproposta).
- Resumo diário no Telegram com os follow-ups do dia.
- **Aceite:** usuário consegue ver em <10 s o que precisa cobrar hoje.

### 7.2 Índice de confiança da vaga (alto, médio)

- Frescor (`publishedAt`/`collectedAt`), recorrência (`sourceCount`), salário presente, descrição completa, URL válida, empresa repetida.
- Selos: "vista em 3 fontes", "publicada há 2 dias", "sem salário", "possível repetição".
- Filtro "esconder vagas com baixa confiança".
- **Aceite:** usuário entende por que uma vaga foi marcada, sem caça às bruxas.

### 7.3 Salário primeiro (alto, médio)

- Filtro "com faixa salarial" e "a partir de X".
- Normalização BRL/USD e exibição consistente.
- "Não informado" como badge explícito.
- Benchmark: "para React Sênior remoto, as vagas coletadas pagam R$ X–Y".
- **Aceite:** nenhuma vaga com salário único some; nenhuma BRL vira USD.

### 7.4 Kit da candidatura (alto, médio)

- Uma tela por vaga: CV otimizado + carta + keywords + contato + status + follow-up + ATS usado.
- Anexos (carta, portfólio) por candidatura.
- Export CSV/JSON.
- **Aceite:** o usuário não precisa navegar entre 4 telas para aplicar.

### 7.5 ATS honesto e explicável (alto, médio)

- Calibrar heurística com CVs reais; confiança por achado.
- Mostrar o trecho exato que gerou o alerta.
- "Como corrigir" em 1 parágrafo, não só o problema.
- Deixar claro: "isto não garante aprovação; ATS é usado para organizar, não para rejeitar sozinho".
- **Aceite:** um CV de uma coluna com bullets não é acusado de multi-coluna.

### 7.6 Integridade visível (alto, médio)

- Diff antes/depois com destaque do que mudou.
- Cada bullet novo linkado à evidência (CV original ou perfil).
- Bloquear (não só avisar) skill sem evidência.
- "Nada foi inventado" com lista do que foi removido e por quê.
- **Aceite:** teste automatizado com "Google/Go" e "JavaScript/Java".

### 7.7 Privacidade como diferencial (alto, baixo/médio)

- Redigir CPF/RG/telefone/endereço antes de chamar IA.
- Tela "o que sai da sua máquina" por provedor.
- Exportar/apagar todos os dados em um clique.
- Log de auditoria de IA visível ao usuário.
- **Aceite:** nenhum CPF chega ao provedor; usuário consegue apagar tudo.

### 7.8 Aprender com o próprio funil (médio, médio)

- Taxa de resposta por fonte, por faixa de match, por versão de CV.
- "Vagas com score >80 tiveram 3× mais entrevistas" (se verdadeiro nos dados do usuário).
- **Aceite:** analytics usa `ApplicationEvent`, não foto de status.

### 7.9 Acessibilidade e mobile (médio, médio)

- Kanban com menu de status e `KeyboardSensor`.
- Nav mobile colapsável, toast responsivo, tabelas em cards.
- `aria-label` em ícones, `htmlFor` em labels, foco visível, contraste AA.
- **Aceite:** fluxo completo "login → ver vaga → aplicar → mover no Kanban" só com teclado e em 360 px.

---

## 8. Roadmap sugerido

### Sprint 0 — "Não mentir e não vazar" (1–2 dias)

1. Fechar signup público ou escopar por `userId` (3.1).
2. Corrigir produção: `baseURL`, nginx, migrations, chave no compose (3.2, 3.3).
3. Ligar/remover botões mortos e linkar detalhe da vaga (3.4, 3.5).
4. Subir Fastify/DOMPurify (3.6).
5. Commitar as duas migrations untracked.

**Critério de saída:** deploy produtivo sobe do zero, login funciona, lista → detalhe funciona, duas contas não se veem.

### Sprint 1 — "Consertar o que a UI promete" (3–5 dias)

1. `isError` + retry em todas as queries (4.1).
2. `atsUsed` (4.2), idiomas (4.3), cron (4.14), fontes enabled (4.13).
3. `isTraceable` com fronteira de palavra + testes (4.4).
4. ATS checker calibrado (4.5).
5. Match por vaga (4.6), debounce/ordenação no servidor (4.7).
6. Analytics honesto ou renomeado (4.9).

**Critério de saída:** nenhum botão sem ação; nenhuma falha de API vira "0"; features novas persistem.

### Sprint 2 — "Anti-ghosting e confiança na vaga" (1–2 semanas)

1. Cockpit anti-ghosting + templates + Telegram (7.1).
2. Índice de confiança da vaga + filtros (7.2).
3. Salário: filtro, normalização, benchmark (7.3).
4. Kit da candidatura (7.4).
5. Carta PT/EN com integridade (4.10).

**Critério de saída:** usuário vê o que cobrar hoje, esconde vagas duvidosas e vê salário de forma consistente.

### Sprint 3 — "Confiança, privacidade e alcance" (2 semanas)

1. ATS explicável e integridade visível (7.5, 7.6).
2. Redação de PII antes da IA + audit log + export/delete (7.7).
3. Acessibilidade e mobile (7.9).
4. Code splitting + virtualização (5.23).
5. `pnpm audit` gate e drift check de migrations no CI.

---

## 9. O que já está bom (não reescrever)

1. **Sessão e senha** — scrypt com salt, `timingSafeEqual`, token opaco, só hash SHA-256 no banco, cookie HttpOnly/SameSite, TTL e revogação por dispositivo (`services/auth.ts`).
2. **Settings criptografados em repouso** — AES-256-GCM com IV/tag por valor e validação de tamanho da chave no boot (`config/env.ts`, `settings-service.ts`).
3. **Testes de integração reais** — 235 testes de API contra Postgres, incluindo cadeia coleta → dedup → persistência → pipeline.
4. **Resiliência de rede** — `fetchWithTimeout` com `AbortSignal` e tradução de `ENOTFOUND`/`ECONNREFUSED`/timeout.
5. **Shutdown gracioso** — fecha HTTP, workers, queues, bot, Prisma e Redis na ordem certa.
6. **Auditoria de custo de IA** — `AiRun` com tokens, latência e tipo de operação.
7. **Feedback de coleta longa** — painel com cronômetro, parcial vs concluída e erros por fonte.
8. **Honestidade no "Aplicar no perfil"** — só preenche campos vazios, nunca apaga o que o usuário escreveu.

---

## 10. Métricas para acompanhar

| Métrica                                     | Hoje        | Meta                 |
| ------------------------------------------- | ----------- | -------------------- |
| Deploy do zero funcionando                  | 🔴          | ✅ em < 10 min       |
| Contas com acesso cruzado                   | 🔴          | 0                    |
| Queries com `isError`                       | 0 de 35     | 100%                 |
| Ações da UI sem handler                     | ≥ 2         | 0                    |
| Falsos positivos do ATS em CV 1 coluna      | reproduzido | 0 em 20 CVs de teste |
| Cobertura de testes (linhas)                | ~? (medir)  | > 60% em services    |
| Candidaturas com follow-up vencido visíveis | não existe  | 100% no dashboard    |
| Vagas com sinal de "ghost job"              | não existe  | > 80% classificadas  |
| PII enviada à IA                            | sim         | 0                    |
| Bundle gzip                                 | 327 KB      | < 200 KB             |

---

## 11. Fontes consultadas

**Brasil / candidatos**

- Convenia + Opinion Box, _Jornada da pessoa candidata no R&S_ (1.211 profissionais, nov–dez/2025): https://blog.convenia.com.br/pesquisa-jornada-do-candidato
- Heach/Valor Econômico via AI Brasil, _53% dos candidatos usaram IA em processos seletivos_ (3.040 profissionais, set/2026): https://aibrasil.ai/rh/53-dos-candidatos-usaram-ia-em-processos-seletivos-mostra-pesquisa-com-3-mil-pro
- Tecnoblog, _Processo seletivo longo e feedbacks rasos_ (Gupy): https://tecnoblog.net/especiais/processo-seletivo-longo-e-feedbacks-rasos-o-que-acontece-com-a-gupy
- Reclame Aqui, Gupy (409 reclamações): https://www.reclameaqui.com.br/empresa/gupy
- Você RH, transparência salarial (76% buscam salário antes de aplicar): https://vocerh.abril.com.br/mercado-vagas/transparencia-salarial-por-que-divulgar-salario-no-recrutamento
- BBC Brasil, _Vagas fantasmas_: https://www.bbc.com/portuguese/articles/crg4x4rxe91o

**Internacional**

- Monster 2026 via Metaintro, _Half of Job Seekers Want ATS Software Banned_: https://www.metaintro.com/blog/half-job-seekers-want-ats-banned-2026
- Tracker RMS, _Applicant Tracking System Statistics 2026_: https://www.tracker-rms.com/blog/applicant-tracking-system-statistics
- NBC News, _Job scams on trusted sites_: https://www.nbcnews.com/news/us-news/job-scam-ziprecruiter-linkedin-work-postings-fake-listing-rcna238162
- FTC, _Job Scams_: https://consumer.ftc.gov/articles/job-scams
- Offboard, _Best job application trackers 2026_ (limitações de Teal/Huntr/Simplify): https://offboard.co/resources/best-job-application-trackers-2026
- Resumly, _Best job application tracker apps 2026_ (reclamações de cobrança): https://www.resumly.ai/best/best-job-application-trackers
- ResumeYourWay, _AI vs Human Resume Writing_ (credenciais inventadas): https://www.resumeyourway.com/blogs/resume-news/ai-vs-human-resume-writing-the-callback-gap-nobody-talks-about
- Reddit, relatos de burnout: r/jobs, r/jobsearchhacks, r/cscareerquestions (threads citadas na seção 6.3)

---

_Documento vivo. Sugestão: transformar os itens P0/P1 em issues no tracker local (`.scratch/`) com labels `needs-triage` / `ready-for-agent`, e reavaliar o `IMPROVEMENTS.md` antigo — vários ✅ de lá não correspondem ao código._
