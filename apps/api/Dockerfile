# syntax=docker/dockerfile:1.7

# ---- 1. deps: instala dependências de todo o workspace ----
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# ---- 2. build: compila TypeScript ----
FROM deps AS build
WORKDIR /app
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN pnpm --filter @job-radar/shared build
RUN pnpm --filter @job-radar/api build

# ---- 3. dev: tsx watch ----
FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["pnpm", "dev"]

# ---- 4. prod: node com dist compilado ----
FROM node:20-alpine AS prod
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @job-radar/api...
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
