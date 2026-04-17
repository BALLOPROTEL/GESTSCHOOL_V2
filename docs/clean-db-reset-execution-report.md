# Clean DB reset execution report

Generated on 2026-04-16.

## Decision executed

The legacy `gestschool` database was not mutated, dropped, truncated, or migrated in place. It is now treated as archive/source history.

A new PostgreSQL database was created and initialized for GestSchool_V2:

- legacy database: `gestschool`
- server-side legacy backup clone: `gestschool_legacy_backup_20260416212622`
- abandoned failed fresh attempt: `gestschool_v2_clean_20260416212622`
- validated fresh V2 database: `gestschool_v2_clean_20260416212817`

`pg_dump` / `pg_restore` were not initially available in PATH, so the first executed backup was a PostgreSQL server-side clone. The final cutover preparation now uses portable PostgreSQL 17.9 binaries under `.tools/` to create a verified external `pg_dump`.

## Migration correction

The migration `20260409153000_reference_form_model_alignment` failed on a fresh PostgreSQL database because it used an invalid `UPDATE ... FROM LATERAL` reference to the update target alias.

The migration was corrected to use a scalar subquery for `cycles.school_year_id`. After this correction, all 23 Prisma migrations applied successfully on `gestschool_v2_clean_20260416212817`.

## Migrations applied

All migrations in `apps/api/prisma/migrations` were applied successfully to the validated V2 database:

- `20260217121000_init_students`
- `20260217193000_auth_users_refresh_tokens`
- `20260218024500_reference_enrollments_init`
- `20260218133000_accounting_grades_report_cards`
- `20260218195000_sprint5_school_life`
- `20260218221500_sprint61_attendance_justification`
- `20260224150000_sprint71_iam_permissions`
- `20260224170000_sprint72_portals`
- `20260224200000_sprint81_mosque_module`
- `20260225100000_sprint9_notifications_gateway`
- `20260308183000_currency_cfa_alignment`
- `20260328194500_outbox_events`
- `20260330113000_notifications_extraction_prep`
- `20260406120000_franco_arabic_tracks`
- `20260407113000_reporting_billing_hierarchy`
- `20260408094500_supabase_public_rls_hardening`
- `20260409153000_reference_form_model_alignment`
- `20260411103000_teachers_module`
- `20260411124500_teacher_tracks`
- `20260411131500_rooms_module`
- `20260411170000_students_parents_module`
- `20260412103000_iam_account_type_links`
- `20260412160000_p0_source_of_truth_stabilization`

## Seed executed

Command executed:

```powershell
pnpm --filter @gestschool/api db:seed:minimal
```

Final seed volumes:

- users: 3
- schoolYears: 1
- cycles: 2
- levels: 4
- periods: 3
- subjects: 4
- roomTypes: 3
- teachers: 0
- parents: 0
- students: 0

The seed intentionally creates only staff accounts and stable starter references. It does not create portal teacher/parent/student accounts, avoiding orphan accounts.

## Validation results

Commands passed:

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

Audit status:

- pre-cutover compatibility: `READY_CANDIDATE`
- orphan teacher accounts: 0
- orphan parent accounts: 0
- orphan student accounts: 0
- `TeacherClassAssignment`: 0
- parent links without `parentId`: 0
- timetable slots requiring backfill: 0

E2E status:

- 27 tests passed.
- 0 tests failed.

## Timetable status

The validated fresh database contains no timetable rows yet, so there are no legacy `room` / `teacherName` rows to backfill.

The schema is ready for:

- `TimetableSlot.roomId`
- `TimetableSlot.teacherAssignmentId`

`TIMETABLE_REQUIRE_CANONICAL_REFS` is now the final target default for V2 staging/production and should remain `true`. Legacy timetable text fields are transitional compatibility only, not the nominal write path.

## Remaining recommendations before final cutover

1. Take an off-server `pg_dump` of the legacy DB before production cutover.
2. Point staging or production env vars to `gestschool_v2_clean_20260416212817`, or create/promote a final `gestschool_v2` database using the same migration + seed sequence.
3. Rotate the seeded admin passwords before real users access the system.
4. Keep the legacy DB and backup clone untouched until V2 is accepted.
5. Import legacy business data only through future selective import scripts, not by reusing the incompatible schema.
