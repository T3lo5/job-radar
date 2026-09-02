# Job Radar

🎯 Sistema pessoal para descoberta, análise e priorização de vagas de tecnologia — e um projeto **livre e comunitário**.

> **Este projeto é livre e aberto.** Alterações e melhorias devem ser redistribuídas sob a mesma licença. Veja [`LICENSE`](./LICENSE).

## Documentação

- **Setup passo a passo**: [`SETUP.md`](./SETUP.md)
- **Mapa do projeto**: `.scratch/job-radar/map.md`
- **Contexto e termos**: `CONTEXT.md`
- **Decisões arquiteturais**: `docs/adr/`

## Stack

- **Monorepo**: pnpm workspaces
- **Backend**: Node 20 + Fastify + TypeScript + Prisma ORM
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Radix UI
- **Banco**: PostgreSQL 16
- **Cache/Filas**: Redis 7 (BullMQ)
- **IA**: provider configurável (OpenAI, Anthropic, etc)
- **Notificações**: Telegram Bot

## Funcionalidades

- Coleta automática de vagas em múltiplas fontes (RemoteOK, Remotive, LinkedIn, Google Jobs, Indeed, Adzuna, Jobicy, WeWorkRemotely)
- Deduplicação de vagas por hash
- Perfil profissional completo com skills, idiomas, educação, certificados, projetos e experiência profissional
- Upload de currículo
- Matching engine com score de aderência (0-100)
- Sistema de configuração via UI (SettingsService com criptografia AES-256-GCM)
- Worker de coleta agendado (cron)
- Dashboard web para visualização
- Otimização de CV com IA
- Notificações no Telegram com resumo diário das melhores vagas
- Kanban de candidaturas para acompanhar seu processo seletivo

## Estrutura

```
.
├── apps/
│   ├── api/      # Backend Fastify
│   └── web/      # Frontend React/Vite
├── packages/
│   ├── shared/              # Tipos e utilitários de domínio
│   ├── typescript-config/   # tsconfig base
│   └── eslint-config/       # eslint base
├── docs/
│   ├── adr/                 # Architectural Decision Records
│   └── agents/              # Config dos skills do agente
├── .scratch/
│   └── job-radar/           # Tracker local (wayfinder)
├── AGENTS.md
├── CONTEXT.md
├── SETUP.md
├── pnpm-workspace.yaml
└── package.json
```

## Pré-requisitos

Antes de começar, você vai precisar instalar algumas ferramentas básicas. Não se assuste — é só uma vez:

| O que instalar | Para que serve | Como instalar |
|----------------|----------------|---------------|
| **Git** | Para baixar o projeto | https://git-scm.com/downloads |
| **Node.js 20+** | O motor que roda o sistema | https://nodejs.org/ |
| **pnpm** | Gerenciador de pacotes | https://pnpm.io/installation |
| **Docker + Docker Compose** | Banco de dados e cache (o sistema usa para guardar suas informações) | https://docs.docker.com/get-docker/ |
| **Editor de texto** (recomendado: VS Code) | Para editar arquivos de configuração | https://code.visualstudio.com/ |

> 💡 **Dica para usuários Windows:** recomendamos usar o [WSL2](https://learn.microsoft.com/pt-br/windows/wsl/install) para rodar os comandos de forma mais simples. Se você não sabe o que é WSL, pode tentar direto no Windows mesmo — se der erro, volte aqui e siga o guia do WSL.

## Setup local

### Quick Start (recomendado)

```bash
git clone https://github.com/seu-usuario/job-vacancy-tracker.git
cd job-vacancy-tracker
cp .env.example .env
# Edite o .env com suas configurações
./dev-up.sh
```

Esse script automatiza tudo:
1. Verifica dependências
2. Sobe containers (PostgreSQL, Redis)
3. Roda migrations
4. Popula dados iniciais (seed)
5. Inicia API e Web
6. Mostra logs combinados

Acesse:
- Frontend: http://localhost:5173
- API: http://localhost:3001
- API Health: http://localhost:3001/health

> ⚠️ Para instruções detalhadas passo a passo, consulte [`SETUP.md`](./SETUP.md).

### Opções do dev-up.sh

```bash
./dev-up.sh           # Inicia tudo e mostra logs
./dev-up.sh --reset   # Reseta banco e inicia
./dev-up.sh --no-logs # Inicia sem mostrar logs
```

### Parar os servidores

```bash
./dev-down.sh         # Para API e Web
docker compose down   # Para tudo (incluindo containers)
```

## Scripts

- `pnpm dev` — sobe API e Web em paralelo
- `pnpm build` — builda todos os packages e apps
- `pnpm typecheck` — typecheck em tudo
- `pnpm lint` — lint em tudo
- `pnpm format` — formata código com Prettier
- `pnpm test` — testes em tudo
- `pnpm db:push` — sincroniza schema do banco
- `pnpm db:seed` — popula dados iniciais
- `pnpm db:studio` — abre Prisma Studio

## Como adicionar uma nova fonte de vaga

1. Crie um arquivo em `apps/api/src/sources/` implementando a interface `JobSource`
2. Registre a fonte em `apps/api/src/sources/index.ts`
3. A fonte estará disponível automaticamente para coleta

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/health/ready` | Health check com DB + Redis |
| GET | `/api/profile` | Perfil atual |
| PUT | `/api/profile` | Atualizar perfil |
| POST | `/api/profile/skills` | Adicionar skill |
| DELETE | `/api/profile/skills/:id` | Remover skill |
| POST | `/api/profile/education` | Adicionar formação |
| PUT | `/api/profile/education/:id` | Atualizar formação |
| DELETE | `/api/profile/education/:id` | Remover formação |
| POST | `/api/profile/certifications` | Adicionar certificado |
| PUT | `/api/profile/certifications/:id` | Atualizar certificado |
| DELETE | `/api/profile/certifications/:id` | Remover certificado |
| POST | `/api/profile/projects` | Adicionar projeto |
| PUT | `/api/profile/projects/:id` | Atualizar projeto |
| DELETE | `/api/profile/projects/:id` | Remover projeto |
| POST | `/api/profile/work-experiences` | Adicionar experiência |
| PUT | `/api/profile/work-experiences/:id` | Atualizar experiência |
| DELETE | `/api/profile/work-experiences/:id` | Remover experiência |
| POST | `/api/resumes` | Upload de currículo |
| GET | `/api/resumes` | Listar currículos |
| DELETE | `/api/resumes/:id` | Remover currículo |
| POST | `/api/resumes/:id/extract` | Extrair texto do currículo |
| GET | `/api/jobs` | Lista paginada de vagas |
| GET | `/api/jobs/:id` | Detalhes de uma vaga |
| POST | `/api/jobs` | Criar vaga manualmente |
| PATCH | `/api/jobs/:id` | Atualizar vaga |
| GET | `/api/jobs/stats` | Estatísticas |
| POST | `/api/match/evaluate` | Avaliar job vs perfil |
| GET | `/api/match/results` | Resultados de matching |
| POST | `/api/admin/collect-now` | Forçar coleta de vagas |
| GET | `/api/setup/status` | Status do setup |
| POST | `/api/setup/complete` | Completar setup |

## Distribuição e licença

Este projeto é distribuído sob a **GNU General Public License v3.0 (GPL-3)**.

### O que isso significa para você?

- **Uso livre:** você pode usar, modificar e distribuir este software livremente
- **Compartilhamento obrigatório:** qualquer modificação ou trabalho derivado deve ser distribuído sob a **mesma licença**
- **Transparência:** o código fonte deve estar disponível para os usuários
- **Créditos mantidos:** você deve reconhecer a autoria original

### Empacotamento e distribuição

Para distribuir o Job Radar como um executável ou pacote instalável:

1. **Build do frontend**: `pnpm build` gera os arquivos estáticos em `apps/web/dist`
2. **Build do backend**: `pnpm build` também builda o backend em `apps/api/dist`
3. **Empacote junto com Node.js**: Use ferramentas como `pkg`, `nexe` ou `esbuild` para criar executáveis
4. **Empacote como Docker**: Use o `Dockerfile` para criar uma imagem autocontida
5. **Empacote como desktop app**: Use ferramentas como `Electron`, `Tauri` ou `neutralino` para criar instaladores para Windows, macOS e Linux

> 💡 O foco atual é rodar localmente via `./dev-up.sh`. Se você quiser ajudar a criar pacotes de instalação fáceis para usuários não técnicos, contribua com um PR!

### Por que GPL-3?

Porque queremos que o Job Radar continue sendo **um projeto da comunidade**. Se alguém pegar o código, melhorar e redistribuir, essa versão melhorada também tem que ser aberta — ninguém pode transformá-lo em um produto fechado. Isso protege a comunidade e garante que todas as melhorias voltem para todos.

Para mais detalhes, consulte o arquivo [`LICENSE`](./LICENSE).

## Como contribuir

O Job Radar é um projeto **comunitário e livre**. Qualquer pessoa pode:
- Reportar bugs
- Sugerir novas funcionalidades
- Melhorar a documentação
- Implementar novas fontes de vaga
- Corrigir problemas visuais ou de usabilidade
- Compartilhar o projeto com outras pessoas

Para contribuir:

1. Faça um **fork** do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das mudanças (`git commit -m 'feat: adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um **Pull Request**

Todas as contribuições devem ser distribuídas sob a **GPL-3**.

> **Importante:** Ao contribuir, você concorda que suas alterações serão redistribuídas sob a mesma licença. Isso garante que o projeto continue sendo um bem da comunidade.

## Licença

GNU General Public License v3.0 — veja [`LICENSE`](./LICENSE) para detalhes.
