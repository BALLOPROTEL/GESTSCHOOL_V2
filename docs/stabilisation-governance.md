# Stabilisation governance

Date: 2026-04-25

This document is the local stabilization baseline before the next major product phase. It records the current Git risk, reproducible validation rules, source-of-truth matrix, e2e guardrails, and legacy reprise strategy.

No commit, push, tag, PR, remote publication, destructive migration, mobile launch, microservice split, or new external integration belongs to this phase.

## 1. Git local truth

Current local finding:

- The working tree uses the new layout: `Backend/`, `Frontend/`, `Infrastructure/`, plus governance folders such as `Database/`, `DevOps/`, `Integrations/`, `Notifications/`, `Scalability-and-Performance/`, `Authentication-and-Security/`.
- Git HEAD still tracks the old layout: `apps/`, `infra/`, `assets/`, `imgs/`.
- The new layout is currently untracked.
- The old layout appears as deleted in `git status`.
- A fresh local clone from Git HEAD still receives the old `apps/*` layout and does not receive `Backend/*` or `Frontend/*`.

Risk:

- A clone from the current Git truth does not reproduce the active local project structure.
- CI or deployment behavior depends on whether the new structure is actually staged/committed later.
- The repository is not yet governance-clean, even if the active working directory builds.

Required local stabilization actions before any human-approved commit:

1. Review all intended path moves explicitly.
2. Stage new paths and deleted old paths in the same logical change.
3. Verify `git status` shows intentional renames/moves instead of unexplained delete/add noise where possible.
4. Keep generated outputs and local artifacts out of Git.
5. Re-run validation from a clean checkout after the reorganization is staged.
6. Do not push until a human review confirms the diff.

## 2. Reproducible validation protocol

Safe workspace validation:

```powershell
pnpm install --frozen-lockfile
pnpm --filter @gestschool/api db:generate
pnpm --filter @gestschool/api lint
pnpm --filter @gestschool/api build
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
```

Database validation:

```powershell
pnpm --filter @gestschool/api db:status
```

Run this only against the intended database URL. A local default example URL is not proof of production or staging readiness.

Backend e2e validation:

```powershell
$env:TEST_DATABASE_URL="postgresql://gestschool:gestschool@localhost:5432/gestschool_e2e"
pnpm --filter @gestschool/api test:e2e:db:fresh
```

Rules:

- `TEST_DATABASE_URL` is mandatory.
- The database must be disposable.
- The URL must include `test`, `e2e`, or `jest` in the database name or host.
- A plain localhost database such as `gestschool` is not accepted by the e2e guard.
- Never run e2e against legacy, staging cutover, or production data.

## 3. Source-of-truth matrix

| Domain | Canonical source | Compatibility tolerated | Legacy / dangerous if reused | Guard to apply now |
| --- | --- | --- | --- | --- |
| Student | `Student` | none for identity | archived rows treated as active | always filter `deletedAt: null`; lifecycle changes must be explicit |
| Parent | `Parent` profile | linked `User` via `Parent.userId` | treating `User` alone as parent business object | parent portal must resolve through `Parent` |
| Parent-child link | `ParentStudentLink.parentId` | `parentUserId` bridge copied from `Parent.userId` | new flows creating links only by `parentUserId` | API writes must require `parentId` |
| Enrollment | Administrative `Enrollment` view | synchronized from placement when needed | using `Enrollment` as track source of truth | new double-cursus logic must query placements |
| Academic placement | `StudentTrackPlacement` | `legacyEnrollmentId` mirror | assuming one enrollment equals one academic truth | placement-first reads for grades, portals, timetable context |
| Teacher | `Teacher` profile | linked `User` for portal access | treating staff `User` as teacher profile | portal must resolve through `Teacher.userId` |
| Teacher assignment | `TeacherAssignment` | none for new timetable writes | `TeacherClassAssignment` | new timetable and portal flows use `teacherAssignmentId` |
| Room | `Room` | display label derived from room | `Classroom.mainRoom` as operational room | scheduling uses `roomId` |
| Timetable | `TimetableSlot.roomId` and `teacherAssignmentId` | `room` and `teacherName` for historical display/backfill | creating new text-only slots | e2e sets `TIMETABLE_REQUIRE_CANONICAL_REFS=true` |
| Grades/report cards | `GradeEntry`, `ReportCard`, placement-aware context | legacy class context for display | generating reports without placement context | report logic must resolve placement strategy |
| Finance/payments | `FeePlan`, `Invoice`, `Payment` | `PaymentsController` route boundary | treating current payment flow as provider-ready | no real provider before webhook/audit/accounting rules |
| Parent portal | scoped through `Parent.userId` then `ParentStudentLink.parentId` | `parentUserId` only as bridge | querying children directly by role/user without link | deny access if link is missing |
| Teacher portal | scoped through `Teacher.userId` then `TeacherAssignment` | none for new access | `TeacherClassAssignment` | deny access outside assigned classes/subjects |
| Notifications | `Notification`, delivery attempts, callbacks, outbox | MOCK/WEBHOOK providers | assuming Brevo/SMS production behavior exists | keep provider integration out until templates/consent/retry are specified |

Operational rule:

- New write paths must use canonical IDs.
- Legacy text fields may be read for display or migration diagnostics only.
- Compatibility mirrors may be maintained, but they must not drive new product decisions.

## 4. E2e product flows

Existing transverse e2e coverage:

- auth / access guards;
- academic baseline and enrollments;
- finance, payments, grades, report cards;
- teachers, skills, assignments, documents;
- rooms, assignments, availabilities;
- attendance, timetable conflicts, notifications;
- teacher and parent portal scoping.

Added governance guardrail:

- `source-of-truth.e2e-spec.ts` validates placement-first enrollment behavior, parent portal scoping through `Parent` and `ParentStudentLink`, and strict rejection of legacy-only timetable writes.
- The e2e harness now forces `TIMETABLE_REQUIRE_CANONICAL_REFS=true`.

Remaining e2e gaps:

- full legacy reprise dry-run with realistic data volumes;
- annual promotion / class transfer;
- double-cursus report-card edge cases across primary/secondary hierarchy;
- payment reversal/refund;
- notification provider callbacks beyond mock/webhook mechanics.

## 5. Legacy reprise strategy

Do not confuse:

- schema-ready: migrations apply, tables exist, seed can run;
- business-data-ready: real legacy data has been inventoried, mapped, dry-run migrated, audited, and accepted.

Minimum controlled reprise sequence:

1. Backup legacy database.
2. Restore into a dedicated staging clone.
3. Run `db:status` and `db:migrate:deploy` only on the clone.
4. Run `audit:legacy`.
5. Map legacy entities to canonical V2 targets:
   - students -> `Student`;
   - parents/users -> `Parent`, `User`, `ParentStudentLink`;
   - classes/levels/cycles -> reference hierarchy;
   - enrollments -> `StudentTrackPlacement` first, `Enrollment` mirror second;
   - rooms/teachers timetable text -> `Room` and `TeacherAssignment`;
   - invoices/payments -> finance tables with reconciliation totals.
6. Run timetable backfill dry-run.
7. Review ambiguous rows manually.
8. Run e2e on the staging clone only after migrations and conservative backfills.
9. Produce reconciliation counts.
10. Approve or rollback the staging run before any production operation.

Rollback rule:

- Restore from backup or discard the staging clone.
- Do not attempt partial manual rollback on production data.

## 6. Current blockers before acceleration

- Git reorganization is not yet represented cleanly by tracked files.
- Backend e2e cannot be executed without a real disposable `TEST_DATABASE_URL`.
- Local `db:status` is not a reliable readiness signal while it points to the default example database.
- Legacy reprise is prepared conceptually but not proven with business data.
- Some product surfaces remain placeholders or non-production integrations.
