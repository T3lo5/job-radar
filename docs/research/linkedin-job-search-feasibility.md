# Viabilidade de busca de vagas no LinkedIn (gratuita, ToS-clean)

> **Data da pesquisa:** 2026-09-02
> **Escopo:** investigar se é possível, de forma gratuita e respeitando o User Agreement, fazer uma busca abrangente no LinkedIn que cubra (a) vagas publicadas em LinkedIn Jobs (páginas oficiais) e (b) vagas publicadas como posts de usuários (fora do LinkedIn Jobs).
> **Método:** somente fontes primárias (documentação oficial da Microsoft Learn/LinkedIn, robots.txt, User Agreement, API Terms of Use, Crawling Terms).

---

## 1. Resumo executivo

**Resposta curta:** não existe, em 2026-09, nenhum caminho gratuito, oficial e ToS-clean que entregue as duas categorias de forma programática.

- **(a) Vagas oficiais (LinkedIn Jobs):** existe um *Job Posting API* (write-only — para ATS postarem vagas no LinkedIn) e um ecossistema de Talent Solutions voltado a parceiros contratados. **Não existe endpoint público de leitura ("Job Search API") aberto a terceiros.** Histórico: a Talent Solutions Job Search API foi descontinuada em 2024.
- **(b) Vagas como user posts:** não há API que exponha o feed de posts de usuários nem permita busca por "vagas" em posts. O "Sign In with LinkedIn" (OIDC) devolve apenas perfil leve (`sub`, `name`, `email`, `picture`); nada de feed, posts, conexões ou busca.

Conclusão prática: um tracker gratuito e ToS-clean precisa ou (i) depender de uma fonte parceira que já negociou acesso, ou (ii) usar uma fonte terceira agregadora (Google Jobs via `site:linkedin.com/jobs/...`, Adzuna, etc.) que consome o índice público por vias legítimas. Fazer scraping das páginas HTML do LinkedIn viola o robots.txt (`Disallow: /search*`, `Disallow: /jobs?runSearch*`, `Disallow: /voyager/api`, `Disallow: /feed/update/`) e o User Agreement §8.2 (proíbe scraping/robôs).

---

## 2. APIs oficiais gratuitas

### 2.1. Panorama do Developer Program

A Microsoft Learn hospeda três áreas de APIs LinkedIn: **Marketing**, **Talent Solutions** e **Consumer Solutions**. Fonte: https://learn.microsoft.com/en-us/linkedin/

**Marketing API** (https://learn.microsoft.com/en-us/linkedin/marketing/quick-start): cobre Advertising, Community Management (posts orgânicos de páginas), Lead Sync, Conversions, Events, Matched Audiences. **Nenhuma superfície de leitura de jobs.** Posts que aparecem são os de Company Pages administradas pelo app autenticado — não o feed pessoal de usuários.

**Talent Solutions API** (https://learn.microsoft.com/en-us/linkedin/talent/): categoria "**Job Posting**" é a única relacionada a vagas. Inclui:
- *Job Posting API* — **write-only** (criar/atualizar vagas de clientes ATS no LinkedIn). https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview
- *Apply Connect*, *Apply with LinkedIn*, *Recruiter System Connect*, *CRM Connect* — fluxos de aplicação/sincronização de candidatos.
- Nenhum endpoint público de "search jobs" exposto a terceiros.

**Consumer Solutions API** (https://learn.microsoft.com/en-us/linkedin/consumer/): "Sign In with LinkedIn" (OIDC) + "Share on LinkedIn" + Plugins. Limitada a autenticação de membros e publicação de conteúdo. Não há endpoint de feed/search.

### 2.2. Job Posting API — só escreve, e é fechado a novos parceiros

> "We are currently not accepting new partnerships for LinkedIn's Job Posting API." — https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview

> "The use of these APIs is restricted to those developers approved by LinkedIn. Please reach out to your LinkedIn Relationship Manager..." — mesma página, seção "Job Posting Legal Requirement".

Ou seja: a API que toca vagas LinkedIn Jobs (a) é somente para ATS escreverem vagas em nome de clientes, (b) exige contrato de parceria assinado e aprovação de acesso, e (c) está fechada para novos parceiros em 2026-09. **Não é uma rota viável para um app independente.**

### 2.3. Existe um "Jobs Search API" público?

Não. Não há um "Jobs Search API" listado em nenhum dos três hubs de documentação (Marketing, Talent, Consumer). O ecossistema público/self-serve trata o LinkedIn Jobs como **dados que pertencem ao consumidor da plataforma**, não exportáveis.

Para confirmar: https://learn.microsoft.com/en-us/linkedin/shared/api-guide/rest/data-finder (endpoint de busca de documentação) retorna 404 para `q=job` quando consultado. A ausência de documentação equivale a ausência de produto.

### 2.4. Sign In with LinkedIn — escopo mínimo

Scopes do OIDC: apenas `openid`, `profile`, `email` (https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2). O `userinfo` retorna no máximo `sub`, `name`, `given_name`, `family_name`, `picture`, `locale`, `email`, `email_verified`. **Nenhum dado de feed, posts, conexões, vagas ou atividade de busca.**

> A API ToS §3.1.23 também proíbe: "Access a Member's network of connections through your Application without their express permission or enable a Member to share their networks or data about their networks to anyone else through your Application". (https://www.linkedin.com/legal/l/api-terms-of-use)

### 2.5. Limites numéricos do self-serve

- Limite padrão self-serve: **100.000 chamadas/dia** (ou menor, a critério da LinkedIn) e app com **≤ 100.000 usuários vitalícios**. Acima disso, é preciso migrar para Vetted/Partner Program. Fonte: https://www.linkedin.com/legal/l/api-terms-of-use §1.4
- Tokens expiram em **60 dias**; refresh programático disponível só para parceiros selecionados. Fonte: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow

Mesmo se houvesse endpoint, esse teto seria apertado para um tracker de vagas em escala.

### 2.6. Custos

> "LinkedIn currently does not charge a fee for use of the APIs, but may choose to in the future." — https://www.linkedin.com/legal/l/api-terms-of-use §8.2

A camada self-serve é "free" no preço de listagem — mas o acesso a produtos que tocam vagas (Job Posting) **não é self-serve**, é Partner Program com contrato assinado e NDA.

---

## 3. Capacidades de busca — user posts estão cobertos?

**Não**, nem na busca oficial (web) nem nas APIs.

- A busca na web do LinkedIn (`/search`) retorna **membros, vagas, posts, grupos, empresas, escolas, eventos** misturados — mas indexada por relevância do viewer, gated por login e proibida de ser consumida via scraping (ver §4).
- Não existe endpoint de "search posts" ou "search feed". A Community Management API expõe posts de **Company Pages** que o app administra (write/read dos próprios posts) — não posts arbitrários de usuários. Fonte: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
- O marketing hub lista `posts` somente no contexto de páginas da empresa: https://learn.microsoft.com/en-us/linkedin/marketing/quick-start ("Get started with the Community Management").

Implicação: para o caso (b) "vagas como user posts", **não há canal oficial nem gratuito nem pago exposto a terceiros**. O conteúdo existe no feed, mas não há API para listá-lo por query/keyword.

---

## 4. Termos de Serviço — o que está vedado

### 4.1. User Agreement §8.2 "Don'ts" (vigente desde 2025-11-03)

Fonte: https://www.linkedin.com/legal/user-agreement

> "Develop, support or use software, devices, scripts, robots or any other means or processes (such as crawlers, browser plugins and add-ons or any other technology) to scrape or copy the Services, including profiles and other data from the Services;"

> "Use bots or other unauthorized automated methods to access the Services, add or download contacts, send or redirect messages, create, comment on, like, share, or re-share posts, or otherwise drive inauthentic engagement;"

> "Override any security feature or bypass or circumvent any access controls or use limits of the Services (such as search results, profiles, or videos);"

> "Copy, use, display or distribute any information (including content) obtained from the Services, whether directly or through third parties (such as search tools or data aggregators or brokers), without the consent of the content owner (such as LinkedIn for content it owns);"

Os itens acima vedam explicitamente: scraping, bypass de rate limits, redistribuição de dados do LinkedIn (mesmo coletados via terceiros sem consentimento). Para um tracker de vagas, "redistribuir" dados de vagas em um banco próprio é o caso de uso central — então cai na proibição.

### 4.2. Crawling Terms (rev. 2017-05-25)

Fonte: https://www.linkedin.com/legal/crawling-terms

- "Automated Crawling & Indexing without the express permission of LinkedIn is strictly prohibited."
- Permissão concedida **apenas** "for the limited purpose of including content in approved publicly available search engines" — ou seja, para Bing/Google/DuckDuckGo/whitelist; não para um app de tracker.
- "you will not transfer data collected through Automated Crawling & Indexing to others in aggregated or bulk form" — quebra qualquer modelo de ingestão periódica.
- "your use of data you collect through Automated Crawling & Indexing will be confined solely to search indexing for display in a publicly available search engine on the Internet" — uso de produto, não de feature.
- "your use of data … in connection with a competitive service (as determined by LinkedIn)" — proibido.
- "you will not circumvent any measures implemented by LinkedIn to prevent violations".
- Violação: "immediate ban from all LinkedIn websites" + injunctive relief + money damages (§16).

### 4.3. API Terms of Use §3.1 — restrições do uso das APIs

Fonte: https://www.linkedin.com/legal/l/api-terms-of-use

Pontos críticos para um tracker:

- §3.1.3 "Request or publish information impersonating a Member...".
- §3.1.7 "Request or obtain more Content than is minimally required by the Application to provide a high quality experience to Users".
- §3.1.8 "Sell, rent, lease, disclose, distribute, share ... any Content ... to any third party (e.g. you may not sell access to an aggregated collection of Member profiles, the most relevant Members for a position, or any social activity, such as posts, likes, or shares by Members)" — **proibição explícita de agregar/revender posts, atividade social, perfis**.
- §3.1.10 "Use any Content in any advertisements or for purposes of targeting advertisements".
- §3.1.16 "Copy, adapt, reformat, reverse-engineer, disassemble, decompile, decipher, translate or otherwise modify any API".
- §3.1.17 "Use Content as an input to reports, scores, or decisions that could be used for the purposes of determining eligibility for credit, insurance, employment, housing or other similar purposes, unless otherwise expressly permitted by LinkedIn, in writing, under separate terms" — **risco direto**: um score de match para "elegibilidade de emprego" sem permissão escrita pode configurar violação. (Ironicamente, o produto do tracker é exatamente esse.)
- §3.1.24 "Access, store, display, or facilitate the transfer of any LinkedIn content obtained through the following methods: scraping, crawling, spidering or using any other technology or software to access LinkedIn content outside the APIs" — define como "**Non-Official Content**" e proíbe misturar com API content.
- §3.1.26 "Use the Content or the APIs to automate posting on the LinkedIn Services".
- §4.1 "You must not capture, copy, cache, or store any Content..." (com exceções limitadas).
- §4.3 "Profile Data" exclui explicitamente "data such as a Member's network, network updates, job listings, groups, ad companies, and any other similar content" — i.e., mesmo quando storage é permitido, **lista de vagas e posts estão fora do que se pode armazenar**.

### 4.4. robots.txt — barreiras técnicas explícitas

Fonte: https://www.linkedin.com/robots.txt (acessado 2026-09-02)

- Cabeçalho: "The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited."
- `Disallow` para **todos** os UAs relevantes (Googlebot, Bingbot, Applebot, Slurp, Yandex, Baiduspider, etc.) inclui:
  - `Disallow: /jobs?runSearch*`
  - `Disallow: /jobs-guest/`
  - `Disallow: /api/jobPostings/jobs*`
  - `Disallow: /jsearch*`
  - `Disallow: /search*`
  - `Disallow: /feed/update/`
  - `Disallow: /voyager/api`
  - `Disallow: /oauth/v2/*`, `Disallow: /oauth2/v2/*`
- Whitelist aberta para: Googlebot, Bingbot, Applebot, Slurp, Yandex, Baidu, msnbot, LinkedInBot, Yeti, Teoma, seznambot — **mas apenas para indexação de search engine público**, sob Crawling Terms. Não há whitelist que autorize um app de tracker.

> A `jsearch*` em particular é a API interna do front-end; está explicitamente fechada, sinalizando o "Job Search" como produto não-disponível-para-terceiros.

---

## 5. Barreiras legais e técnicas concretas

1. **Não existe Job Search API público.** Único endpoint "oficial" de job é write-only e gated por parceria fechada (Job Posting API).
2. **Não existe Feed/Search API público para user posts.** O conteúdo de feed existe, mas não há como consultá-lo programaticamente.
3. **robots.txt bloqueia /search, /jobs?runSearch, /jsearch, /voyager/api, /feed/update/** para todos os UAs generalistas. Burlar configura §8.2 do User Agreement e §3.1.16/24 da API ToS.
4. **Crawling Terms** exigem que dados coletados sirvam **apenas a um search engine público aprovado** e proíbem (a) agregação para terceiros, (b) uso em "competitive service" e (c) transferência em bulk.
5. **API ToS §3.1.17** explicitamente restringe uso de Content para "determining eligibility for … employment" sem permissão escrita — risco direto para um *match score* de emprego.
6. **API ToS §3.1.8** proíbe agregar e redistribuir "social activity, such as posts, likes, or shares" — collide com o caso (b) "vagas como user posts".
7. **Storage** (§4): não se pode armazenar Content (incluindo posts/likes/job listings), exceto tokens. Mesmo para Profile Data permitido, há exclusão de "job listings" e "network updates".
8. **Self-serve limits** (100k lifetime users / 100k calls/day) são teto de produto, não de uso interno — usar o token de um único membro para puxar feed pessoal via qualquer call ainda cai em §3.1.7 ("more Content than minimally required") e §3.1.8.
9. **Enforcement histórico:** a LinkedIn processa agressivamente scrapers (casos públicos: *hiQ Labs v. LinkedIn*, 2022) e mantém bans por fingerprint + authwall.

---

## 6. Conclusão e recomendação

### 6.1. Veredito

| Categoria | Viável grátis | Viável ToS-clean | API oficial existe |
|---|---|---|---|
| **(a) LinkedIn Jobs** (páginas oficiais) | Não (sem API) | Não (sem API) | **Não** (read API pública não existe; Job Posting API é write-only e partner-gated, fechado para novos parceiros) |
| **(b) Vagas como user posts** | Não (sem API) | Não (sem API) | **Não** (nenhuma API de feed/search exposta a terceiros) |
| **Cobertura conjunta (a) + (b)** | Não | Não | — |

A tentativa de obter **qualquer uma** das duas categorias via scraping de páginas HTML, via `voyager/api` reverso, ou via sessão autenticada de membro além do escopo do Sign In, **viola simultaneamente** o robots.txt, o User Agreement §8.2, a API ToS §3.1.16/24 e os Crawling Terms.

### 6.2. Caminhos ToS-clean alternativos (para o projeto)

Se o objetivo é cobrir vagas LinkedIn **dentro da lei e do ToS**, as opções reais são:

1. **Google Jobs / Bing index (ToS-clean para o tracker):** Google expõe `site:linkedin.com/jobs/view/...` em seu índice; serviços como SerpAPI, Google Custom Search (com `site:`) ou Bing Webmaster são caminhos indiretos. É a rota usada por Adzuna, RemoteOK, etc. *Atenção: cada provedor tem seus próprios ToS; a fonte primária dos dados continua sendo a página pública do LinkedIn, mas o coletor não fala diretamente com o LinkedIn.*
2. **Parceiros agregadores com contrato (pagos):** Adzuna, Theirstack, jooble, etc. Eles negociaram acesso e redistribuem. Não é "free" mas é o caminho ToS-clean em escala.
3. **Tornar-se parceiro LinkedIn Talent Solutions** (pago, NDA): acesso a Job Posting API e CRM Connect. Viável só se o produto virar ATS ou plataforma de RH. Para um tracker pessoal: fora de escopo.
4. **Ingest manual por URL de vaga específica** (share de vaga individual pelo usuário): baixo volume, ToS-clean (é o "Share" oficial), mas não automatiza "busca".

### 6.3. Recomendação para o Job Radar

Para o projeto `job-radar`:

- **Não** implementar uma `LinkedInSource` baseada em scraping ou em sessão autenticada. É tecnicamente possível (proxies + Playwright), mas viola robots.txt, User Agreement §8.2, API ToS §3.1.24 e Crawling Terms, e expõe o projeto a cease & desist / ban / risco de "competitive service".
- **Considerar** uma `LinkedInSource` que consome índice público via Google Custom Search ou Bing (com `site:linkedin.com/jobs`), registrada como JobSource que armazena apenas o `linkedin.com/jobs/view/<id>` URL público, sem armazenar conteúdo que viole §4 da API ToS.
- **Deixar explícito** no adapter que (b) "vagas como user posts" **não é coberto** — é um limite do ecossistema, não uma feature faltando.
- Se virar produto comercial, avaliar parceria paga com agregador ToS-compliant.

---

## 7. Fontes primárias consultadas

1. https://www.linkedin.com/robots.txt — robots.txt, acessado 2026-09-02.
2. https://www.linkedin.com/legal/user-agreement — User Agreement, "Effective on November 3, 2025".
3. https://www.linkedin.com/legal/l/api-terms-of-use — LinkedIn API Terms of Use, "Last revised on December 13th, 2022".
4. https://www.linkedin.com/legal/crawling-terms — Crawling Terms and Conditions, "Last revised on May 25, 2017".
5. https://learn.microsoft.com/en-us/linkedin/marketing/quick-start — Marketing Quick Start (li-lms-2026-08).
6. https://learn.microsoft.com/en-us/linkedin/talent/ — LinkedIn Talent Solutions overview (li-lts-2026-04).
7. https://learn.microsoft.com/en-us/linkedin/talent/job-postings/api/overview — Job Posting API Overview (li-lts-2026-04).
8. https://learn.microsoft.com/en-us/linkedin/consumer/ — Consumer Solutions Platform hub.
9. https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2 — Sign In with LinkedIn via OIDC.
10. https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow — 3-legged OAuth (atualizado 2026-05-15).

> **Observação sobre ausência de fonte:** a Talent Solutions historicamente ofereceu uma *Job Search API*; o produto foi descontinuado e o link de documentação removido da Microsoft Learn antes de 2024. A página oficial atual (https://learn.microsoft.com/en-us/linkedin/talent/) lista Apply Connect, Apply with LinkedIn, Job Posting, CRM Connect, Recruiter System Connect — nenhuma "Job Search API". Isso é evidência indireta de que não há produto público equivalente.

---

## 8. O caso Apify — como o mercado preenche o vácuo da LinkedIn

> **Data da pesquisa:** 2026-09-02
> **Escopo:** mapear as Actors de LinkedIn (Jobs e Posts) comercializadas no Apify Store, entender como funcionam tecnicamente, ler os termos da plataforma para entender onde a responsabilidade legal cai, e revisar precedentes públicos de enforcement pela LinkedIn contra scrapers — para então reavaliar a viabilidade de um tracker ToS-clean.
> **Método:** somente fontes primárias — `apify.com/store` (lista de Actors), páginas `.md` de cada Actor (especificação técnica), documentos legais em `docs.apify.com/legal/*`, blog oficial `blog.apify.com`, decisão judicial em `law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2022-04-18.html`, e cessar-e-desistir público em `static.reuters.com/.../hiqvlinkedin--ceaseanddesist.pdf`.

### 8.1. Resumo executivo

- **Existe um ecossistema comercial de Actors para LinkedIn no Apify Store**, com centenas de milhares de usuários combinados, vendido explicitamente como "alternativa sem-API". O Actor mais popular de Jobs ([`curious_coder/linkedin-jobs-scraper`](https://apify.com/curious_coder/linkedin-jobs-scraper.md)) declara 145.863 usuários e opera a USD 1,00/1.000 resultados; o de Post Search mais bem avaliado ([`harvestapi/linkedin-post-search`](https://apify.com/harvestapi/linkedin-post-search.md)) tem 25.758 usuários a USD 1,50/1.000 posts. Fonte: `apify.com/store` (acessado 2026-09-02).
- **Tecnicamente, eles não usam a API oficial do LinkedIn** — o Apify não é parceiro de Talent Solutions, e a Job Posting API é write-only e fechada a novos parceiros (§2.2 do doc principal). Eles fazem engenharia reversa das APIs internas do front-end (`/voyager/api/...`) usando contas de pool residencial, sem cookies do usuário final, e entregam dados "públicos" — mas "público" aqui significa "acessível sem login", não "permitido pelo ToS".
- **A Apify se protege juridicamente repassando a responsabilidade para o Usuário e para o Creator (desenvolvedor do Actor)**: General Terms §11.1, Actor Terms §7.1 e Standard Actor Contract §7-§8 colocam indenização, isenção de garantia e limitação de responsabilidade (USD 100 entre Usuário e Creator) sobre quem consome o Actor. Apify não é parte do contrato entre Usuário e Creator.
- **A Apify reconhece o risco contratual publicamente** no seu blog (post "Web scraping case law: HiQ v. LinkedIn", 2024-08-13): a COO e ex-advogada Ondra Urban resume a decisão da 9ª Circunscrição (CFAA) e conclui com o aviso de que "scraping de dados públicos pode ser contratualmente restrito" — é, literalmente, o "landmine contratual" apontado na §4 do doc principal.
- **Enforcement recente confirma risco civil real**: o caso `hiQ v. LinkedIn` (2017-2022) terminou em acordo extrajudicial depois da 9ª Circunscrição decidir duas vezes a favor do scraper no CFAA, mas o juizado de instância inferior manteve a violação contratual. Em **janeiro de 2025 a LinkedIn processou a Nubela (Proxycurl)** — outro provedor de "LinkedIn data API" não-Apify — e o serviço foi encerrado, com deleção total dos dados e bloqueio permanente. Fonte secundária: `linkedinsider.blog/linkedin-scraping-tools-safety` (2026-05-29), que cita a $500k settlement e a trajetória de enforcement. (Não foi localizada fonte primária da settlement; vide §8.6.)
- **Veredito para o projeto:** incorporar um Actor de Apify como fonte de dados LinkedIn **não resolve o problema ToS**. O risco contratual continua com quem consome o output — e a Apify transfere explicitamente esse risco via contrato. A "facilidade técnica" não altera a análise jurídica feita em §4-§6 deste documento.

### 8.2. Actors existentes para LinkedIn Jobs e Posts

Lista representativa (top por popularidade no Store, acessado 2026-09-02 — `apify.com/store`):

| Categoria | Actor | Usuários | Preço | Modelo |
|---|---|---|---|---|
| **LinkedIn Jobs** | `curious_coder/linkedin-jobs-scraper` | 145.863 | USD 1,00/1k jobs | pay per event |
| LinkedIn Jobs | `cheap_scraper/linkedin-job-scraper` (Pay Per Result) | 48.000 | (variável) | pay per result |
| LinkedIn Jobs | `valig/linkedin-jobs-scraper` | 22.000 | USD 0,40/1k jobs | pay per event |
| LinkedIn Jobs | `worldunboxer/rapid-linkedin-scraper` | 15.000 | USD 0,45/1k jobs | pay per event |
| LinkedIn Jobs | `apimaestro/linkedin-jobs-scraper-api` (No Cookies) | 4.700 | (variável) | pay per event |
| LinkedIn Jobs (busca avançada) | `curious_coder/linkedin-jobs-search-scraper` | 4.200 | (variável) | pay per event |
| **LinkedIn Posts — Search** | `harvestapi/linkedin-post-search` (No Cookies) | 25.758 | USD 1,50/1k posts | pay per event |
| LinkedIn Posts — Search | `apimaestro/linkedin-posts-search-scraper-no-cookies` | 12.000 | (variável) | pay per event |
| LinkedIn Posts — Profile | `apimaestro/linkedin-profile-posts` (No Cookies) | 22.000 | (variável) | pay per event |
| LinkedIn Posts — Profile | `harvestapi/linkedin-profile-posts` (No Cookies) | 33.000 | (variável) | pay per event |
| LinkedIn Posts — Profile | `supreme_coder/linkedin-post` (No cookies) | 16.000 | (variável) | pay per event |
| LinkedIn Company Posts | `harvestapi/linkedin-company-posts` (No Cookies) | 11.000 | (variável) | pay per event |

Observações diretas dos READMEs:
- Quase todos os Actors de Posts/Profiles do top do ranking são **"No Cookies"** ou **"No Login"** — a infraestrutura (proxies residenciais e engenharia reversa) é operada pelo Creator, **não pelo usuário final**, o que reduz a chance de ban da conta do usuário. Mas o risco contratual não desaparece.
- O `curious_coder/linkedin-jobs-scraper` (README lido em 2026-09-02) declara explicitamente: "Linkedin limits number of jobs per search to 1000" e oferece "Split search urls by location" como contorno. Os filtros "clássicos" (Experience level, Job type, Workplace) foram descontinuados pelo LinkedIn em agosto de 2026 (LinkedIn AI search) e o Actor oferece um modo "Auto convert to AI search" que injeta os filtros antigos como texto em linguagem natural no `keywords` — sinal de que **a engenharia reversa é continuamente quebrada** e os Actors têm que se adaptar.
- O `harvestapi/linkedin-post-search` retorna até ~400-500 posts por query, suporta busca booleana (AND/OR/NOT — alinhado à `https://www.linkedin.com/help/linkedin/answer/a524335`), e pode opcionalmente raspar reactions e comments como items extras (cada um cobrado como post). O README termina com o disclaimer padrão: "This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation."

### 8.3. Como funcionam tecnicamente

A documentação pública do Apify (Academy, READMEs dos Actors, fontes citadas abaixo) revela o stack típico, embora cada Creator mantenha os detalhes fechados (proprietários):

1. **Engenharia reversa do front-end do LinkedIn**, especificamente as APIs internas que o próprio navegador chama: a família `/voyager/api/.../*` (GraphQL-like), e a Search API em `/search/results/...`. O robots.txt do LinkedIn (§4.4 do doc principal) explicitamente bloqueia `Disallow: /voyager/api` e `Disallow: /jsearch*` para todos os UAs — confirmação independente de que essas rotas são as que os Actors usam, **em violação ao robots.txt** (mesmo onde robots.txt não é juridicamente vinculante, ele é um sinal expresso de não-consentimento).
2. **Headless browsers e proxies residenciais**. A Apify mantém um serviço de proxy rotation (`apify.com/proxy`) que é a peça de infraestrutura recomendada para "evitar bloqueios" (Academy: "Bypassing anti-scraping methods"). Actors que rodam em Playwright/Chromium headless falsificam o TLS fingerprint, rotacionam user agents, e mantêm session pools (vide Academy `anti-scraping/mitigation/fingerprinting`, `generating-fingerprints`, `proxies`).
3. **Pool de contas LinkedIn "sacrificáveis"** (não documentado publicamente pelos Creators, mas evidenciado pela frase recorrente "No cookies required" e pela escala — 146k usuários no principal Actor de Jobs não seriam sustentáveis por scraping sem login de longa duração). Para Jobs (página `/jobs/search/...`), é possível raspar a página de resultados públicos sem login; o detalhe individual de cada vaga, em alguns casos, requer mais chamadas. Para Posts (`/feed/update/`, `/search/results/content/`), a escala sem login é severamente limitada — daí o teto de 400-500 posts/query reportado pelo `harvestapi/linkedin-post-search`.
4. **Fingerprint spoofing, retry exponencial, "session management"** — funcionalidades oferecidas pelo Apify SDK (`docs.apify.com/sdk/js/docs/concepts/session-management.md`, `proxy-management.md`) explicitamente desenhadas para "evitar detecção" (`academy/anti-scraping/mitigation/`). Isso é engenharia de evasão, não "crawling educado".
5. **Quebra frequente por mudanças do LinkedIn**. O próprio README do `curious_coder/linkedin-jobs-scraper` documenta que os filtros clássicos foram descontinuados em "Aug 2026" — o que sugere que os Creators precisam atualizar seus parsers toda vez que o LinkedIn altera a API interna. A confiabilidade dos dados é, portanto, **estruturalmente volátil** (vide §8.6).

**Não há uso declarado de nenhuma API oficial do LinkedIn** em nenhum dos READMEs. Apify não é parceira de Talent Solutions (essa via está fechada a novos parceiros, vide §2.2 do doc principal), e a Apify não poderia oferecer autenticação via OAuth Sign-In com escopo `openid profile email` para raspar Jobs/Posts — esse token não dá acesso a `/voyager/api/jobs` ou `/feed/update`.

### 8.4. O que os termos da Apify dizem — quem responde pelo quê?

Documentos lidos (acessados 2026-09-02): `docs.apify.com/legal/general-terms-and-conditions.md` (effective 2026-07-09), `docs.apify.com/legal/actor-terms-and-conditions.md` (effective 2026-07-09), `docs.apify.com/legal/standard-actor-contract.md` (v1.0), `docs.apify.com/legal/acceptable-use-policy.md` (last updated 2026-02-20), `docs.apify.com/legal/store-publishing-terms-and-conditions.md`.

**A Apify não assume responsabilidade pelo uso do Actor pelo Usuário. Pelo contrário, ela a repassa explicitamente:**

1. **General Terms §3.1** ("Actors"): "Unless expressly stated otherwise, **Actors are not part of the Services** provided by Apify hereunder." — o que significa que o ecossistema de Actors (incluindo os de LinkedIn) está contratualmente fora do escopo de "Service" que a Apify garante.
2. **General Terms §11.1** (Indemnification): o Usuário concorda em "indemnify, defend and hold us, [Apify] harmless from and against any third-party claim … arising out of … (i) your use of the Website or Services in breach of the Agreement; and (ii) your publication or use of any Actors, including any disputes with third-party Actor Developers." E o trecho-chave: "**Should you use the Services or Actors to extract Customer Data from unauthorized sources, you shall be responsible for compensating any damages incurred by and/or any claims of the affected third parties.**" — ou seja, se a LinkedIn processar o Usuário, a Apify exige que o Usuário a mantenha indene.
3. **Actor Terms §7.1**: indenização do Creator do Actor pelo Usuário; o Creator não é "Subprocessor" da Apify e opera independentemente.
4. **Standard Actor Contract §2.1**: "You are solely responsible for any data, input, or parameters provided by you when using an Actor … and for how you use any … Actor Outputs. … **It is your responsibility to ensure that your use of Actor Output complies with applicable laws and the third-party intellectual property rights.**" — esta é a cláusula que mais importa: o Usuário é o único responsável pela legalidade do uso do output.
5. **Standard Actor Contract §8.1** (limitação de responsabilidade do Creator): "CREATOR'S AGGREGATE LIABILITY TO YOU FOR ANY CLAIM … SHALL NOT EXCEED **USD 100**" — mesmo se o Creator for encontrado, a recuperação máxima é USD 100. O resto é absorvido pelo Usuário.
6. **Acceptable Use Policy §2.1.10**: "engaging in activities that contravene applicable laws, regulations, or the rights of any third party" é Prohibited Activity. A Apify **reserva-se o direito** (§3.1) de bloquear ou remover o Usuário/ator não-compliance "without notice" — mas isso é discricionário, não obrigatório. Em outras palavras, a AUP dá à Apify uma alavanca para *despublicar* um Actor que esteja chamando atenção, mas não obriga a Apify a revisar preventivamente.
7. **Standard Actor Contract §9.4 + §10.6**: "Apify is not a party to this Contract and bears no liability arising from it." — a Apify, como plataforma, é estruturalmente uma *pass-through*.

**Conclusão jurídica:** a Apify não é um escudo. Ela é uma infraestrutura que **desloca explicitamente o risco para o Usuário** via General Terms, Actor Terms e Standard Actor Contract. O marketing do Apify como "marketplace de tools" e a sofisticação técnica dos Actors não mudam quem responde se a LinkedIn vier com cease & desist + lawsuit.

### 8.5. Precedentes de enforcement — o que já aconteceu com scrapers de LinkedIn

#### 8.5.1. hiQ Labs v. LinkedIn (2017-2022)

Caso público mais importante. Cessar-e-desistir original de 23 de maio de 2017 (`static.reuters.com/resources/media/editorial/20170620/hiqvlinkedin--ceaseanddesist.pdf`):

- Alega violação de User Agreement (itens hoje reproduzidos em §4.1 do doc principal), mais violação de **CFAA, DMCA, California Penal Code §502(c)** e common law trespass.
- Alega "technical measures … to prevent hiQ from accessing, and assisting others to access, LinkedIn's site, through systems that detect, monitor, and block scraping activity" — ou seja, LinkedIn já tem **Quicksand** (detecção), **Sentinel** (throttling/bloqueio) e **Org Block** (lista de IPs de scrapers em escala). Fonte: 9th Cir. 2022 opinion, p. n.4-6 (`law.justia.com/.../17-16783-2019-09-09.html` e `...-2022-04-18.html`).
- A corte de 9ª Circunscrição decidiu, em 2019 e novamente em 2022 pós-Van Buren, que **raspar dados públicos não viola o CFAA** (analogia de "breaking and entering" não se aplica a portões abertos). É precedente importante nos EUA.
- Mas a instância inferior, em summary judgment de 27 de outubro de 2022, **manteve a violação contratual**: hiQ aceitou o User Agreement e violou as cláusulas anti-scraping, "and the creation of fake accounts" (que hiQ também fazia).
- Acordo final confidencial; a Apify blog (`blog.apify.com/hiq-v-linkedin/`, 2024-08-13) especula que "a $500k judgment" e "permanent injunctions" teriam sido parte do settlement, e hiQ encerrou atividades por causa da incerteza do litígio, não por derrota técnica.

Lição para o nosso projeto: **nos EUA, o scraping público não é crime (CFAA não aplica), mas é violação contratual civilmente acionável**, mesmo sem login — porque aceitar o User Agreement em algum momento (mesmo só uma vez, para criar a conta que vai logar nos proxies) já é suficiente para o contrato existir. (Observação: a Apify blog classifica o resultado como "contractual landmine".)

#### 8.5.2. Proxycurl / Nubela (janeiro de 2025)

Reportado em `linkedinsider.blog/linkedin-scraping-tools-safety` (2026-05-29, secundária):

- Em janeiro de 2025, a LinkedIn processou a **Nubela Pte. Ltd.** (operadora do Proxycurl, um dos mais usados "LinkedIn data APIs" comerciais, ~USD 10M de receita) por "scraping of millions of profiles using hundreds of thousands of fake accounts" no Northern District of California.
- Settlement: Proxycurl **encerrou operações inteiramente**, com deleção de todos os dados LinkedIn coletados e bloqueio permanente de acesso à plataforma. O founder do serviço postou publicamente que "não havia como vencer" contra a Microsoft/LinkedIn.

**Esta fonte é secundária.** Não foi localizada uma fonte primária (decisão judicial, release oficial) no momento da pesquisa. O caso é relevante para o projeto porque **Proxycurl operava exatamente o mesmo modelo que os Actors "No Cookies" do Apify operam** — era uma "LinkedIn data API" comercial usando scraping interno. Se a LinkedIn foi a juíza nesse caso, o precedente se estende a qualquer operador com modelo equivalente, inclusive Creators do Apify e seus Usuários finais.

#### 8.5.3. Bloqueios técnicos

- A LinkedIn, segundo a opinião da 9ª Circunscrição (2022), **bloqueia ~95 milhões de tentativas automatizadas por dia** e já restringiu **mais de 11 milhões de contas** sob suspeita de violação. Fonte: `hiQ Labs, Inc. v. Linkedin Corp., 31 F.4th 1180, n.4-6 (9th Cir. 2022)`.
- Para quem consome dados via Actor, banimento de conta do **usuário final** pode ocorrer mesmo no modelo "No Cookies" se o pool de proxies do Creator for detectado e a LinkedIn correlacionar fingerprints (TLS, canvas, behavioral). Risco residual, não zero.

### 8.6. Riscos conhecidos e qualidade dos dados

| Risco | Probabilidade | Severidade | Mitigação possível |
|---|---|---|---|
| **Banimento de contas LinkedIn** (do pool do Creator) | Alta | Baixa-média para o Usuário (no modelo No-Cookies) | nenhuma — o Creator absorve |
| **Cease & desist da LinkedIn ao Usuário** | Média | Alta | baixa probabilidade se não houver armazenamento em bulk; mas a Apify não te blinda |
| **Lawsuit da LinkedIn ao Usuário** (modelo Proxycurl) | Baixa (usuário individual) / Média (produto comercial) | Muito alta (custos, injunção) | evitar armazenamento e redistribuição |
| **Cessar-e-desist ao Creator do Actor** | Alta (se o Actor escalar) | Média (Apify pode despublicar) | nenhuma para o Usuário |
| **Actor quebrando por mudança do LinkedIn** | Alta | Média (downtime + dados incompletos) | multi-source (Google Jobs + Adzuna) |
| **Dados incompletos / desatualizados / inventados** | Média-alta | Média (depende do uso) | verificar contra página LinkedIn real |
| **Violação de LGPD / GDPR** | Média (se dados de candidatos UE forem coletados e armazenados) | Alta (multas, base legal fraca) | exige base legal (consentimento?) e DPIA — não é "free" |
| **Violação de "competitive service"** (Crawling Terms §1) | Média | Alta | se o tracker virar "aplicativo de busca de emprego", arrisca §3.1.17 da API ToS (mesmo sem API) |

**Qualidade dos dados.** O `curious_coder/linkedin-jobs-scraper` documenta: "Linkedin limits number of jobs per search to 1000" e que filtros "clássicos" (Experience level, Job type) foram removidos em agosto 2026. Isso significa que a **completude da cobertura de vagas é menor do que o LinkedIn Jobs exibe ao usuário humano**; o Actor adiciona o workaround de "split by location" mas isso é multiplicação de queries, não aumento de cobertura por vaga. Para Posts, o limite de 400-500 por query do `harvestapi/linkedin-post-search` é teto estrutural.

**Storage de LinkedIn Content.** O §4.3 do LinkedIn API ToS (vide §4.3 do doc principal) exclui explicitamente "data such as a Member's network, network updates, job listings, groups, ad companies, and any other similar content" do "Profile Data" que pode ser armazenado. Mesmo se não houvesse violação contratual via scraping, **armazenar vagas e posts coletados via Actor para criar um índice é violação da API ToS**. Como o Apify não é integrado à API oficial, esse trecho do ToS não é tecnicamente vinculante ao Usuário do Actor — mas é sinal claro da posição da LinkedIn.

### 8.7. Isso muda a viabilidade de um tracker ToS-clean?

**Não. A conclusão de §6 do documento principal permanece válida, e é reforçada:**

1. **"Fácil de fazer" ≠ "permitido".** O Apify reduz a barreira técnica de zero a algumas horas de integração, mas o ato de raspar `/voyager/api/jobs` e `/feed/update/` continua sendo (a) violação do robots.txt do LinkedIn (`Disallow: /voyager/api`, `Disallow: /jsearch*`, `Disallow: /feed/update/`), (b) violação do User Agreement §8.2 ("scraping … regardless of whether the data is publicly available"), e (c) armazenamento que colide com API ToS §3.1.8 e §4.3. O Apify muda o *engineering cost*, não o *legal status*.
2. **A Apify não blinda juridicamente.** General Terms §11.1, Actor Terms §7.1 e Standard Actor Contract §2.1/§8.1 transferem o risco para o Usuário. Se a LinkedIn vier com cease & desist + lawsuit, o Usuário responde — e a Apify nada deve a ele (Standard Actor Contract §10.6: "Apify is not a party to this Contract and bears no liability arising from it.").
3. **A Apify reconhece o risco publicamente.** O blog post oficial "Web scraping case law: HiQ v. LinkedIn" (2024-08-13) é a melhor evidência de que a Apify **sabe** que o cenário é cinza. Cita o resultado "gates are essentially up, legally speaking" (criminal) e alerta: "make sure you're not stepping on any contractual landmines" (civil). É um convite a fazer sua própria diligência — não uma garantia de segurança.
4. **O precedente Proxycurl (2025) é o cenário adverso real.** Se o Usuário for um indivíduo com baixo volume, o risco de lawsuit é baixo (mas não-zero). Se o Usuário escalar e oferecer um "tracker de vagas" como produto, o perfil se parece com o da Nubela: cease & desist → lawsuit → injunction → shutdown. O caminho Proxycurl é a fronteira de fato entre "uso pessoal tolerado" e "uso comercial acionável".
5. **A solução ToS-clean continua sendo a de §6.2 do doc principal**: Google Jobs/Bing index (`site:linkedin.com/jobs/view/...`), parceiros agregadores com contrato (Adzuna, Theirstack, Jooble), parceria direta com LinkedIn Talent Solutions (apenas para produtos de RH), ou ingestão manual por URL. Apify não entra na lista.

**Implicação prática para o `job-radar`:** a existência de Actors de Apify **não** é razão para reverter a recomendação de §6.3. Pode-se, no máximo, considerar Apify para outras fontes (Indeed, Glassdoor, Adzuna-aggregator) onde o ToS é menos restritivo, mas não para LinkedIn Jobs ou LinkedIn Posts. Se for tentador "só rodar o Actor e ver", o Standard Actor Contract §2.1 é o lembrete explícito: "**It is your responsibility to ensure that your use of Actor Output complies with applicable laws and the third-party intellectual property rights**."

### 8.8. Fontes primárias consultadas (seção 8)

1. https://apify.com/store — Apify Store (top Actors), acessado 2026-09-02.
2. https://apify.com/curious_coder/linkedin-jobs-scraper.md — `curious_coder/linkedin-jobs-scraper` README, 145.863 usuários, USD 1,00/1k, acessado 2026-09-02.
3. https://apify.com/harvestapi/linkedin-post-search.md — `harvestapi/linkedin-post-search` README, 25.758 usuários, USD 1,50/1k, acessado 2026-09-02.
4. https://apify.com/cheap_scraper/linkedin-job-scraper — Actor alternativo de Jobs, 48k usuários.
5. https://apify.com/valig/linkedin-jobs-scraper — Actor alternativo, USD 0,40/1k.
6. https://apify.com/apimaestro/linkedin-posts-search-scraper-no-cookies — Post search "No Cookies", 12k usuários.
7. https://apify.com/harvestapi/linkedin-profile-posts — Profile posts "No Cookies", 33k usuários.
8. https://apify.com/supreme_coder/linkedin-post — Post scraper "No cookies", 16k usuários.
9. https://docs.apify.com/legal/general-terms-and-conditions.md — Apify General T&C, effective 2026-07-09, acessado 2026-09-02.
10. https://docs.apify.com/legal/actor-terms-and-conditions.md — Actor T&C, effective 2026-07-09.
11. https://docs.apify.com/legal/standard-actor-contract.md — Standard Actor Contract v1.0.
12. https://docs.apify.com/legal/acceptable-use-policy.md — Acceptable Use Policy, last updated 2026-02-20.
13. https://blog.apify.com/hiq-v-linkedin/ — "Web scraping case law: HiQ v. LinkedIn", 2024-08-13, por Lucie Růžičková (Apify).
14. https://blog.apify.com/is-web-scraping-legal/ — "Is web scraping legal?", por Ondra Urban (Apify COO), 2026-02-10 (visão geral da Apify sobre legalidade).
15. https://docs.apify.com/academy/anti-scraping/ — Academy: técnicas de anti-scraping (proxy, fingerprinting, browser challenges).
16. https://docs.apify.com/sdk/js/docs/concepts/session-management.md — Apify SDK session management.
17. https://docs.apify.com/sdk/js/docs/concepts/proxy-management.md — Apify SDK proxy management.
18. https://law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2022-04-18.html — *hiQ Labs, Inc. v. LinkedIn Corp.*, 31 F.4th 1180 (9th Cir. 2022).
19. https://law.justia.com/cases/federal/appellate-courts/ca9/17-16783/17-16783-2019-09-09.html — *hiQ Labs, Inc. v. LinkedIn Corp.*, 938 F.3d 985 (9th Cir. 2019) (primeira decisão da 9ª Circunscrição).
20. https://static.reuters.com/resources/media/editorial/20170620/hiqvlinkedin--ceaseanddesist.pdf — Cessar-e-desistir original da LinkedIn à hiQ, 23 de maio de 2017 (citando Quicksand, Sentinel, Org Block; e as bases legais CFAA + DMCA + Cal. Penal Code §502(c) + trespass).
21. https://www.fenwick.com/insights/publications/hiq-labs-scrapes-by-again-the-ninth-circuit-reaffirms-that-data-scraping-does-not-violate-the-cfaa-1 — análise jurídica da decisão 2022 da 9ª Circunscrição (Fenwick & West).
22. https://www.goodwinlaw.com/en/insights/publications/2022/04/04_20-ninth-circuit-limits — análise Goodwin Procter 2022 (CFAA "breaking and entering").

> **Observação sobre a fonte do caso Proxycurl (2025):** o conteúdo de `linkedinsider.blog/linkedin-scraping-tools-safety` (acessado 2026-09-02) reporta a settlement, a $500k e a trajetória de enforcement, mas **não foi localizada uma fonte primária** (decisão judicial pública, release oficial da LinkedIn, comunicado da Nubela) que confirme integralmente os números durante a janela desta pesquisa. O leitor deve tratar os valores monetários e datas exatas como **não verificados por fonte primária**; a existência do caso (lawsuit + shutdown) é consistente com o padrão histórico, mas a quantificação permanece secundária.

