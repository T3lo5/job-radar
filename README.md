# Job Radar — Manual Completo de Instalação, Configuração e Uso

[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-324%20passing-brightgreen.svg)](https://github.com/T3lo5/job-radar/actions)
[![License](https://img.shields.io/badge/License-GPL--3.0-yellow.svg)](./LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://hub.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

> **Assistente pessoal de vagas: coleta, compara com o seu perfil (nota 0–100), otimiza seu CV com IA e organiza suas candidaturas.**

---

## 📖 O que é este sistema?

O **Job Radar** é uma aplicação completa que:

1. **Coleta vagas** de 9 fontes (RemoteOK, Remotive, LinkedIn, Google Jobs, Indeed, Adzuna, Jobicy, WeWorkRemotely) com agendamento automático
2. **Compara cada vaga com o seu perfil** e calcula uma nota de aderência (0–100), mostrando o que falta
3. **Otimiza seu currículo com IA** para cada vaga — sem inventar dados (verificado por código, não só por prompt)
4. **Organiza suas candidaturas** num quadro Kanban com notas, contatos e follow-ups
5. **Mostra quanto você gasta de IA** por operação, com alerta de custo
6. **Envia resumo diário** das melhores vagas no Telegram

**Tudo roda no seu computador** — seus dados não saem da sua infraestrutura. Sem terminal obrigatório: tudo se configura pela interface.

---

## 🏗️ Arquitetura Resumida

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 9 Fontes de │────▶│ PostgreSQL  │────▶│  Pipeline   │────▶│   Kanban +  │
│   vagas     │     │  (dados)    │     │ RAW→DONE    │     │  Telegram   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  API REST   │     │  IA (custo  │
                    │  + Web UI   │     │  auditado)  │
                    └─────────────┘     └─────────────┘
```

**Tecnologias:**

- **Backend:** Node.js 20 + Fastify + TypeScript + Prisma ORM
- **Banco:** PostgreSQL 16 (dados) + Redis 7 + BullMQ (filas)
- **IA:** provedor configurável pela UI (OpenAI, Anthropic, DeepSeek, Gemini, Ollama — qualquer API compatível com OpenAI)
- **Frontend:** React 18 + Vite + Tailwind CSS + Radix UI
- **Conta:** login próprio (email + senha, sessões multi-dispositivo, cookie HttpOnly)
- **Monorepo:** pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)

---

## 🚀 Instalação Rápida

### Pré-requisitos

| O que instalar              | Para que serve             | Como instalar                       |
| --------------------------- | -------------------------- | ----------------------------------- |
| **Git**                     | Baixar o projeto           | https://git-scm.com/downloads       |
| **Node.js 20+**             | O motor que roda o sistema | https://nodejs.org/                 |
| **pnpm 9**                  | Gerenciador de pacotes     | `npm i -g pnpm@9.15.0`              |
| **Docker + Docker Compose** | Banco de dados e filas     | https://docs.docker.com/get-docker/ |

> 💡 **Windows:** use `.\dev-up.ps1` no PowerShell ou `.\dev-up.sh` no Git Bash/WSL. Na primeira vez no PowerShell, talvez precise de `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

### 1. Clone e suba tudo

```bash
git clone https://github.com/T3lo5/job-radar.git
cd job-radar
./dev-up.sh
```

**No Windows (PowerShell):**

```powershell
git clone https://github.com/T3lo5/job-radar.git
cd job-radar
.\dev-up.ps1
```

O script faz tudo: confere dependências, limpa servidores antigos órfãos, sobe Postgres + Redis, roda migrations, popula o catálogo de skills, gera o Prisma Client e inicia API + Web.

Acesse:

- **Web:** http://localhost:5173
- **API:** http://localhost:3001
- **Saúde da API:** http://localhost:3001/health

### Parar

```bash
./dev-down.sh          # para API e Web (banco continua rodando)
docker compose down    # para tudo, incluindo banco e Redis
```

| Comando                 | Para que serve                                  |
| ----------------------- | ----------------------------------------------- |
| `./dev-up.sh`           | Inicia tudo e mostra logs                       |
| `./dev-up.sh --reset`   | **Apaga o banco e recomeça do zero (CUIDADO!)** |
| `./dev-up.sh --no-logs` | Inicia sem mostrar logs                         |

---

## 🧭 Primeiro acesso (wizard)

Na primeira vez, o sistema abre o **assistente de configuração** (`/setup`):

1. **Conta** — crie seu login (email + senha). É conta única, sua.
2. **Perfil** — título desejado, senioridade, localização, modalidade (presencial/remoto/qualquer)
3. **IA** — cadastre um provedor (veja abaixo) ou pule: sem chave, a extração usa o modo local por palavras-chave
4. **Agendamento** — com que frequência buscar vagas (padrão: todo dia às 6h)

Depois disso você cai no **Dashboard**.

### Provedor de IA (opcional, mas recomendado)

Sem chave de IA o sistema funciona (coleta, matching por regras, Kanban). Com chave, destrava: análise de vagas, otimização de CV e leitura automática do CV.

1. Acesse **Configurações → IA → + Adicionar**
2. Preencha nome, base URL, API key e modelo. Exemplos:
   - **DeepSeek** (barato): `https://api.deepseek.com/v1` + `deepseek-chat`
   - **OpenAI**: `https://api.openai.com/v1` + `gpt-4o-mini`
   - **Ollama** (local, custo zero): `http://localhost:11434/v1` + `llama3.1`
3. Clique em **Testar** e depois **Criar**. Dá para ter vários e alternar.

> 💡 Modelos locais (Ollama, LM Studio) têm **custo zero** — a tela de uso de IA mostra isso.

### Fontes de vagas

**Configurações → Fontes**: ative/desative cada fonte. Duas precisam de credencial própria (campos na mesma tela):

- **LinkedIn via Apify** — token grátis em https://console.apify.com/account#/integrations
- **Adzuna** — App ID + App Key grátis em https://developer.adzuna.com/signup

O **LinkedIn puro não precisa de nada** (usa a API pública de guest). Se alguma fonte só retornar erro, desative-a — as outras seguem trabalhando.

Para buscar na hora: **🔍 Buscar Agora**. Para processar o que já foi coletado: **⚡ Processar Todas**. A tela mostra o progresso (com cronômetro) e o resultado (quantas entraram, quais fontes falharam).

---

## 🖥️ Usando no dia a dia

### Dashboard

Visão geral: total de vagas, candidaturas em andamento, melhores matches e coletas recentes.

### Vagas

- Filtros por palavra-chave, modalidade, fonte, senioridade e período
- **Nota de 0–100** em cada vaga, com o detalhamento (o que você tem, o que falta, o que é parcial)
- Detalhe da vaga: descrição formatada, breakdown do score, botões **Avaliar Match**, **Otimizar CV** e **Exportar PDF**

### Otimizar CV

1. Abra uma vaga → **Otimizar CV** (ou vá em **Otimizar CV** e cole a descrição)
2. A IA reescreve seu currículo com as palavras-chave da vaga
3. **Regra de Ouro, verificada por código:** a IA não pode atribuir a você tecnologia que não está no seu perfil nem no CV original. Se tentar, a otimização é **rejeitada** com explicação; palavras-chave soltas são removidas com aviso na tela
4. **Exportar PDF** gera o arquivo pronto para enviar

### Candidaturas (Kanban)

Arraste os cards entre Encontrada → Interessante → CV Preparado → Aplicada → Entrevista → Oferta/Rejeitada. Cada card abre notas, contatos, salário e follow-up — e a descrição da vaga em modo leitura (com opção de editar).

### Perfil

Título, senioridade (única + lista), localização, modalidade, faixa salarial, resumo, tipos de cargo, skills com nível, idiomas, formação, certificados, projetos e experiência. Upload de CV em **PDF ou DOCX**:

- PDFs que o extrator antigo não lia (erro técnico `charCode 32`) agora passam por um segundo extrator
- Se o arquivo for digitalização/foto, a tela diz para usar OCR ou mandar DOCX
- **Aplicar no perfil** importa título/resumo/skills/experiência/formação do CV — mas **só preenche o que está vazio**, nunca apaga o que você já escreveu
- Salário entende formato brasileiro (`20.000` = vinte mil, não vinte)

### Analytics

Vagas coletadas/analisadas por status, candidaturas e taxas (resposta, entrevista, oferta), distribuição de scores, skills mais frequentes e **maiores lacunas** (o que o mercado pede e você não tem).

### Configurações → IA → Uso de IA

Quanto você gastou com IA no período (7/30/90 dias), por operação (leitura de CV, extração, análise, otimização…). Valores estimados por tabela de preço de referência — confira antes de usar para faturamento.

---

## 📡 API REST

Base: `http://localhost:3001`. Autenticação por cookie de sessão (login em `/setup` ou `/login`). Respostas de erro: `{ "error": "mensagem" }`.

### Conta e setup

| Método | Endpoint                 | Descrição                                         |
| ------ | ------------------------ | ------------------------------------------------- |
| GET    | `/api/auth/status`       | Tem conta? (público, decide entre login e wizard) |
| POST   | `/api/auth/setup`        | Cria a conta no wizard                            |
| POST   | `/api/auth/login`        | Login (email + senha)                             |
| POST   | `/api/auth/logout`       | Logout                                            |
| GET    | `/api/auth/me`           | Sessão atual                                      |
| GET    | `/api/auth/sessions`     | Dispositivos conectados                           |
| DELETE | `/api/auth/sessions/:id` | Revogar dispositivo                               |
| POST   | `/api/auth/password`     | Trocar senha                                      |
| GET    | `/api/setup/status`      | Wizard concluído?                                 |
| POST   | `/api/setup/ai`          | Salva provedor no wizard                          |
| POST   | `/api/setup/cron`        | Salva agendamento no wizard                       |
| POST   | `/api/setup/complete`    | Conclui o wizard                                  |

### Perfil e currículo

| Método          | Endpoint                                               | Descrição                 |
| --------------- | ------------------------------------------------------ | ------------------------- |
| GET/PUT         | `/api/profile`                                         | Ver/atualizar perfil      |
| POST/DELETE     | `/api/profile/skills`, `/api/profile/skills/:id`       | Skills                    |
| POST/PUT/DELETE | `/api/profile/education`, `/api/profile/education/:id` | Formação                  |
| POST/PUT/DELETE | `/api/profile/certifications`, `/:id`                  | Certificados              |
| POST/PUT/DELETE | `/api/profile/projects`, `/:id`                        | Projetos                  |
| POST/PUT/DELETE | `/api/profile/work-experiences`, `/:id`                | Experiência               |
| POST/GET        | `/api/resumes`, `/api/resumes`                         | Upload (PDF/DOCX) e lista |
| GET/DELETE      | `/api/resumes/:id`, `/api/resumes/:id`                 | Baixar/remover            |
| GET             | `/api/resumes/:id/text`                                | Texto extraído            |
| POST            | `/api/resumes/:id/extract`                             | Leitura por IA do CV      |

### Vagas, match e CV

| Método         | Endpoint                     | Descrição                                                                                                              |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET            | `/api/jobs`                  | Lista paginada (filtros: `page`, `limit`, `sourceId`, `status`, `remote`, `seniority`, `search`, `fromDate`, `toDate`) |
| GET/POST/PATCH | `/api/jobs/:id`              | Detalhe / criar manual / atualizar                                                                                     |
| GET            | `/api/jobs/stats`            | Totais por status e fonte                                                                                              |
| POST           | `/api/match/evaluate`        | Avalia uma vaga (`{ jobId }`)                                                                                          |
| GET            | `/api/match/results`         | Matches do perfil                                                                                                      |
| POST           | `/api/cv/optimize`           | Otimiza o CV (`{ resumeId?, jobId?, jobDescription? }`)                                                                |
| POST           | `/api/cv/export-pdf`         | PDF do CV otimizado                                                                                                    |
| GET            | `/api/cv/versions/:resumeId` | Versões geradas                                                                                                        |

### Candidaturas

| Método   | Endpoint                          | Descrição                          |
| -------- | --------------------------------- | ---------------------------------- |
| GET/POST | `/api/applications`               | Lista / cria (`{ jobId, notes? }`) |
| PATCH    | `/api/applications/:id`           | Notas, salário, contatos           |
| POST     | `/api/applications/:id/status`    | Move no Kanban                     |
| POST     | `/api/applications/:id/follow-up` | Agenda follow-up                   |

### Coleta, IA e sistema

| Método   | Endpoint                                 | Descrição                                  |
| -------- | ---------------------------------------- | ------------------------------------------ |
| POST     | `/api/admin/collect-now`                 | Coleta síncrona (`{ collected, errors }`)  |
| POST     | `/api/admin/collect-async`               | Coleta em background (202)                 |
| POST     | `/api/admin/process-all`                 | Enfileira vagas RAW (`{ message, count }`) |
| GET      | `/api/admin/sources`                     | Fontes + status                            |
| GET      | `/api/admin/jobs/status`                 | Contagem por status                        |
| GET      | `/api/admin/ai-runs`                     | Auditoria de IA (`?type=`, `?page=`)       |
| GET      | `/api/admin/ai-usage`                    | Custo por operação (`?days=`)              |
| GET      | `/api/analytics/overview`                | Analytics (`?days=1..365`)                 |
| GET/POST | `/api/ai-providers`, `/api/ai-providers` | Provedores de IA                           |
| POST     | `/api/ai/test`                           | Testa conexão do provedor                  |
| GET/POST | `/api/settings`, `/api/settings/:scope`  | Configurações                              |
| POST     | `/api/admin/send-daily-report`           | Dispara o relatório diário                 |
| POST     | `/api/notifications/test`                | Testa notificação                          |
| GET      | `/health`, `/health/ready`               | Saúde (sem auth)                           |

---

## 🛠️ Scripts

```bash
pnpm dev            # API + Web em paralelo (alternativa ao dev-up.sh)
pnpm build          # build de packages e apps
pnpm typecheck      # TypeScript em tudo
pnpm lint           # ESLint em tudo
pnpm format         # Prettier em tudo
pnpm test           # 324 testes nos 3 workspaces
```

Banco (dentro de `apps/api`):

```bash
pnpm db:deploy    # aplica migrations
pnpm db:seed      # popula skills + usuário demo (não apaga nada existente)
pnpm db:studio    # abre o Prisma Studio
```

---

## 📁 Estrutura

```
.
├── apps/
│   ├── api/      # Fastify + Prisma + BullMQ + IA
│   └── web/      # React + Vite + Tailwind + Radix
├── packages/
│   ├── shared/              # Tipos e rótulos de domínio
│   ├── typescript-config/   # tsconfig base
│   └── eslint-config/       # eslint base
├── docs/
│   ├── adr/                 # Decisões arquiteturais
│   └── agents/              # Habilidades dos agentes de IA
├── .github/                 # Templates de issue/PR + CI
├── AGENTS.md                # Guia para agentes de IA
├── CONTEXT.md               # Contexto e termos do domínio
├── CHANGELOG.md             # Histórico de mudanças
├── CONTRIBUTING.md          # Como contribuir
├── dev-up.sh / dev-down.sh  # Sobe/para o ambiente (e .ps1 no Windows)
└── package.json
```

---

## 🗄️ Banco de dados

PostgreSQL 16 via Docker (`docker compose up -d postgres redis`). Migrations em `apps/api/prisma/migrations`, aplicadas pelo `dev-up.sh` (ou `pnpm db:deploy`).

Tabelas principais: `jobs` (com hash único p/ dedup), `skills`, `job_skills`, `profiles`, `job_matches`, `job_analyses`, `applications`, `resumes`, `ai_runs` (auditoria de custo), `ai_providers`, `job_sources`, `settings` (criptografados com AES-256-GCM), `users`, `sessions`.

Backup rápido:

```bash
docker compose exec postgres pg_dump -U jobradar jobradar > backup.sql
```

---

## 🧪 Testes e qualidade

```bash
pnpm test         # 324 testes: 235 api + 72 web + 17 shared
pnpm typecheck    # TS estrito nos 3 workspaces
pnpm lint         # ESLint, zero erros
pnpm build        # build + smoke test do artefato
```

O CI (`.github/workflows/ci.yml`) roda lint → typecheck → format → build → testes, com Postgres de verdade para os testes de integração. Cobrem: coleta em lote, pipeline completo (RAW→DONE), idempotência, Regra de Ouro anti-invenção da IA, auditoria de custo, sanitização anti-XSS e os formatos brasileiros.

---

## 🚀 Deploy

### Checklist

- `SETTINGS_ENCRYPTION_KEY` forte e guardada em cofre (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- `CORS_ORIGINS` com o domínio real (nunca vazio em produção)
- `NODE_ENV=production`, HTTPS via reverse proxy
- Backup do volume do Postgres

### Docker (produção)

```bash
cp .env.example .env   # preencha: chave, CORS, senhas
docker compose -f docker-compose.prod.yml up --build -d
```

---

## 🔒 Segurança

- Senhas com `scrypt`, sessões opacas revogáveis em cookie HttpOnly
- Settings sensíveis criptografados (AES-256-GCM)
- Upload só PDF/DOCX até 10 MB; HTML sanitizado contra XSS
- Rate limit nos endpoints sensíveis; CORS com allowlist
- Reporte vulnerabilidades em **segredo**: abra um [Security Advisory privado](../../security/advisories/new) — nunca em issue pública. Detalhes em [`SECURITY.md`](./SECURITY.md)

---

## 🐛 Troubleshooting

### Porta 3001/5173 em uso (`EADDRINUSE`)

O `dev-up.sh` atual já limpa servidores antigos do projeto sozinho. Se insistir:

```bash
ss -ltnp | grep -E '3001|5173'   # quem segura
pkill -f "tsx watch src/server.ts"
./dev-up.sh
```

### Banco não conecta

```bash
docker compose ps                # postgres e redis "healthy"?
docker compose up -d postgres redis
```

### "Processar Todas" dá erro

Verifique o log da API: o erro real aparece lá (ex.: fila do Redis fora do ar). Com Redis saudável, enfileira e os status andam sozinhos.

### Fonte retorna erro na coleta

O painel de Fontes lista o erro por fonte. `403` no Indeed é o anti-robô deles (varia por rede) — desative a fonte se ela não entregar nada; `404` em qualquer fonte é bug nosso, [abra uma issue](../../issues/new/choose).

### Upload de CV falha

PDFs com estrutura moderna agora passam pelo segundo extrator. Se falhar: exporte de novo (Imprimir → Salvar como PDF) ou mande DOCX. Digitalização/foto precisa de OCR antes.

### Salário gravou errado

Digite no formato brasileiro (`20.000`, não `20,000` e sem `R$`). A tela mostra com milhar para conferir.

### Edição de experiência/certificado não salvava

Corrigido: datas vazias não derrubam mais o save. Se ver erro ao salvar, abra uma issue com o texto do toast.

### Reset total (apaga TUDO)

```bash
./dev-up.sh --reset   # último recurso: banco zerado
```

---

## 📄 Licença e comunidade

Este projeto é **software livre** sob a **GNU General Public License v3.0 (GPL-3)** — veja [`LICENSE`](./LICENSE).

- **Uso livre:** use, modifique e distribua à vontade
- **Copyleft:** quem redistribuir (original ou modificado) tem que manter a mesma licença e o código aberto — ninguém pode fechar o projeto
- **Ao contribuir**, você concorda que sua contribuição segue GPL-3

## 🤝 Contribuindo

Guia completo em [`CONTRIBUTING.md`](./CONTRIBUTING.md): como reportar bug, sugerir feature, abrir PR (fork → branch `feat/*`/`fix/*` → checks verdes → PR), padrões de commit e áreas que precisam de ajuda (i18n, acessibilidade, testes de componente…).

## 🆘 Suporte

- **Bugs e ideias:** [Issues](../../issues/new/choose) (templates de bug e feature)
- **Dúvidas de uso:** este README + seção Troubleshooting acima
- **Docs técnicas:** `CONTEXT.md`, `docs/adr/`, `AGENTS.md` (para agentes de IA)
- **Segurança:** [`SECURITY.md`](./SECURITY.md) (canal privado)

---

**🎉 Pronto! `./dev-up.sh`, abra http://localhost:5173, complete o wizard e clique em 🔍 Buscar Agora.**
