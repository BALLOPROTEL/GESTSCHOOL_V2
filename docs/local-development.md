# Local development

This runbook documents the current local development workflow for GestSchool_V2.

## Repository paths

| Area | Path |
| --- | --- |
| Web admin | `Frontend/web-admin` |
| API and worker | `Backend/api` |
| Prisma schema and migrations | `Backend/api/prisma` |
| Local Docker compose | `Infrastructure/docker/docker-compose.dev.yml` |
| Root package scripts | `package.json` |

## First setup

Run from the repository root:

```bash
pnpm install
cp Backend/api/.env.example Backend/api/.env
cp Frontend/web-admin/.env.example Frontend/web-admin/.env
```

Never commit local `.env` files. Replace any local default credential before using a shared, staging or production environment.

## Start local services

```bash
docker compose -f Infrastructure/docker/docker-compose.dev.yml up -d
```

Stop local services:

```bash
docker compose -f Infrastructure/docker/docker-compose.dev.yml down
```

## Prepare the database

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:seed:minimal
pnpm --filter @gestschool/api db:seed:users
```

Seeded local accounts are controlled by `Backend/api/.env.example`. Do not copy credentials into documentation, issues, pull requests or screenshots.

## Run the app

API:

```bash
pnpm dev:api
```

Worker:

```bash
pnpm dev:worker
```

Web admin:

```bash
pnpm dev:web
```

## Validate before committing

Frontend:

```bash
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
```

Backend:

```bash
pnpm --filter @gestschool/api prisma:generate
pnpm --filter @gestschool/api lint
pnpm --filter @gestschool/api build
```

Backend e2e on a disposable PostgreSQL database:

```bash
export TEST_DATABASE_URL="postgresql://<user>:<password>@localhost:5432/gestschool_test"
export TEST_DIRECT_URL="$TEST_DATABASE_URL"
export DATABASE_URL="$TEST_DATABASE_URL"
export DIRECT_URL="$TEST_DIRECT_URL"

pnpm --filter @gestschool/api test:e2e:db:fresh
```

Global checks:

```bash
pnpm lint
pnpm build
git diff --check
```

## Local URLs

- API health: `http://localhost:3000/api/v1/health`
- API readiness: `http://localhost:3000/api/v1/health/ready`
- Swagger, when enabled: `http://localhost:3000/api/docs`
- Web admin: the port printed by Vite after `pnpm dev:web`

## Safety notes

- Do not run e2e tests against staging or production.
- Do not put provider secrets in frontend env files.
- Do not commit SQL dumps, local screenshots, generated browser archives or tool bundles.
- Use `docs/project-structure.md` as the source of truth for repository paths.
