# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

ARG NODE_VERSION=22.22.0
ARG PNPM_VERSION=10.24.0

FROM node:${NODE_VERSION}-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare "pnpm@${PNPM_VERSION}" --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY Backend/api/package.json Backend/api/package.json
COPY Frontend/web-admin/package.json Frontend/web-admin/package.json
COPY Infrastructure/migration/package.json Infrastructure/migration/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM dependencies AS build
COPY Backend/api Backend/api
RUN pnpm --filter @gestschool/api prisma:generate \
  && pnpm --filter @gestschool/api build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm --filter @gestschool/api deploy --prod /opt/gestschool-api \
  && pnpm --filter @gestschool/db-migration deploy --prod /opt/gestschool-migration \
  && source_client="$(find /workspace/node_modules/.pnpm -path '*/node_modules/.prisma/client' -type d -print -quit)" \
  && target_client_package="$(find /opt/gestschool-api/node_modules/.pnpm -path '*/node_modules/@prisma/client' -type d -print -quit)" \
  && test -n "$source_client" \
  && test -n "$target_client_package" \
  && target_node_modules="$(dirname "$(dirname "$target_client_package")")" \
  && mkdir -p "$target_node_modules/.prisma" \
  && cp -a "$source_client" "$target_node_modules/.prisma/client"

FROM node:${NODE_VERSION}-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS migration
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="GestSchool database migration" \
  org.opencontainers.image.description="Controlled Prisma migration runner for GestSchool" \
  org.opencontainers.image.created="${BUILD_DATE}" \
  org.opencontainers.image.revision="${VCS_REF}" \
  org.opencontainers.image.source="https://github.com/BALLOPROTEL/GESTSCHOOL_V2"
ENV NODE_ENV=production
ENV HOME=/tmp
WORKDIR /app
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build --chown=node:node /opt/gestschool-migration/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/gestschool-migration/package.json ./package.json
COPY --from=build --chown=node:node /workspace/Backend/api/prisma ./prisma
COPY --from=build --chown=node:node /workspace/Backend/api/scripts/load-env.cjs ./scripts/load-env.cjs
COPY --from=build --chown=node:node /workspace/Backend/api/scripts/prisma-command.cjs ./scripts/prisma-command.cjs
USER node
CMD ["node", "scripts/prisma-command.cjs", "migrate", "deploy"]

FROM node:${NODE_VERSION}-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94 AS runtime-base
ARG BUILD_DATE=unknown
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="GestSchool API" \
  org.opencontainers.image.description="GestSchool NestJS API and background worker runtime" \
  org.opencontainers.image.created="${BUILD_DATE}" \
  org.opencontainers.image.revision="${VCS_REF}" \
  org.opencontainers.image.source="https://github.com/BALLOPROTEL/GESTSCHOOL_V2"
ENV NODE_ENV=production
ENV HOME=/tmp
ENV NODE_OPTIONS=--enable-source-maps
WORKDIR /app
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install --no-install-recommends -y ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build --chown=node:node /opt/gestschool-api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/Backend/api/package.json ./package.json
COPY --from=build --chown=node:node /workspace/Backend/api/dist ./dist
COPY --from=build --chown=node:node /workspace/Backend/api/scripts/load-env.cjs ./scripts/load-env.cjs
COPY --from=build --chown=node:node /workspace/Backend/api/scripts/validate-production-env.cjs ./scripts/validate-production-env.cjs
USER node

FROM runtime-base AS api
ENV API_PORT=3000
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/api/v1/health/live').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["/bin/sh", "-c", "node scripts/validate-production-env.cjs && exec node dist/main.js"]

FROM runtime-base AS worker
ENV WORKER_HEALTH_PORT=3001
EXPOSE 3001
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||3001)+'/health/live').then((r)=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["/bin/sh", "-c", "node scripts/validate-production-env.cjs && exec node dist/worker.js"]
