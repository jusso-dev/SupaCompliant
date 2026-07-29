FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.base.json ./

FROM base AS deps
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
RUN pnpm --filter @supacompliant/shared build \
 && pnpm --filter @supacompliant/assessment-engine build \
 && pnpm --filter @supacompliant/control-library build \
 && pnpm --filter @supacompliant/framework-mappings build \
 && pnpm --filter @supacompliant/reporting build \
 && pnpm --filter @supacompliant/database build \
 && pnpm --filter @supacompliant/web build \
 && pnpm --filter @supacompliant/worker build \
 && pnpm --filter @supacompliant/cli build

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]

FROM node:22-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
