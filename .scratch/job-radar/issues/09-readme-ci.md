# 09 — README e CI básico

## Question

README com:

- Descrição do projeto
- Pré-requisitos (Docker, Node 20, pnpm)
- `pnpm install` → `cp .env.example .env` → `docker compose up` → `pnpm db:migrate` → `pnpm dev`
- Estrutura de pastas
- Como adicionar uma nova fonte de vaga
- Como contribuir

CI (GitHub Actions): `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` em PRs. Cache de pnpm.

## Type

task

## Status

done

## Resolution

**README.md** atualizado com:
- Descrição do projeto e funcionalidades
- Stack completa (Fastify, Prisma, React, Tailwind, etc.)
- Pré-requisitos e setup local
- Instruções para gerar SETTINGS_ENCRYPTION_KEY
- Lista de scripts disponíveis
- Guia de como adicionar nova fonte de vaga
- Tabela de endpoints da API

**CI** (`.github/workflows/ci.yml`):
- Trigger: PRs e pushes para `main`
- Steps: install → lint → typecheck → format:check → test
- Cache de pnpm
- Node 20
