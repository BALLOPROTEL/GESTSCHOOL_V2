# Lot 0 - Source Of Truth Stabilization

## Goal

Lot 0 freezes the source-of-truth decisions before new business features are added. It stabilizes portal reads, removes the most dangerous IAM legacy routes, keeps compatibility fields where needed, and prepares an inventory script so the next lot can migrate safely.

## Source-of-truth decisions

| Area | Legacy surface | Target source of truth | Lot 0 decision |
| --- | --- | --- | --- |
| Teacher portal assignment | `TeacherClassAssignment` through `/users/teacher-assignments` | `Teacher` + `TeacherAssignment` | Portal reads now use `TeacherAssignment` through `Teacher.userId`. IAM legacy routes are removed. `TeacherClassAssignment` remains only as migration inventory data. |
| Parent-child portal link | `ParentStudentLink.parentUserId` through `/users/parent-links` | `Parent.userId` + `ParentStudentLink.parentId` | Parent portal first resolves `Parent.userId`, then reads links by `parentId`. IAM legacy routes are removed. `parentUserId` stays as a temporary compatibility bridge only. |
| Academic placement | `Enrollment` | `StudentTrackPlacement` | Keep sync compatibility, but new business rules must read/write through track placements where possible. |
| Timetable room | `TimetableSlot.room` text | `Room` + `TimetableSlot.roomId` | New writes can use `roomId`; the text field remains a compatibility display fallback until all legacy values are mapped. |
| Timetable teacher | `TimetableSlot.teacherName` text | `TeacherAssignment` + `TimetableSlot.teacherAssignmentId` | New writes can use `teacherAssignmentId`; the text field remains a compatibility display fallback until all legacy values are mapped. |
| Class main room | `Classroom.mainRoom` text | `RoomAssignment` or future main-room relation | Keep text field until the target relation is implemented and backfilled. |
| Messaging | Static UI in web admin | Dedicated messaging backend/DB, not implemented yet | Mark as UI-only/guarded. Do not present it as persisted messaging. |
| Student portal | placeholder web screen | Real student portal backend contract | Mark as non-finalized until the data contract and access rules are implemented. |
| Preview mode | `__preview__` local data | Real API data | Always show that data is local demo and not persisted. |

## Legacy endpoints status

| Endpoint | Lot 0 status | Replacement |
| --- | --- | --- |
| `GET /api/v1/users/teacher-assignments` | Removed from controller. Regression test expects `404`. | `GET /api/v1/teachers/assignments` and teacher portal reads from `TeacherAssignment`. |
| `POST /api/v1/users/teacher-assignments` | Removed from controller. | `POST /api/v1/teachers/assignments`. |
| `DELETE /api/v1/users/teacher-assignments/:id` | Removed from controller. | `DELETE /api/v1/teachers/assignments/:id`. |
| `GET /api/v1/users/parent-links` | Removed from controller. Regression test expects `404`. | `GET /api/v1/parents/links`. |
| `POST /api/v1/users/parent-links` | Removed from controller. | `POST /api/v1/parents/links`. |
| `DELETE /api/v1/users/parent-links/:id` | Removed from controller. | `DELETE /api/v1/parents/links/:id`. |
| `GET /api/v1/enrollments` | Legacy enrollment list, synchronized with placements | Move business reads toward `GET /api/v1/enrollments/placements`. |
| `POST /api/v1/enrollments` | Legacy enrollment create, syncs placement | Keep only as compatibility if the placement workflow fully replaces it. |
| `DELETE /api/v1/enrollments/:id` | Legacy enrollment delete, syncs placement deletion | Keep until all UI uses placement-first flows. |

## Data inventory command

Run this before any migration:

```powershell
pnpm --filter @gestschool/api audit:legacy
```

Check migration state on the same database:

```powershell
pnpm --filter @gestschool/api db:status
```

The command counts:

- `TeacherClassAssignment` vs `TeacherAssignment`
- teacher portal links that can be migrated because a `Teacher.userId` exists
- `ParentStudentLink` rows
- orphan `TEACHER`, `PARENT`, and `STUDENT` accounts without their linked business profile
- `ParentStudentLink` rows without `parentId`
- `Enrollment` vs `StudentTrackPlacement`
- enrollments without placements
- `TimetableSlot.roomId` and `TimetableSlot.teacherAssignmentId` migration coverage
- `TimetableSlot.room` text values and their possible `Room` match
- `Classroom.mainRoom` text values and their possible `Room` match

If the command fails with `Can't reach database server at localhost:5432`, the code inventory is ready but the data counts must be rerun against local/staging PostgreSQL before any destructive migration.

## Double-curriculum guardrails

- A student academic position must be interpreted through `StudentTrackPlacement`.
- A teacher skill/assignment must keep the `FRANCOPHONE` or `ARABOPHONE` track.
- A room dedicated to one track must not be assigned to the other track unless the room is explicitly shared.
- A timetable slot must keep a track coherent with the selected class/level.
- Report cards and finance must keep using the primary/secondary placement strategy.
- Parent views must show the child track context and must never infer a single-curriculum path by default.

## Timetable guardrails

- `TimetableSlot.roomId` is the target field for room identity.
- `TimetableSlot.teacherAssignmentId` is the target field for the teacher/class/subject/year/track link.
- `room` and `teacherName` are compatibility display fields only.
- The form should offer rooms from the `Rooms` module and teachers from `TeacherAssignment`, filtered by class and subject.
- Migration backfill is conservative: it only links text fields when a unique `Room` or `TeacherAssignment` match can be inferred.

## UI guardrails

- The IAM screen must call legacy portal links by their real role: portal compatibility, not pedagogical truth.
- Messaging must clearly state that it is UI-only and not persisted.
- Student portal must clearly state that it is not a completed production portal yet.
- Preview mode must explicitly state that data is demo/local and not saved to the backend.

## Exit criteria

- The inventory script is available and must run against a local or staging database before destructive migration.
- The removed legacy IAM endpoints are covered by a regression test expecting `404`.
- Preview and messaging no longer look like persisted production features.
- Student portal no longer looks finalized.
- The next migration lot can start with measured counts instead of assumptions.
