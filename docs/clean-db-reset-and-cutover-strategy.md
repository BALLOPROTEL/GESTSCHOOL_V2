# Clean PostgreSQL reset and GestSchool_V2 cutover strategy

## Decision

The configured PostgreSQL database is not cleanly compatible with the current GestSchool_V2 Prisma schema. It has an older migration history, missing V2 tables/columns, and one database migration that is not present locally: `20260313223000_documents_workspace`.

The safest path is therefore not an in-place repair of the legacy database. The recommended strategy is:

1. back up the legacy database;
2. freeze or switch the legacy app to read-only during final cutover;
3. create a new empty PostgreSQL database for GestSchool_V2;
4. apply only the current GestSchool_V2 Prisma migrations;
5. seed only the minimum access accounts;
6. validate schema, builds, e2e and audit scripts;
7. migrate business data later through explicit import scripts, not by mutating legacy tables in place.

## Non-negotiable guardrails

- Do not drop the legacy database until a verified backup restore has been tested.
- Do not run `prisma migrate reset` against the legacy or production database.
- Do not use `infra/migrations/V1__init.sql` or `infra/scripts/seed.sql` for the fresh V2 database. The Prisma migration chain is the schema source of truth.
- Do not enable portal demo users unless matching `Teacher`, `Parent`, and `Student` profiles are created. Keep `DEV_BOOTSTRAP_PORTAL_USERS=false`.
- Keep `TIMETABLE_REQUIRE_CANONICAL_REFS=true` for staging/production V2. Legacy timetable text fallbacks are tolerated only as transitional read/backfill aids, not as the target write model.

## Phase 1 - Backup and evidence

Install PostgreSQL client tools if `pg_dump`, `pg_restore`, `psql`, and `createdb` are not available.

Create a timestamped backup directory:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path ".\backups\$stamp"
```

Capture the legacy migration state:

```powershell
pnpm --filter @gestschool/api db:status *> ".\backups\$stamp\gestschool_v2_db_status.txt"
pnpm --filter @gestschool/api audit:precutover -- --out="backups/$stamp/precutover-audit-before-reset.json"
```

Back up the legacy database:

```powershell
pg_dump --format=custom --verbose --file ".\backups\$stamp\gestschool_legacy.dump" "postgresql://gestschool:gestschool@localhost:5432/gestschool"
pg_dump --schema-only --file ".\backups\$stamp\gestschool_legacy_schema.sql" "postgresql://gestschool:gestschool@localhost:5432/gestschool"
pg_dump --data-only --file ".\backups\$stamp\gestschool_legacy_data.sql" "postgresql://gestschool:gestschool@localhost:5432/gestschool"
```

Validate that the backup is readable:

```powershell
pg_restore --list ".\backups\$stamp\gestschool_legacy.dump" | Select-Object -First 40
```

## Phase 2 - Restore test

Before touching the active database, prove the backup can be restored:

```powershell
createdb "postgresql://gestschool:gestschool@localhost:5432/gestschool_legacy_restore_check"
pg_restore --clean --if-exists --no-owner --dbname "postgresql://gestschool:gestschool@localhost:5432/gestschool_legacy_restore_check" ".\backups\$stamp\gestschool_legacy.dump"
```

If this restore fails, stop. Do not reset anything.

If `pg_dump` / `pg_restore` are not available locally, a weaker server-side safety clone can be created with the repository helper. This is not a replacement for an off-server dump, but it prevents moving forward without at least one database-level copy:

```powershell
$backupDb = "gestschool_legacy_backup_$stamp".ToLower().Replace("-", "_")
pnpm --filter @gestschool/api db:admin -- --mode=clone --source=gestschool --database=$backupDb
```

## Phase 3 - Create the fresh GestSchool_V2 database

Preferred approach: create a new database instead of dropping the old one.

```powershell
createdb "postgresql://gestschool:gestschool@localhost:5432/gestschool_v2"
```

If `createdb` is not available, use the repository helper:

```powershell
pnpm --filter @gestschool/api db:admin -- --mode=create --database=gestschool_v2
```

Point the current terminal to the fresh DB:

```powershell
$env:DATABASE_URL="postgresql://gestschool:gestschool@localhost:5432/gestschool_v2"
$env:DIRECT_URL="postgresql://gestschool:gestschool@localhost:5432/gestschool_v2"
$env:DEV_BOOTSTRAP_USERS_ON_START="false"
$env:DEV_BOOTSTRAP_PORTAL_USERS="false"
$env:TIMETABLE_REQUIRE_CANONICAL_REFS="true"
```

Apply the V2 schema:

```powershell
pnpm --filter @gestschool/api db:generate
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api db:status
```

Expected result:

- all migrations in `apps/api/prisma/migrations` are applied;
- no database-only migration remains;
- schema preflight no longer reports missing tables/columns.

## Phase 4 - Minimal seed

Seed minimal V2 baseline:

```powershell
pnpm --filter @gestschool/api db:seed:minimal
```

Default seed scope:

- `ADMIN`
- `SCOLARITE`
- `COMPTABLE`
- one active school year;
- primary and secondary cycles;
- one francophone and one arabophone starter level per cycle family;
- three academic periods;
- stable starter subjects: `FR`, `MATH`, `AR`, `EDI`;
- starter room types for the Salles module.

Do not seed `TEACHER` or `PARENT` portal accounts on a fresh production-like database unless their business profiles already exist. This avoids orphan accounts by design.

If production credentials are used, set secure values before seeding:

```powershell
$env:ADMIN_USERNAME="admin@example.com"
$env:ADMIN_PASSWORD="<strong-temporary-password>"
$env:SCOLARITE_USERNAME="scolarite@example.com"
$env:SCOLARITE_PASSWORD="<strong-temporary-password>"
$env:COMPTABLE_USERNAME="comptable@example.com"
$env:COMPTABLE_PASSWORD="<strong-temporary-password>"
```

After first login, rotate passwords and disable temporary values from shell history if needed.

## Phase 5 - Validation

Run schema and data audits:

```powershell
pnpm --filter @gestschool/api audit:precutover -- --out="reports/fresh-db-precutover-audit.json"
pnpm --filter @gestschool/api audit:legacy
pnpm --filter @gestschool/api migrate:timetable:dry-run
```

Expected for a fresh DB:

- no schema incompatibility;
- no orphan `TEACHER`, `PARENT`, or `STUDENT` accounts;
- no `TeacherClassAssignment` rows;
- no legacy-only parent links;
- no timetable rows requiring backfill.

Run build and tests:

```powershell
pnpm --filter @gestschool/api build
pnpm --filter @gestschool/web-admin build
pnpm --filter @gestschool/api test:e2e
```

If e2e creates test data, run it only against this fresh/staging DB, not the legacy DB.

## Phase 6 - Cutover plan

### Dry run cutover

1. Create `gestschool_v2`.
2. Apply migrations.
3. Seed staff users.
4. Run audits and e2e.
5. Start API locally or staging with `DATABASE_URL=gestschool_v2`.
6. Login as admin.
7. Verify reference, students, parents, teachers, rooms and timetable screens load.

### Final cutover

1. Announce a maintenance window.
2. Stop legacy writes or put the legacy app in read-only mode.
3. Take a final `pg_dump` of legacy.
4. Create the final fresh V2 DB or promote the validated staging DB.
5. Apply migrations and seed minimal staff accounts.
6. Point API/worker `DATABASE_URL` and `DIRECT_URL` to the V2 DB.
7. Deploy API/worker/web.
8. Verify `/health/live`, `/health/ready`, login, and admin navigation.
9. Keep legacy DB untouched for rollback.

## Rollback plan

Rollback is environment-level, not data-mutation-level:

1. Stop GestSchool_V2 services.
2. Repoint services/DNS to the legacy app and legacy DB.
3. Keep the failed V2 DB for forensic analysis.
4. Do not merge V2 test data back into legacy.

Rollback is possible only if the legacy DB was not dropped or mutated. This is why the preferred strategy creates a new V2 database instead of resetting the legacy database in place.

## Go / no-go checklist

Go only if all are true:

- backup restore was tested successfully;
- fresh V2 DB has a clean `db:status`;
- `audit:precutover` reports no schema incompatibility;
- `db:seed:users` created only intended staff accounts;
- API build passes;
- web build passes;
- e2e passes against the fresh/staging DB;
- admin login works;
- legacy DB remains available for rollback.

No-go if any are true:

- backup restore not tested;
- unknown DB migration still blocks `db:status`;
- schema audit reports missing V2 tables/columns;
- e2e fails for a reason other than intentionally absent test DB;
- portal accounts are created without business profiles;
- someone proposes dropping the only legacy database copy.

## Later data migration

This reset strategy intentionally starts with a clean V2 schema. Importing legacy business data must be a separate, explicit migration lot:

- map legacy students into `Student`;
- map responsible adults into `Parent`;
- create `ParentStudentLink.parentId`;
- map curriculum data into `StudentTrackPlacement`;
- create `Teacher`, `TeacherAssignment`, `Room`, and `TimetableSlot` references;
- run `audit:precutover` after each import batch.

Do not mix clean schema initialization and business data migration in the same uncontrolled operation.
