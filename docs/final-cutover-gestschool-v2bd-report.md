# Final cutover preparation - `gestschool_v2BD`

Generated on 2026-04-17.

## Decision

`gestschool` remains the untouched legacy archive and rollback source. `gestschool_v2BD` is the clean final PostgreSQL database prepared for GestSchool_V2.

No legacy data is bulk-imported into V2. Future reprise must be selective, scripted, and validated per batch.

## Legacy backup

PostgreSQL client tools were made available through portable EDB PostgreSQL 17.9 binaries stored under `.tools/postgresql-17.9`.

External backup command shape:

```powershell
$env:PGPASSWORD="<legacy-db-password>"
.\.tools\postgresql-17.9\pgsql\bin\pg_dump.exe -h localhost -p 5432 -U gestschool -d gestschool -F c -b -v -f .\backups\legacy-gestschool-20260417-001107\gestschool.dump
Remove-Item Env:\PGPASSWORD
```

Verification command:

```powershell
.\.tools\postgresql-17.9\pgsql\bin\pg_restore.exe --list .\backups\legacy-gestschool-20260417-001107\gestschool.dump
```

Verified dump:

- path: `backups/legacy-gestschool-20260417-001107/gestschool.dump`
- size: 91,998 bytes
- source database: `gestschool`
- source server: PostgreSQL 16.13
- dump client: PostgreSQL 17.9
- archive format: custom, gzip
- TOC entries: 202

## Final database

`gestschool_v2BD` was created with the repository non-destructive database helper:

```powershell
pnpm --filter @gestschool/api db:admin -- --mode=create --database=gestschool_v2BD
```

Result: `CREATED`.

## Final environment variables

Use these values for staging/production shape, replacing secrets with real secret-manager values:

```env
DATABASE_URL=postgresql://gestschool:<secret>@localhost:5432/gestschool_v2BD
DIRECT_URL=postgresql://gestschool:<secret>@localhost:5432/gestschool_v2BD
DEV_BOOTSTRAP_USERS_ON_START=false
DEV_BOOTSTRAP_PORTAL_USERS=false
TIMETABLE_REQUIRE_CANONICAL_REFS=true
ADMIN_USERNAME=admin@gestschool.local
SCOLARITE_USERNAME=scolarite@gestschool.local
COMPTABLE_USERNAME=comptable@gestschool.local
NOTIFICATIONS_WORKER_ENABLED=true
```

Initial passwords were generated locally and must be moved to a password vault, then removed from the filesystem.

## Migrations

All 23 Prisma migrations were applied successfully to `gestschool_v2BD` with `pnpm --filter @gestschool/api db:migrate:deploy`.

Validation after migration:

- `pnpm --filter @gestschool/api db:generate`: passed
- `pnpm --filter @gestschool/api db:migrate:deploy`: passed, no pending migration
- `pnpm --filter @gestschool/api db:status`: passed, database schema is up to date

## Seed

Minimal seed was executed with:

```powershell
pnpm --filter @gestschool/api db:seed:minimal
```

Seed guardrails:

- only staff accounts are created: admin, scolarite, comptable;
- no teacher, parent, or student portal demo account is created;
- `mustChangePasswordAtFirstLogin=true`;
- strong generated passwords are injected through environment variables, not source code.

Final seed verification:

- users: 3
- active staff accounts: admin, scolarite, comptable
- teacher portal accounts: 0
- parent portal accounts: 0
- student portal accounts: 0
- orphan portal accounts: 0

## Timetable target state

`TIMETABLE_REQUIRE_CANONICAL_REFS=true` is the final V2 default. Timetable writes must provide canonical references:

- `roomId`
- `teacherAssignmentId`

Legacy `room` and `teacherName` fields are transitional compatibility only and are not the nominal source of truth.

E2E tests now run with `TIMETABLE_REQUIRE_CANONICAL_REFS=true`. Historical timetable test cases were updated to create/use a real `Room` and `TeacherAssignment` instead of `room` / `teacherName` text-only writes.

Final timetable dry-run result:

- scanned slots: 0
- rows planned for update: 0
- unresolved rooms: 0
- unresolved teachers: 0

## Validation results

Commands executed successfully against `gestschool_v2BD`:

- `pnpm --filter @gestschool/api db:generate`
- `pnpm --filter @gestschool/api db:migrate:deploy`
- `pnpm --filter @gestschool/api db:status`
- `pnpm --filter @gestschool/api db:seed:minimal`
- `pnpm --filter @gestschool/api audit:precutover`
- `pnpm --filter @gestschool/api audit:legacy`
- `pnpm --filter @gestschool/api migrate:timetable:dry-run`
- `pnpm --filter @gestschool/api build`
- `pnpm --filter @gestschool/web-admin build`
- `pnpm --filter @gestschool/api test:e2e`

E2E result:

- test suites: 1 passed
- tests: 27 passed / 27
- canonical timetable mode: enabled

Web build note:

- build passed;
- Vite still warns that the main JS chunk is larger than 500 kB.

## Deployment status

Local build artifacts are validated, but deployment was not executed from this workstation because Render and Vercel CLIs are not installed/authenticated here.

`render.yaml` now explicitly sets final production guardrails for API and worker:

- `DEV_BOOTSTRAP_USERS_ON_START=false`
- `DEV_BOOTSTRAP_PORTAL_USERS=false`
- `TIMETABLE_REQUIRE_CANONICAL_REFS=true`

The actual Render/Vercel deployment must be triggered from the authenticated deployment environment after setting `DATABASE_URL` and `DIRECT_URL` to `gestschool_v2BD`.

## Rollback preservation

The following databases must remain untouched during the rollback window:

- `gestschool`
- `gestschool_legacy_backup_20260416212622`

## Legacy reprise policy

Do not bulk-import legacy data. If reprise is approved later, recommended order:

1. academic references;
2. students;
3. parents;
4. parent-student links;
5. teachers;
6. rooms;
7. assignments;
8. bi-cursus placements;
9. timetable slots with canonical references.
