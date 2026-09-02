# syntax=docker/dockerfile:1.7

# ---- 1. deps ----
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

# ---- 2. build ----
FROM deps AS build
WORKDIR /app
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN pnpm --filter @job-radar/shared build
RUN pnpm --filter @job-radar/web build

# ---- 3. dev: vite dev com HMR ----
FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY packages/typescript-config ./packages/typescript-config
COPY packages/eslint-config ./packages/eslint-config
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ---- 4. prod: nginx servindo dist ----
FROM nginx:1.27-alpine AS prod
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1
