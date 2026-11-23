# Auditoria Técnica Profunda — Job Radar

> **Data:** 2026-10-13
> **Commit auditado:** `6ce27d0` (branch `main`)
> **Escopo:** 4 frentes paralelas (backend Fastify, frontend React, infra/CI/build, testes/domínio) + verificação direta do auditor líder.
> **Nenhum arquivo do repositório foi alterado por esta auditoria.**

---

## Sumário Executivo

O Job Radar tem uma **base arquitetural sólida** (monorepo organizado, domínio bem documentado em `CONTEXT.md`, separação em camadas, settings com criptografia, Docker com healthchecks). O código **compila**, passa lint sem erros e tem 20 testes verdes.

O problema não é arquitetura — é **distância entre o que está documentado e o que o código faz**. Um padrão se repete em toda a auditoria: funcionalidades anunciadas em `CONTEXT.md`, `README.md`, ADRs e `IMPROVEMENTS.md` que **nunca foram implementadas**, ou foram implementadas pela metade e hoje falham em silêncio.

Consequência prática: **o caminho de produção documentado não funciona, e várias features principais da UI estão 100% quebradas** — sem que nada no CI acuse.

| Área                                               | Situação                                                  |
| -------------------------------------------------- | --------------------------------------------------------- |
| Build de produção                                  | 🔴 **Quebrado** — a imagem não inicia                     |
| Banco (migrations)                                 | 🔴 **Drift silencioso** — 5 objetos ausentes              |
| CI                                                 | 🔴 **Vermelha** desde a introdução do format check        |
| Features principais (PDF, Formation, Kanban track) | 🔴 **Inoperantes**                                        |
| Segurança                                          | 🟠 API sem auth, CORS irrestrito, SSRF, vazamento de erro |
| Domínio (matching, parsing)                        | 🟠 Bugs reais verificados por execução                    |
| Cobertura de testes                                | 🟠 3,11% real (documentado como ~15%)                     |
| Arquitetura / DX / docs                            | 🟢 Boa base, dívida de manutenção                         |

**Total de achados catalogados:** ~200, dos quais **28 são bloqueadores ou quebram features principais**.

---

## Correções a alegações (verificação própria)

Durante a consolidação, verifiquei diretamente as alegações mais graves. Duas precisaram de ajuste:

1. **`SETTINGS_ENCRYPTION_KEY` do `.env` raiz é VÁLIDA.** Um relatório intermediário afirmou "48 bytes → `Invalid key length` com o `.env` do repo". Executei o teste: o `.env` raiz tem 44 chars → **32 bytes → `createCipheriv` OK**. O problema real é diferente e mais sutil: existe um **segundo** arquivo, `apps/api/.env`, com uma chave de 64 chars → **48 bytes (inválida)**, e `apps/api/tsconfig`/`env.ts` não validam o tamanho. A API roda com a chave raiz porque `dev-up.sh:158` faz `source ../../.env` (não há `dotenv`/`--env-file` no código). A chave ruim de `apps/api/.env` é uma **armadilha latente**: qualquer evolução para `--env-file`, ou rodar a API a partir de `apps/api`, quebra com `Invalid key length` de forma opaca.
2. **`jobs.seniority` realmente não existe** na migration inicial (a linha 57 com `"seniority" "Seniority"` pertence à tabela `profiles`). Confirmado por inspeção do bloco `CREATE TABLE "jobs"`.

---

# TIER 0 — Bloqueadores (impossibilitam deploy/uso)

### T0.1 — Build de produção não inicia

**`apps/api/tsconfig.json:8`** exclui `src/generated/**`, então `dist/generated/` nunca é emitido — mas `dist/db/prisma.js` importa esse caminho.

Reproduzido:

```
node dist/server.js → ERR_MODULE_NOT_FOUND:
  .../dist/generated/prisma/index.js imported from dist/db/prisma.js
```

Atinge `pnpm start` e o target `prod` do Dockerfile da API. A CI não pega porque **não tem step de build**.

> **⚠️ Correção após investigação (Sprint A, 2026-10-14):** a causa-raiz **não** é o `exclude` do tsconfig — ele está correto e é o padrão recomendado pelo Prisma (`src/generated` tem apenas `.js`/`.d.ts`, sem `.ts` para compilar, e `allowJs` é `false`; removê-lo do `exclude` não teria efeito algum).
>
> A causa real é **`incremental: true` + `.tsbuildinfo` velho**: o `tsc` conclui que nada mudou e **não emite nenhum `.js`**. Provado:
>
> | Cenário                    | `.js` emitidos |
> | -------------------------- | -------------- |
> | tsbuildinfo + dist apagado | **0**          |
> | Estado limpo               | **73**         |
>
> Isso é pior do que o diagnóstico original: `pnpm typecheck && pnpm build` (típico em CI) produz um `dist/` **completamente vazio** — o `typecheck` grava o `.tsbuildinfo` e o `build` não emite nada. Sintoma secundário: mesmo com o emit correto, `dist/generated/` não existe (o client fica fora da compilação por design).
>
> **Fix aplicado:** `apps/api/scripts/build.mjs` apaga `tsconfig.tsbuildinfo` + `dist/` antes do `tsc` e copia `src/generated` → `dist/generated`.

**Fix:**

```diff
--- a/apps/api/tsconfig.json
-  "exclude": ["src/generated/**", "dist/**"]
+  "exclude": ["dist/**"]
```

```diff
--- a/apps/api/Dockerfile (stage build)
   RUN pnpm --filter @job-radar/api build
+  RUN pnpm --filter @job-radar/api db:generate
--- a/apps/api/Dockerfile (stage prod)
+  COPY --from=build /app/apps/api/src/generated /app/apps/api/src/generated
```

---

### T0.2 — Drift schema.prisma ↔ migrations (silencioso)

`prisma migrate deploy` em banco novo reporta **sucesso**, mas 5 objetos usados pelo código não existem:

| Ausente no banco                       | Onde quebra                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| Tabela `work_experiences`              | `analysis-step.ts:88` → `include: { workExperiences: true }` |
| Coluna `jobs.seniority`                | `job-collection.ts:181` → insert de vaga                     |
| Coluna `jobs.search_vector`            | `job-service.ts:86` → busca full-text                        |
| Coluna `applications.follow_up_at`     | `application-service.ts:210,222`                             |
| Variante `UNKNOWN` do enum `Seniority` | `utils/seniority.ts` → enum inválido no insert               |

Nenhuma das 9 migrations cria nada disso. `prisma migrate status` diz "up to date".

**Fix:** gerar migration corretiva + gate de drift no CI:

```bash
cd apps/api && pnpm exec prisma migrate dev --name sync_missing_columns
```

```yaml
- name: Drift check
  run: cd apps/api && pnpm exec prisma migrate diff \
    --from-migrations ./prisma/migrations \
    --to-schema-datamodel ./prisma/schema.prisma --exit-code
```

---

### T0.3 — CI vermelha (nunca passou)

`.github/workflows/ci.yml:35` roda `pnpm format:check`, que falha em **95 arquivos rastreados**. O último commit quebrou o pipeline.

**Fix:** `pnpm format` e commitar. Endurecer o hook (T5.4).

---

### T0.4 — Cliente Prisma não roda no Alpine (musl)

`schema.prisma:7` declara `binaryTargets = ["native", "debian-openssl-3.0.x"]`, mas `node:20-alpine` é musl. O target `dev` do Docker também falha com `PrismaClientInitializationError: ... linux-musl`.

**Fix (preferido):** trocar a base para `node:20-bookworm-slim` nos dois Dockerfiles — elimina a classe inteira de problemas musl/OpenSSL.
**Alternativa:** `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`.

---

### T0.5 — Deploy prod quebrado em 4 camadas independentes

`docker-compose.prod.yml` sofre de: build quebrado (T0.1), musl (T0.4), **sem step de migrations** no container, e volume montado no path errado (T4.4). O comentário do arquivo (linha 6) promete _"Non-root users"_ — nenhum Dockerfile tem `USER`.

**Fix:** entrypoint com `migrate deploy` + `USER node` + `cap_drop: [ALL]`.

---

# TIER 1 — Features principais que não funcionam

### T1.0 — 🔴 `GET /api/jobs` estava 100% quebrada (descoberto na Sprint A)

**Não estava catalogado nesta auditoria** — encontrado ao validar a migration.

`job-service.ts` monta SQL bruta usando **nomes de campo do Prisma** em vez dos nomes de coluna do banco:

```ts
LEFT JOIN "job_sources" s ON j."sourceId" = s."id"   // coluna real: source_id
ORDER BY j."collectedAt" DESC                          // coluna real: collected_at
conditions.push(`"searchVector" @@ plainto_tsquery(...)`)  // coluna real: search_vector
```

Como o `JOIN` e o `ORDER BY` rodam em **toda** chamada, qualquer `GET /api/jobs` falhava:

```
Raw query failed. Code: `42703`. Message: `column j.sourceId does not exist`
```

Ou seja: **a página de vagas inteira não funcionava**, mesmo com banco correto.

Problemas encadeados encontrados ao corrigir:

1. **`SELECT j.*` incluía `search_vector`** (tsvector), que o Prisma não desserializa. Substituído por colunas explícitas.
2. **Filtros de enum falhavam** (`status`, `remote`, `seniority`): parâmetro chega como `text` e o Postgres não acha operador comparando com coluna enum. Corrigido com cast `$1::"JobStatus"`.
3. **O resultado vinha em snake_case** (`collected_at`, `source_id`), divergindo do tipo `JobWithSourceName` e do que o frontend espera. Corrigido com aliases camelCase.

> **Verificado:** 14/14 combinações de filtro, busca full-text e paginação passando, com a API realmente no ar respondendo HTTP 200.

### T1.1 — "Exportar PDF" é 100% não-funcional

Duas páginas oferecem como ação principal.

- `pdf-export.ts:15` exige `z.string().cuid()`; o front envia a literal `resumeId: 'default'` (`cv-optimizer.tsx:72`, `job-detail.tsx:56`) → **400**.
- `jobId` é obrigatório no backend e `undefined` em modo manual → **400**.
- Mesmo passando, `api.ts:529` declara `responseType: 'blob'` e **nunca cria o download** — o PDF chega e é descartado.

Verificado: `cuid().safeParse('default').success === false`.

**Fix:** `resumeId` opcional + resolver o default no servidor; baixar o blob com `URL.createObjectURL`.

---

### T1.2 — Adicionar "Formação" sempre falha

`profile.tsx:284,1049` envia `startDate: ''` para um campo `DateTime?` → Prisma estoura. O formulário (linhas 1013-1043) **não tem inputs de data**, então nenhum caminho da UI escapa.

**Fix:** normalizar `startDate: v || null` antes de enviar; endurecer a rota para `z.coerce.date()`.

---

### T1.3 — `workExperiences` não é retornado pela API

`routes/profile.ts:82-92` não inclui `workExperiences` no `include`, mas `api.ts:28` tipa como garantido. Resultado: card permanentemente vazio, sem edição/exclusão, e `profile.tsx:573` caindo em `[]` → **duplicação de experiências a cada clique** em "Aplicar no perfil".

**Fix:** adicionar `workExperiences: true` ao `include`.

---

### T1.4 — Editar provider de IA sem redigitar a key sempre dá 400

`settings.tsx:281-283` tenta spread condicional, mas `...formData` já carrega `apiKey: ''` e `ai-providers.ts:25` exige `min(1)`. A UI promete "deixe vazio para manter" — ação impossível.

**Fix:** `const { apiKey, ...rest } = formData; data: apiKey ? {...rest, apiKey} : rest`.

---

### T1.5 — Formulário de Cron sobrescreve valores salvos

`settings.tsx:202-208` lê `defaultValues` no primeiro render, quando a query ainda é `undefined` → defaults hardcoded. Salvar sobrescreve o banco.

**Fix:** `useEffect` + `cronForm.reset(...)` quando `cronSettings` resolver (padrão que `profile.tsx:219-235` já usa corretamente).

---

### T1.6 — Proxy `/api` quebrado: prod web inutilizável

- `vite.config.ts:15` → `rewrite: path.replace(/^\/api/, '')` e as rotas são `/api/*` → **404** em tudo.
- `nginx.conf:31` → `proxy_pass http://api:3001/` (barra final remove `/api/`) → **404**.
- `VITE_API_URL` está declarado em `vite-env.d.ts` mas **nunca definido** em nenhum `.env`/compose/build-arg. Só funciona em dev porque o browser fala direto com `localhost:3001` via CORS `origin: true`.

**Fix:** implementar o ADR-0004 — `baseURL: '/api'` no cliente e `proxy_pass http://api:3001` (sem barra) no nginx; injetar `VITE_API_URL` como build-arg.

---

### T1.7 — Erros de query renderizados como estado vazio

Nenhum `useQuery` trata `isError` (`dashboard.tsx:41-45`, `jobs.tsx:217`, `analytics.tsx:20-25`, `applications.tsx:283`). Se a API cair, o usuário vê "Total de vagas: 0" / "Nenhuma vaga encontrada" — **o sistema mente sobre o estado**. `error-handler.ts` com retry existe e não é usado.

**Fix:** bloco `isError` com `handleApiError` + `refetch` em todas as queries.

---

### T1.8 — Listener de `window` dentro de `useState` (leak real)

`applications.tsx:215-222`: `useState(() => { addEventListener(...); return () => removeEventListener(...) })`. O inicializador roda uma vez e o cleanup é guardado como _estado_ — **nunca executado**.

**Fix:** mover para `useEffect(..., [])`.

---

### T1.9 — `trackedJobs` dessincronizado

`jobs.tsx:92-95` lê dado assíncrono no `useState` inicial → nasce vazio e nunca sincroniza. Vagas já no quadro aparecem como "não rastreadas"; clicar gera **409** tratado como erro genérico.

**Fix:** derivar com `useMemo` a partir de `existingApplications?.data`; tratar 409 como sucesso.

---

### T1.10 — Kanban sem alternativa de teclado + fonte enable/disable inerte

- `applications.tsx:212`: só `PointerSensor` — a **única** forma de mudar status é arrastar.
- `admin.ts:80` salva `source_<id>_enabled`, mas `job-collection.ts:70` chama `getAllSources()` incondicionalmente e **nunca lê o flag**. Desativar fonte na UI não tem efeito.

**Fix:** `KeyboardSensor` + `<select>` de status no card; filtrar fontes pelo flag em `runCollection`.

---

# TIER 2 — Segurança

### T2.1 — API 100% sem autenticação + CORS `origin: true`

Nenhum hook de auth em 76 arquivos. `server.ts:54` reflete qualquer origem. Um site malicioso no navegador do usuário faz **read** de tudo (CV em texto, descrições) e **write** (trocar chave de IA, disparar coleta, enviar notificação Telegram).

**Fix:** auth single-user (senha em setting) + CORS restrito a `CORS_ORIGINS`.

---

### T2.2 — Sem `setErrorHandler`: mensagem crua vaza ao cliente

Zero ocorrências. O handler padrão do Fastify serializa `error.message` — erros de Prisma, de provedor de IA e de scraping chegam ao usuário final. Agravado por:

- `client.ts:32` → `throw new Error(...${corpoDoProvedor})`
- `test-connection.ts:27` → corpo devolvido ao front
- `server.ts:96,104` → `/health/ready` expõe `err.message`

**Fix:** error handler global + sanitizar erros de IA.

---

### T2.3 — SSRF e XSS por validação frouxa de URL

Verificado por execução própria — `z.string().url()` **aceita**:

```
javascript:alert(1)                -> ACEITO
http://169.254.169.254/latest/... -> ACEITO   (metadata cloud → SSRF)
file:///etc/passwd                -> ACEITO
```

- `test-connection.ts:11` faz request ao `baseUrl` do cliente e devolve o corpo → proxy interno.
- `routes/jobs.ts:29` → `job.url` vira `href` clicável no front.

**Fix:** `.refine(u => /^https?:$/.test(new URL(u).protocol))` + allowlist de host para `baseUrl`.

---

### T2.4 — `settings-gate.ts` é um no-op total

`plugins/settings-gate.ts:6-16` registra um hook que **não faz nada** — não importa `SettingsService`, não chama `reply.send`. A ADR-0005:56 e `CONTEXT.md:77` prometem bloquear `/api/*` até `completed_at`. Nunca bloqueou nada. Confirmado por 3 auditores independentes.

**Fix:**

```ts
const { completed } = await settingsService.getCompletion();
if (!completed) return reply.status(423).send({ error: 'setup_required' });
```

---

### T2.5 — `POST /api/settings` sem allowlist

`routes/settings.ts:6-9` aceita `scope`/`key`/`isSecret` arbitrários — qualquer cliente escreve qualquer setting, sem auth.

**Fix:** allowlist por escopo + `isSecret` derivado do servidor.

---

### T2.6 — Fallback de descriptografia devolve a máscara como credencial

`settings-service.ts:84-86`: `catch { value = setting.value }` — se a descriptografia falhar, o sistema passa a usar o literal `'********'` como API key. `adzuna.ts:34-45` e `factory.ts:12-26` não filtram (só `reddit.ts` o faz).

**Fix:** em falha de decrypt, lançar erro explícito — nunca degradar para o placeholder.

---

### T2.7 — Sanitização parcial + Telegram Markdown sem escape

- `normalizer.ts:80-122` sanitiza só `description`. `reddit.ts:78-91` **não passa por** `normalizeJobFields` e grava `title`/`company` brutos.
- `profile.ts` grava `summary`/`focusStacks`/`discardTerms` sem sanitizar.
- `telegram-bot.ts:19-132` e `daily-report.ts:83-90` interpolam dados raspados em `parseMode: 'Markdown'` — título com `[text](url)` injeta link.

**Fix:** sanitizar todos os campos de texto na ingestão; escape de Markdown.

---

### T2.8 — Upload sem magic bytes (risco contido)

`resume-service.ts:6-24` confia no `mimetype` declarado pelo cliente. **Atenuação real:** `extractText` roda **antes** de `saveFile` (`:28` vs `:35`), e `file-storage.ts:28` gera `randomUUID()+ext` — sem path traversal ativo. Ainda assim: `readFileStream`/`deleteFile` fazem `join(UPLOAD_DIR, filename)` com valor do banco sem `basename`.

**Fix:** allowlist de extensão + validação de magic bytes (defesa em profundidade).

---

# TIER 3 — Integridade de dados e domínio

### T3.1 — Parser de salário infla BRL 100× e descarta valores únicos

`normalizer.ts:37-38`: `Number(match[1].replace(/[,.]/g, ''))` remove vírgula **e** ponto. Verificado por execução:

```
"R$ 8.000,00 - 12.000,00" => 800000 - 1200000   (100× inflado)
"R$ 10.000" (valor único)  => null              (descartado)
```

Vagas brasileiras entram com salário 100× e aparecem assim no relatório diário e no front.

**Fix:** detectar separador decimal pt-BR (`8.000,00` → `8000.00`); aceitar valor único.

---

### T3.2 — `parseRemoteMode` derruba remoto-sem-país para `on_site` e descarta a vaga

`normalizer.ts:22`: qualquer location não-vazia sem padrão conocido vira `on_site`. `normalizeJobFields:162` deriva `remote` **só de `location`**, ignorando `tags`. RemoteOK marca `tags: ['remote']` com `location: ''` → `unknown`. Depois `location-filter.ts:156-159` **exclui** o que contém "remote" sem país → vagas 100% remotas são descartadas antes de qualquer filtro.

**Fix:** usar `tags` + `location`; nunca assumir `on_site` — default `unknown`.

---

### T3.3 — Matching: `C++` colide com `C#`; `JS` vira string vazia

`engine.ts:267`: `.replace(/[^a-z0-9]/g,'')`. Verificado por execução:

```
norm('C++') === norm('C#')  -> true    (match 100% entre C# e C++)
norm('JS')   -> ""                     (casa com qualquer skill vazia)
```

Viola `CONTEXT.md:23` ("match exato: skill idêntica após normalização"). O seed já tem os aliases corretos — a colisão é da normalização.

**Fix:** preservar símbolos significativos; usar `Skill.aliases` como fonte da verdade; nunca retornar string vazia.

---

### T3.4 — Matching: classificação Cloud/DevOps por substring

`engine.ts:220`: `norm.includes(kw) || kw.includes(norm)` — `'googlecloud'.includes('go')` e `'terraform'.includes('r')` fazem `Go` e `R` contarem como cloud, derrubando o score de vagas sem cloud algum.

**Fix:** comparar apenas igualdade/prefixo normalizado com word-boundary.

---

### T3.5 — Matching: `matchedSkills` mutado **depois** do score

`engine.ts:63` roda `computeCloudDevOpsScore` depois de `totalScore` e faz `matched.push`/`partial.push` nos arrays retornados (`:231,234,236`). Consequências: skills no resultado que não contribuíram para o score, e uma skill em `partial` **e** `missing` ao mesmo tempo. Também acoplamento oculto por parâmetro de saída (`:57-64`) — a ordem das chamadas muda o resultado.

**Fix:** computar cloud em lista local e mesclar **antes** de fechar o score, com partição disjunta.

---

### T3.6 — Matching: critério `other` é um fixo 50

`engine.ts:65` — peso 0,05 constante. Impede 100 em qualquer vaga (o teste "perfect match" passa com `>85` justamente por isso) e um perfil recém-criado (sem skills) recebe 0/20 em experiência → todas as vagas para `SKIP`. Vaga sem nenhuma informação + perfil vazio = score **55 → CONSIDER**: o produto sugere candidatura para vagas que não conseguiu avaliar.

**Fix:** remover o critério fake e redistribuir pesos; tratar "sem dados" como neutro 50.

---

### T3.7 — Três regimes de recomendação incompatíveis

- `engine.ts:259-263`: 85/70/50 (e é **código morto** — nunca persistido)
- `analysis-step.ts:57-58`: 80/60, com vocabulário inventado `'Alta'|'Média'|'Baixa'`
- `matchLabel` (shared): 90/80/70/60 — **o único alinhado ao `CONTEXT.md`**, e não é usado pelo engine

**Fix:** uma única função derivando das faixas canônicas; persistir `recommendation` em `JobMatch`.

---

### T3.8 — Regra de Ouro "A IA não inventa" sem garantia programática

`cv-optimization-service.ts:68-82` devolve o texto do LLM direto para o PDF (`pdf-export.ts:31-44`). Nenhuma verificação de que skills/palavras existam no CV original — a conformidade depende **exclusivamente do prompt**. `keywordsAdded`/`changes` existem justamente para permitir a checagem e são apenas ecoados ao front. Critério de aceite do Sprint 002 permanece não-marcado.

**Fix:** `assertNoNewSkills(result, [resume.rawText, profileContext])` antes do retorno + teste.

---

### T3.9 — Pipeline não marca `FAILED`: vaga trava para sempre

Nenhum dos 3 steps escreve `status: 'FAILED'`. Com `attempts: 3` e backoff, após a última falha o job fica em `ANALYZING` indefinidamente — e `telegram-bot.ts:129` reporta "Com erro: 0" **sempre**. Agravado por T3.10.

**Fix:** `try/catch` no `orchestrator.run` marcando `FAILED` + log, preservando o retry.

---

### T3.10 — Pipeline não é idempotente (custo de IA duplicado)

`processing.ts:27-43` usa `queue.add(name, { jobId })` sem `jobId` determinístico. Re-coletar + `POST /api/admin/process-all` reprocessa IA em jobs já analisados; `attempts: 3` multiplica chamadas; `extraction-step` cria `Skill` a cada tentativa.

**Fix:** `add(name, data, { jobId: 'extract-'+jobId })` + guarda de estado no início de cada step.

---

### T3.11 — `AnalysisStep` grava `profileId: ''`

`analysis-step.ts:133,144`: `match?.profileId ?? ''` — string vazia em coluna com FK. Se o match não existir (ex.: `matching-step.ts:21-27` retornou antes), o upsert estoura e a vaga trava em `ANALYZING`.

**Fix:** early-return `if (!match) return` antes do upsert.

---

### T3.12 — Fallback sem IA casa substring

`extraction-step.ts:65-67`: `descriptionLower.includes(skill.name)` — "JavaScript" casa com `Java`; "R" casa dentro de qualquer palavra. Sem IA, o catálogo de skills da vaga é lixo que alimenta todo o matching. O fallback também zera `experienceYears`/`languages`, derrubando 2 dos 7 critérios em silêncio.

**Fix:** word-boundary mínimo; se nenhuma skill casar, retornar `[]`.

---

### T3.13 — Google Jobs: regex com 5 grupos, destructuring de 7

`google-jobs.ts:54-68` — `url` recebe `match[6] === undefined` → `url: url || ''` grava string vazia em `jobs.url` para **todas** as vagas da fonte. Quebra o hash de dedup.

**Fix:** alinhar grupos/posições.

---

### T3.14 — Dedup por hash instável e sem merge

`job-collection.ts:27-30`: hash sobre `title|company|url`. Duas fontes com a mesma URL colapsam (intencional) **mas dados melhores da segunda fonte são descartados** — só `collectedAt` é atualizado. Se a descrição mudar na origem, o hash permanece e o usuário vê texto defasado para sempre. O `@@unique([externalId, sourceId])` do schema existe e não é usado.

**Fix:** usar o par único do schema + merge de campos.

---

### T3.15 — Fallback de análise devolve chaves internas como skills

`analysis-step.ts:48-50`: `pontos_fortes` recebe chaves do breakdown (`technologies`, `location`...) em inglês, não skills. É conteúdo visível na UI. Viola o contrato do `JobAnalysis` e a semântica de "Gap" (`CONTEXT.md:17`).

**Fix:** popular a partir de `matchedSkills`/`missingSkills` reais.

---

# TIER 4 — Robustez operacional

### T4.1 — Nenhum `fetch` tem timeout

11 chamadas sem `AbortSignal`: `google-jobs.ts:22`, `linkedin.ts:35`, `indeed.ts:36`, `adzuna.ts:71`, `jobicy.ts:45`, `weworkremotely.ts:58`, `remotive.ts:33`, `remote-ok.ts:27`, `reddit.ts:50`, `client.ts:16`, `test-connection.ts:11`. Uma fonte pendurada segura o `Promise.all` (`sources/index.ts:162`) e o worker inteiro. `linkedin.ts:79` ainda tem `randomDelay(2000, 8000)` **dentro** do `Promise.all`.

**Fix:** `AbortSignal.timeout(15_000)` em todos.

---

### T4.2 — Sem graceful shutdown

Nenhum `SIGTERM`/`SIGINT` em `server.ts`. `stopTelegramBot()` existe (`telegram-bot.ts:152-157`) e **nunca é chamada**. Cada deploy pode matar jobs no meio, deixando registros `MATCHING`/`ANALYZING` órfãos para sempre. `main()` também não é `catch`-ado.

**Fix:** handler de shutdown fechando worker/queue/prisma/redis/bot.

---

### T4.3 — BullMQ: senha/TLS do `REDIS_URL` descartadas

`processing.ts:9-15` e `job-collection.ts:19-25` montam `{ host, port }` de `new URL(...)`. Com `redis://:senha@host:6380/1` a conexão falha. Sem `maxRetriesPerRequest: null` (exigência do BullMQ), sem `lockDuration`/`stalledInterval` — o lock default de 30s pode expirar antes de uma chamada de IA terminar → **reprocessamento e custo duplicado**.

**Fix:** passar a instância `Redis` completa; configurar lock/stalled.

---

### T4.4 — Uploads em caminho errado: CVs perdidos no rebuild

`file-storage.ts:8` grava em `process.cwd()/uploads` → no container `/app/apps/api/uploads`. Os dois composes montam o volume em `/app/storage`. **Paths diferentes**: o volume nunca é usado e os CVs somem no `down`/rebuild.

**Fix:** alinhar o mount point com `UPLOAD_DIR`.

---

### T4.5 — 41 `console.*` no lugar do logger; `reqId` não propagado

`app.log` é usado só 7 vezes, todas no bootstrap. Sem `AsyncLocalStorage`, um erro de `/api/cv/optimize` e o `ai_runs` correspondente não podem ser correlacionados.

**Fix:** migrar para `request.log`/pino; `AsyncLocalStorage` para `reqId`.

---

### T4.6 — `AiRun` funcionalmente cego

`runOperation(type, fn)` (`instrumented.ts:48-69`) tem **zero callers** — todas as chamadas usam `chat()`, que loga tipo `'OTHER'` (`:31`). O filtro `?type=` de `/api/admin/ai-runs` é inútil. `costUsd` (`schema.prisma:409`) **nunca é escrito**; `admin.ts:205-207` recalcula com taxa hardcoded `$0.01/$0.03` — errada para o modelo default `deepseek-v4-flash`.

**Fix:** services chamarem `runOperation`; persistir `costUsd`.

---

### T4.7 — Coleta com N+1 e sem `enabled`

`job-collection.ts:118-171`: `jobSource.findFirst` por fonte + `job.findUnique`/`update` **por vaga**, tudo em `await` dentro de `for`. Deveria ser `findMany({ where: { hash: { in } } })` + `createMany({ skipDuplicates: true })`. `enqueueJobPipeline` (`processing.ts:39-43`) faz N round-trips Redis sequenciais.

**Fix:** bulk queries + `addBulk`.

---

### T4.8 — `AnalysisStep` carrega 3 relações sem usar

`analysis-step.ts:85-124` inclui `workExperiences`, `education`, `certifications` — nenhuma é usada por `analyze(...)`. ~1.500 linhas/dia lidas à toa. Também busca um `resume` inteiro (até 10 MB de `parsedJson`) para usar só `rawText`, sem `select`.

**Fix:** `select` explícito.

---

### T4.9 — Analytics carrega tabelas inteiras

`analytics.ts:40-133`: três `findMany` completos + agregação em JS + `IN list` de tamanho variável — em request síncrono, sem cache. A rota não valida `days`: `?days=abc` → `NaN` → filtro de data inválido silencioso.

**Fix:** `groupBy`/`count` no banco + `z.coerce.number()`.

---

### T4.10 — `ExtractionStep` N+1 com `mode: 'insensitive'`

`extraction-step.ts:21-37`: 2 queries por skill, sequenciais. `mode: 'insensitive'` **não usa** o `@unique` em `name` — e como o unique do Postgres é case-sensitive, `React`/`react`/`REACT` podem coexistir, degradando o match.

**Fix:** resolver skills em lote com normalização consistente.

---

# TIER 5 — Qualidade e manutenibilidade

| #     | Achado                                                                       | Evidência                                                                                                                                                                                                           | Fix                                                                                  |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| T5.1  | **Cobertura real 3,11%** com CI verde                                        | 20 testes; `pipeline.test.ts` **não importa código de produção** — testa arrays literais hardcoded (`:52-57`) e tem tautologias (`:116`). `IMPROVEMENTS.md:293` alega ~15%                                          | Substituir por teste real do `PipelineOrchestrator` com dupla de `ProcessingContext` |
| T5.2  | Frontend e shared sem testes                                                 | `"test": "echo 'test placeholder'"` em `apps/web:14` e `packages/shared`                                                                                                                                            | `vitest run --environment jsdom`                                                     |
| T5.3  | `packages/shared` descreve domínio inexistente                               | `APPLICATION_STATUSES` em pt-Br minúsculo vs enum Prisma `FOUND/INTERESTING/...`; `SENIORITIES` → `isSeniority('SENIOR') === false`; `SENIORITY_LABELS` com classes Tailwind que não existem no config              | Regenerar tipos dos enums Prisma/Zod                                                 |
| T5.4  | Hook pre-commit inócuo                                                       | `.husky/pre-commit` só roda `prettier --write` — **corrige sem falhar**, por isso 95 arquivos entraram                                                                                                              | `eslint --max-warnings 0` + `prettier --check`                                       |
| T5.5  | Cliente Prisma versionado (19 MB, binário glibc de 16 MB)                    | `git ls-files apps/api/src/generated` → 19 arquivos; `.gitignore` não cobre                                                                                                                                         | `git rm -r --cached` + gerar no `postinstall`                                        |
| T5.6  | `.dockerignore` por app são inertes                                          | Build context é a raiz; ~490 MB (`.git` 49 MB + `node_modules` 440 MB + `.env` com chave real) vão para o daemon em cada build                                                                                      | Criar `.dockerignore` na raiz                                                        |
| T5.7  | CI sem build, sem Postgres/Redis, sem audit, sem `concurrency`/`permissions` | `.github/workflows/ci.yml:9-38`                                                                                                                                                                                     | Adicionar jobs `build` + `integration` + `pnpm audit --audit-level high`             |
| T5.8  | 40 vulnerabilidades sem gate                                                 | 3 critical (`vitest`, `tinypool`), 17 high — **`fastify <5.12.2` com authentication bypass em produção**                                                                                                            | `pnpm update` + gate de audit                                                        |
| T5.9  | `pnpm/action-setup` com `version: 9` não fixado                              | Divergente de `packageManager: pnpm@9.15.0`                                                                                                                                                                         | `version: 9.15.0` + `run_install: false`                                             |
| T5.10 | `dev-down.ps1` não mata nada                                                 | `$_.CommandLine` não existe em `Get-Process` (é CIM) → filtro nunca casa; imprime "stopped" e deixa rodando                                                                                                         | `Get-CimInstance Win32_Process`                                                      |
| T5.11 | `dev-down.sh` usa `pkill -f` amplo                                           | `pkill -f "vite"` mata processos de outros projetos                                                                                                                                                                 | pidfile escrito pelo `dev-up.sh`                                                     |
| T5.12 | `dev-up.ps1` aborta em máquina limpa                                         | `Load-EnvFile` só na linha 193, depois do health check → `pg_isready -U -d` com args vazios falha 30× e sai com erro mesmo com Postgres saudável                                                                    | Mover o load para antes                                                              |
| T5.13 | Scripts bash sem `set -euo pipefail`                                         | `dev-up.sh:7`, `dev-down.sh:5` usam só `set -e`                                                                                                                                                                     | Adicionar `uo pipefail`                                                              |
| T5.14 | `command -v docker compose` não valida o plugin                              | Bash interpreta como dois operandos; casa com `/bin/compose`                                                                                                                                                        | `docker compose version`                                                             |
| T5.15 | Sem detecção de porta ocupada / não idempotente                              | Rodar `dev-up.sh` 2× inicia segunda instância e falha em 30s sem explicar                                                                                                                                           | `ss -ltn` / `Get-NetTCPConnection`                                                   |
| T5.16 | Seed falha silenciosamente mas imprime "Database seeded"                     | `dev-up.sh:124-129` — `2>/dev/null` esconde a causa                                                                                                                                                                 | Propagar erro                                                                        |
| T5.17 | Nomes de container/volume colidem dev↔prod                                   | `job-radar-api`, `job-radar-postgres-data` idênticos nos dois composes → prod anexa nos volumes de dev (e na chave de dev)                                                                                          | Derivar nomes do projeto                                                             |
| T5.18 | Imagens base não fixadas                                                     | `node:20-alpine`, `postgres:16-alpine` — tags móveis quebram reprodutibilidade (e causaram o musl)                                                                                                                  | Fixar por digest                                                                     |
| T5.19 | Divergência de licença                                                       | Raiz sem `license`; 4 pacotes `UNLICENSED`; README afirma GPL-3 com copyleft forte                                                                                                                                  | `GPL-3.0-or-later` + nota no README                                                  |
| T5.20 | README documenta scripts inexistentes                                        | `pnpm db:push` (não existe em lugar nenhum), `db:seed`/`db:studio` (só em `apps/api`). `SETUP.md:337` quebra o fluxo de update                                                                                      | Scripts proxy na raiz                                                                |
| T5.21 | `jsdom` importado mas não declarado                                          | `normalizer.ts:3` — `new JSDOM('')` roda no **import** do módulo; só `@types/jsdom` está declarado. Resolve por hoisting transitivo                                                                                 | Adicionar `"jsdom"` às deps                                                          |
| T5.22 | Bundle 1,1 MB sem code splitting                                             | Zero `React.lazy`/`Suspense`; `recharts` + `@dnd-kit` + 9 páginas no chunk de entrada                                                                                                                               | `lazy()` por rota + `manualChunks`                                                   |
| T5.23 | Listas sem memo/virtualização                                                | `jobs.tsx:115-127` reordena e reconstrói `Map` a cada keystroke; `JobCard` sem `memo`                                                                                                                               | `useMemo` + `React.memo`                                                             |
| T5.24 | Acessibilidade sistêmica                                                     | `span[onClick]` sem `role`/`tabIndex` (`profile.tsx:969-986`); ~20 botões só com `×` sem `aria-label`; abas sem `role="tablist"` (Radix Tabs instalado e não usado); contraste `text-error` ~2,4:1 (AA exige 4,5:1) | Converter em `<button>` + `aria-label`; migrar tabs                                  |
| T5.25 | Ações destrutivas sem confirmação                                            | 12 pontos de delete sem diálogo — o projeto não usa `confirm()` em lugar nenhum                                                                                                                                     | `AlertDialog` para `variant="danger"`                                                |
| T5.26 | `<a href>` em CTAs de empty state                                            | `empty-state.tsx:43-46` — full page load, perde cache do React Query                                                                                                                                                | `<Link>`                                                                             |
| T5.27 | Off-by-one de fuso em todas as datas                                         | `new Date('YYYY-MM-DD')` é meia-noite UTC → em UTC-3 exibe o **dia anterior** (`profile.tsx:1417`, `applications.tsx:558`)                                                                                          | Normalizar para meio-dia local                                                       |
| T5.28 | Ordenação cliente-side só afeta a página carregada                           | `jobs.tsx:115-127` — servidor sempre ordena por `collectedAt DESC` e pagina                                                                                                                                         | Expor `sort`/`minScore` na API                                                       |
| T5.29 | Busca sem debounce; `limit: 100` trunca silenciosamente                      | Uma request por tecla; Kanban some com 101+ candidaturas                                                                                                                                                            | `useDeferredValue` + paginar por coluna                                              |
| T5.30 | `sanitizeUrl`/`sanitizeText` são código morto                                | `lib/sanitize.ts:54-76` nunca importados; `job.url`/`cert.url` vão direto para `href`                                                                                                                               | Aplicar em todos os `href`/`window.open`                                             |
| T5.31 | Chaves de lista instáveis                                                    | `key={keyword}` / `key={skill}` em dados de usuário/IA que **podem duplicar**                                                                                                                                       | `key={`${i}-${v}`}` ou dedupe                                                        |
| T5.32 | Filtro de status oferece subconjunto do enum                                 | `jobs.tsx:186-193` omite `EXTRACTING`/`ANALYZING` — vagas nesses estados parecem não existir                                                                                                                        | Completar opções                                                                     |
| T5.33 | `keyword.*` é lido mas nunca escrito                                         | `job-collection.ts:83-85` lê settings que nenhuma tela grava → layer morto                                                                                                                                          | Expor na UI ou remover                                                               |
| T5.34 | `AiProvider.apiKey` em texto plano                                           | `schema.prisma:429` — viola ADR-0005, que determina setting secret criptografado                                                                                                                                    | Migrar para `SettingsService`                                                        |
| T5.35 | `/api/setup/ai` e `/api/setup/telegram` são endpoints mortos                 | Nenhuma tela chama; gravam settings que ninguém lê (ver T5.34)                                                                                                                                                      | Remover ou ligar                                                                     |
| T5.36 | `dev-up.sh` em `/tmp` fixo + `cleanup` não mata filhos                       | Impede duas instâncias; `jobs -p                                                                                                                                                                                    | xargs kill`mata subshells, não`tsx`/`vite`                                           | `pkill -P` + paths únicos |

---

## Ordem de execução recomendada

**Sprint A — Destravar build e deploy (1 dia)**
`T0.1` → `T0.2` → `T0.3` → `T0.4` → `T5.5` → `T5.6` → `T5.7` (build na CI)

**Sprint B — Fazer as features principais funcionarem (2-3 dias)**
`T1.1` → `T1.3` → `T1.2` → `T1.4` → `T1.5` → `T1.8` → `T1.9` → `T1.10`

**Sprint C — Fechar buracos de segurança (2-3 dias)**
`T2.1` → `T2.2` → `T2.3` → `T2.4` → `T2.5` → `T2.6` → `T5.8` → `T5.9`

**Sprint D — Integridade de dados (3-4 dias)**
`T1.6` → `T3.1` → `T3.2` → `T3.3` → `T3.4` → `T3.5` → `T3.11` → `T3.12` → `T3.13`

**Sprint E — Robustez operacional (3-4 dias)**
`T4.1` → `T4.2` → `T4.3` → `T4.4` → `T4.7` → `T4.5` → `T4.6`

**Sprint F — Domínio e qualidade (contínuo)**
`T3.6` → `T3.7` → `T3.8` → `T3.9` → `T3.10` → `T5.1` → `T5.2` → `T5.3` → demais T5

---

## Nota sobre o `IMPROVEMENTS.md` existente

O documento pré-existente acerta em vários diagnósticos (tema escuro, empty states, full-text search, backup de banco, i18n, bundle), mas **marca com ✅ itens que não estão concluídos** — entre eles "Teste de conexão IA no wizard" (existe, mas o fluxo grava em lugar que ninguém lê, T5.34/T5.35), "Empty states ilustrados" (existem, mas com `<a href>` causando reload, T5.26) e "Toast de erro acionável" (existe, mas não é usado em nenhuma query, T1.7). A seção "Fase 1 — Pronto para Amigos" deveria ser reaberta: **o produto ainda não está pronto para amigos** enquanto o Tier 0 e o Tier 1 estiverem abertos.

---

_Auditoria realizada sem alterar arquivos do repositório. Todos os achados possuem evidência de arquivo:linha; os marcados como "verificado por execução" foram reproduzidos diretamente._
