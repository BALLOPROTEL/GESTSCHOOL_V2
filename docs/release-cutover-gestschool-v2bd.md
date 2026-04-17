# Release cutover - `gestschool_v2BD`

Generated on 2026-04-17.

## Scope

This document tracks the controlled staging/production cutover from legacy `gestschool` to the clean GestSchool_V2 database `gestschool_v2BD`.

## Current execution status

Platform deployment was not executed from this workstation.

Blocking facts:

- `vercel` CLI: not installed.
- `render` CLI: not installed.
- `VERCEL_TOKEN`: not present.
- `VERCEL_ORG_ID`: not present.
- `VERCEL_PROJECT_ID`: not present.
- `RENDER_API_KEY`: not present.
- Render service ids: not present.
- `D:\PROJETS\GestSchool_V2` is not a Git repository, so Git-based auto-deploy cannot be triggered from this folder.
- The repository contains `render.yaml` and `vercel.json`, but no local authenticated platform link is available.

Therefore, staging and production must be triggered from the authenticated deployment environment, or after installing/authenticating the required CLIs and linking the project.

## Render deployment command guardrail

GestSchool_V2 is a pnpm workspace. Render must not use its default `yarn` build command for this repository.

If Render logs show:

```text
Running build command 'yarn'
```

then the service is not using the repository `render.yaml` blueprint, or the Render dashboard has a manual build command overriding the blueprint.

Use this API build command on Render:

```bash
corepack enable && corepack prepare pnpm@10.24.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @gestschool/api prisma:generate && pnpm --filter @gestschool/api build
```

Use this API start command:

```bash
pnpm --filter @gestschool/api start:prod
```

Use this worker build command:

```bash
corepack enable && corepack prepare pnpm@10.24.0 --activate && pnpm install --frozen-lockfile && pnpm --filter @gestschool/api prisma:generate && pnpm --filter @gestschool/api build
```

Use this worker start command:

```bash
pnpm --filter @gestschool/api start:worker
```

## Local pre-release validation

Target database:

```text
gestschool_v2BD
```

Rollback databases confirmed present:

```text
gestschool
gestschool_legacy_backup_20260416212622
gestschool_v2BD
```

Latest local checks:

- `pnpm --filter @gestschool/api db:status`: passed, database schema is up to date.
- `pnpm --filter @gestschool/api audit:precutover`: passed, `READY_CANDIDATE`.
- `TIMETABLE_REQUIRE_CANONICAL_REFS=true`: already validated by e2e in the previous cutover preparation.

Latest report:

```text
apps/api/reports/v2bd-release-precutover-audit.json
```

## Required staging environment

Set these on staging API and worker:

```env
DATABASE_URL=postgresql://gestschool:<secret>@<host>:<port>/gestschool_v2BD
DIRECT_URL=postgresql://gestschool:<secret>@<host>:<port>/gestschool_v2BD
DEV_BOOTSTRAP_USERS_ON_START=false
DEV_BOOTSTRAP_PORTAL_USERS=false
TIMETABLE_REQUIRE_CANONICAL_REFS=true
NOTIFICATIONS_WORKER_ENABLED=true
NODE_ENV=production
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
```

For API only, `NOTIFICATIONS_WORKER_ENABLED` may remain `false` if the separate worker service is enabled.

Required web variable:

```env
VITE_API_BASE_URL=<staging-api-url>/api/v1
```

## Staging deployment gate

Do not promote production until all staging checks pass:

1. API service starts without Prisma errors.
2. Worker starts and does not duplicate notification dispatch.
3. Web admin loads and calls staging API.
4. Admin login works.
5. Scolarite login works.
6. Comptable login works.
7. First-login password-change flow works.
8. Academic reference screens load.
9. User creation works with `accountType` and role separation.
10. Teacher portal resolves through `Teacher.userId -> TeacherAssignment`.
11. Parent portal resolves through `Parent.userId -> ParentStudentLink.parentId`.
12. Timetable creation requires `roomId` and `teacherAssignmentId`.
13. No orphan portal accounts are reported by `audit:precutover`.
14. Logs contain no blocking startup/runtime error.

## Production deployment gate

Only after staging is accepted:

1. Set the same database and guardrail variables on production API/worker.
2. Deploy API.
3. Deploy worker.
4. Deploy web admin with production API URL.
5. Re-run smoke tests: login, users, references, portals, timetable canonical write.
6. Re-run or archive an `audit:precutover` report against production database.
7. Confirm `gestschool_v2BD` as the official active database.

## Rollback

Do not delete or mutate:

- `gestschool`
- `gestschool_legacy_backup_20260416212622`

Rollback trigger examples:

- API cannot boot on `gestschool_v2BD`.
- Authentication fails for seeded staff accounts after password reset.
- Prisma migration/runtime errors block core API.
- Timetable canonical references block normal scheduling despite valid `roomId` and `teacherAssignmentId`.
- Parent/teacher portals fail due source-of-truth regressions.

Rollback procedure:

1. Stop production worker first to avoid duplicate side effects.
2. Repoint production API `DATABASE_URL` and `DIRECT_URL` to the prior approved database only if the incident requires legacy service continuity.
3. Redeploy/restart API.
4. Redeploy/restart worker only after API is healthy.
5. Repoint web API URL only if the API hostname changes.
6. Keep `gestschool_v2BD` untouched for incident analysis.
7. Do not replay V2 writes into legacy without a dedicated reconciliation plan.

## Legacy data policy

No bulk legacy import is approved for this release.

Future reprise must be selective and scripted in this order:

1. academic references;
2. students;
3. parents;
4. parent-student links;
5. teachers;
6. rooms;
7. assignments;
8. bi-cursus placements;
9. timetable slots with canonical references.

## Release verdict

Technical database preparation is ready. Platform cutover is blocked until Render/Vercel authentication and target service ids/project links are available.
