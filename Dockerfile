# syntax=docker/dockerfile:1
#
# Multi-stage build for apps/web (Next.js standalone output).
# Build from the repo root:  docker build -t feedbackport-web .
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be passed as build args (they are public by design). Server-side secrets
# (SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, UPSTASH_*) are NEVER baked
# in: they are injected at runtime only. See docs/decisions/0003-*.

ARG NODE_VERSION=22-bookworm-slim

# ---- deps: install workspace dependencies (cached while manifests are unchanged)
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/widget/package.json packages/widget/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @feedbackport/web... --filter @feedbackport/widget...

# ---- build
FROM deps AS build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/widget packages/widget
COPY apps/web apps/web
RUN pnpm --filter @feedbackport/widget build \
    && mkdir -p apps/web/public \
    && cp packages/widget/dist/widget.js apps/web/public/widget.js
RUN pnpm --filter @feedbackport/web build

# ---- runtime: only the traced standalone output, as a non-root user
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
