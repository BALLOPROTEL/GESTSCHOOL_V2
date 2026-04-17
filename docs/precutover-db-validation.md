# Pre-cutover DB validation and timetable migration

## Goal

This lot validates GestSchool_V2 on realistic PostgreSQL data before replacing the legacy GESTSCHOOL system. The guiding rule is simple: never run destructive migrations directly on the legacy database. Work on a clone or staging database first, measure the data, then migrate only what can be inferred safely.

## Current local finding

The repository configuration exposes only example connection strings:

- `DATABASE_URL=postgresql://gestschool:gestschool@localhost:5432/gestschool`
- `DIRECT_URL=postgresql://gestschool:gestschool@localhost:5432/gestschool`
- Docker compose declares PostgreSQL 16 on `localhost:5432`.

During this lot, Docker Desktop was not reachable and `psql` / `pg_dump` were not available in `PATH`. Prisma could still reach a PostgreSQL database at `localhost:5432`, but its schema is not yet compatible with the current GestSchool_V2 Prisma schema.

Observed migration status on the configured database:

- last common migration: `20260328194500_outbox_events`;
- local migrations not yet applied: `20260330113000_notifications_extraction_prep`, `20260406120000_franco_arabic_tracks`, `20260407113000_reporting_billing_hierarchy`, `20260408094500_supabase_public_rls_hardening`, `20260409153000_reference_form_model_alignment`, `20260411103000_teachers_module`, `20260411124500_teacher_tracks`, `20260411131500_rooms_module`, `20260411170000_students_parents_module`, `20260412103000_iam_account_type_links`, `20260412160000_p0_source_of_truth_stabilization`;
- database migration missing from the local repo: `20260313223000_documents_workspace`.

This means the connected database must be treated as legacy/incompatible until it is cloned, reconciled and migrated in staging. Do not run e2e or destructive backfills on it directly.

## Safe strategy

Use this sequence before any final cutover:

1. Identify the real legacy GESTSCHOOL database URL.
2. Create a backup with `pg_dump`.
3. Restore it into a dedicated staging database, for example `gestschool_v2_staging`.
4. Point GestSchool_V2 `DATABASE_URL` and `DIRECT_URL` to the staging database only.
5. Run Prisma migrations on staging.
6. Run the read-only DB audit.
7. Run the timetable backfill in dry-run mode.
8. Review ambiguous rows manually.
9. Apply only conservative timetable backfill.
10. Run e2e tests and functional checks.
11. Enable strict timetable canonical refs only after the audit is clean.

Example commands:

```powershell
pg_dump --format=custom --file .\backups\gestschool_legacy.dump "postgresql://gestschool:gestschool@localhost:5432/gestschool"
createdb "postgresql://gestschool:gestschool@localhost:5432/gestschool_v2_staging"
pg_restore --clean --if-exists --no-owner --dbname "postgresql://gestschool:gestschool@localhost:5432/gestschool_v2_staging" .\backups\gestschool_legacy.dump
```

Then set:

```powershell
$env:DATABASE_URL="postgresql://gestschool:gestschool@localhost:5432/gestschool_v2_staging"
$env:DIRECT_URL="postgresql://gestschool:gestschool@localhost:5432/gestschool_v2_staging"
```

## Validation commands

Run these against the staging database:

```powershell
pnpm --filter @gestschool/api db:generate
pnpm --filter @gestschool/api db:status
pnpm --filter @gestschool/api db:migrate:deploy
pnpm --filter @gestschool/api audit:legacy
pnpm --filter @gestschool/api audit:precutover
pnpm --filter @gestschool/api migrate:timetable:dry-run
pnpm --filter @gestschool/api migrate:timetable:apply
pnpm --filter @gestschool/api audit:precutover
pnpm --filter @gestschool/api test:e2e
pnpm --filter @gestschool/api build
pnpm --filter @gestschool/web-admin build
```

The audit can also write a JSON report:

```powershell
pnpm --filter @gestschool/api audit:precutover -- --out=reports/precutover-audit.json
```

With `pnpm --filter`, the output path is relative to `apps/api`, so this example writes to `apps/api/reports/precutover-audit.json`.

## Timetable migration policy

Target source of truth:

- room identity: `TimetableSlot.roomId -> Room`
- teacher identity: `TimetableSlot.teacherAssignmentId -> TeacherAssignment`

Compatibility fields:

- `TimetableSlot.room`
- `TimetableSlot.teacherName`

These compatibility fields are kept only as display and migration fallback fields. They must not remain the source of truth after staging validation.

The backfill script is conservative:

- it links a `roomId` only when the legacy text uniquely matches an active, non-archived room by code or name;
- it links a `teacherAssignmentId` only when the legacy teacher name uniquely matches an active teacher assignment for the same tenant, year, class, subject and track;
- ambiguous or unmatched rows are reported, not guessed.

Strict mode:

```env
TIMETABLE_REQUIRE_CANONICAL_REFS=true
```

Set this only after staging has no critical unresolved timetable rows. With this flag enabled, new timetable writes must provide both `roomId` and `teacherAssignmentId`.

## DB audit coverage

`pnpm --filter @gestschool/api audit:precutover` checks:

- `TEACHER`, `PARENT`, `STUDENT` accounts without linked business profiles;
- `TeacherClassAssignment` rows still present;
- `ParentStudentLink` rows without `parentId`;
- `Enrollment` / `StudentTrackPlacement` drift;
- timetable rows still relying on `room` or `teacherName` text;
- room and teacher assignment backfill candidates;
- classrooms still carrying `mainRoom` text.

## Cutover blockers

Do not cut over while any of these remain unresolved:

- active portal accounts without their `Teacher`, `Parent`, or `Student` profile;
- parent-child links that only use `parentUserId`;
- teacher portal data still depending on `TeacherClassAssignment`;
- timetable rows that cannot be mapped to `roomId` and `teacherAssignmentId`;
- e2e tests not passing against the staging PostgreSQL database;
- Prisma migrations not applied cleanly on the staging clone.
