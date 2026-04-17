# Production cutover report - `gestschool_v2BD`

Date: 2026-04-17

## Decision

GestSchool_V2 is now cut over to the clean PostgreSQL/Supabase project `gestschool_v2BD`.

The legacy database/project `gestschool` remains intact as archive and rollback source. The backup `gestschool_legacy_backup_20260416212622` remains intact. No bulk legacy data import is approved or executed as part of this cutover.

## Platform status

### Staging

Staging validation was completed before production promotion:

- migrations: OK
- seed minimal: OK
- API e2e: OK
- precutover audits: OK
- `TIMETABLE_REQUIRE_CANONICAL_REFS=true`: validated
- no blocking legacy dependency reported in the validated critical flows

### Production

Production deployment is complete:

- GitHub branch: `main`
- Render API service: live
- Render API URL: `https://gestschool-ylik.onrender.com`
- Vercel web admin: live and validated by the release operator
- Active database target: `gestschool_v2BD`

Render runtime confirmation observed:

```text
Nest application successfully started
API listening on http://0.0.0.0:10000
Your service is live
Available at your primary URL https://gestschool-ylik.onrender.com
```

## Effective production variables

Secrets are intentionally not stored in this repository.

Required API/worker variables:

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=<Supabase gestschool_v2BD pooled URL>
DIRECT_URL=<Supabase gestschool_v2BD direct URL>
DEV_BOOTSTRAP_USERS_ON_START=false
DEV_BOOTSTRAP_PORTAL_USERS=false
TIMETABLE_REQUIRE_CANONICAL_REFS=true
SWAGGER_ENABLED=false
CORS_ORIGINS=<validated Vercel frontend origin>
```

Worker-specific target:

```env
NOTIFICATIONS_WORKER_ENABLED=true
```

API-service target when a separate worker is deployed:

```env
NOTIFICATIONS_WORKER_ENABLED=false
```

Frontend API routing:

```text
/api/v1 -> https://gestschool-ylik.onrender.com/api/v1
```

## Critical flow validation

The release operator confirmed the platform checks after deployment:

- GitHub deploy source: OK
- Vercel frontend deployment: OK
- Render API deployment: OK
- Render API boot logs: OK
- Supabase target project: `gestschool_v2BD`
- legacy project still preserved: OK

Critical flows that must remain part of post-cutover monitoring:

- admin login
- scolarite login
- comptable login
- first-login password change
- academic references
- user creation with `accountType` and role separation
- teacher portal based on `TeacherAssignment`
- parent portal based on `Parent` and `ParentStudentLink.parentId`
- timetable writes with `roomId` and `teacherAssignmentId`
- absence of orphan portal accounts

## Rollback plan

Rollback is allowed only if a critical production incident blocks normal operation.

Do not delete or mutate:

- `gestschool`
- `gestschool_legacy_backup_20260416212622`
- `gestschool_v2BD`

Rollback sequence:

1. Stop the production worker first to avoid duplicate side effects.
2. Repoint Render API `DATABASE_URL` and `DIRECT_URL` only if the incident requires temporary return to the prior approved database.
3. Redeploy or restart the API.
4. Restart the worker only after the API is healthy.
5. Repoint Vercel API routing only if the API hostname changes.
6. Keep `gestschool_v2BD` untouched for incident analysis.
7. Do not replay V2 writes into legacy without a dedicated reconciliation plan.

Rollback triggers:

- API cannot boot on `gestschool_v2BD`.
- Prisma runtime or migration issue blocks core API.
- seeded staff accounts cannot authenticate or reset password.
- canonical timetable references block valid scheduling.
- parent/teacher portals fail due source-of-truth regressions.

## Legacy data policy

No mass import from legacy is part of this release.

Any future reprise must be selective, scripted, auditable and reviewed in this order:

1. academic references;
2. students;
3. parents;
4. parent-student links;
5. teachers;
6. rooms;
7. assignments;
8. bi-cursus placements;
9. timetable slots with canonical references.

## Final verdict

The production cutover is complete.

`gestschool_v2BD` is the active official database for GestSchool_V2. The legacy database remains available only for archive, rollback and future selective data recovery.
