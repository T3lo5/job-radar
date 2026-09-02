# 03 — Docker Compose (Postgres + Redis + API + Web)

## Question

Definir `docker-compose.yml` com serviços: `postgres:16-alpine`, `redis:7-alpine`, `api` (Node 20), `web` (Vite dev ou build estático servido por nginx). Health checks. Volumes nomeados para persistência. Rede única. Variáveis de ambiente via `.env`. API depende de postgres/redis healthchecks antes de subir. Web depende de api.

## Type

task

## Status

resolved

## Resolution

Ver `## Answer` ao final.

## Answer

**Decisões**:

- **Compose file**: `docker-compose.yml` na raiz (especificação moderna do compose, sem `version:`).
- **Serviços**: `postgres`, `redis`, `api`, `web` (todos em uma única rede `jobradar-net`).
- **API Dockerfile**: multi-stage — `deps` (pnpm install) → `build` (tsc) → `dev` (tsx watch) e `prod` (node dist). Estágio `dev` usa `tsx watch`; estágio `prod` roda `node dist/server.js`. Dockerfile vive em `apps/api/Dockerfile`.
- **Web Dockerfile**: multi-stage — `deps` (pnpm install) → `build` (vite build) → `dev` (vite dev com HMR) e `prod` (nginx servindo dist). Dockerfile vive em `apps/web/Dockerfile`.
- **Healthchecks**:
  - postgres: `pg_isready`
  - redis: `redis-cli ping`
  - api: `wget --spider /health` (curl não está na imagem alpine; wget está)
  - web: `wget --spider` na porta 80 (nginx) ou 5173 (vite dev)
- **Volumes nomeados**: `postgres-data`, `redis-data`, `api-storage` (uploads de CV do #12).
- **API depende de** postgres e redis (com `condition: service_healthy`).
- **Web depende de** api (apenas start, sem health — em dev queremos que levante junto pra HMR).
- **`.env` na raiz** lido pelo compose. `.env.example` commitado documentando todas as variáveis.
- **API expõe** porta 3001. **Web expõe** porta 5173 (dev) ou 8080 (prod).
- **Profiles**: `dev` e `prod` no compose, default `dev`. Em prod o web usa nginx, em dev usa Vite.
- **`.dockerignore`** em `apps/api` e `apps/web` para não levar `node_modules`, `dist`, `.scratch`.

**Arquivos criados**:

- `docker-compose.yml`
- `docker-compose.override.yml.example` (template para overrides locais)
- `.env.example`
- `apps/api/Dockerfile`
- `apps/api/.dockerignore`
- `apps/web/Dockerfile`
- `apps/web/web/nginx.conf` (configuração nginx para produção)
- `apps/web/.dockerignore`

**Validação** (em ambiente com Docker — se não houver, validação alternativa):

- `docker compose config` valida sintaxe (funciona sem Docker rodando)
- `docker compose --profile dev up -d` + `docker compose ps` (precisa de Docker; documentei como validar localmente)
- `curl http://localhost:3001/health` retorna 200
- `curl http://localhost:5173` retorna HTML do Vite
- API conecta no Postgres (healthcheck `service_completed_successfully`)
- API conecta no Redis (healthcheck `service_completed_successfully`)

**Não inclui** (fica para outros tickets):

- Migrations rodando automaticamente no startup → #08
- BullMQ workers como serviço separado → #15, #18, #21
- Web de produção com CDN → fora do MVP
