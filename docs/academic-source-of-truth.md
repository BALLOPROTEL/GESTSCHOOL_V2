# Academic Source Of Truth

## Decision

`StudentTrackPlacement` is the canonical academic source of truth for GestSchool_V2.

It owns the student academic context:

- student
- school year
- track
- level
- classroom when the placement is class-bound
- placement status
- primary/secondary hierarchy for dual-curriculum flows

`Enrollment` is deprecated for academic decisions. It may remain temporarily as
an administrative or legacy compatibility mirror through
`StudentTrackPlacement.legacyEnrollmentId`, but new academic workflows must not
derive class, track or school-year placement from `Enrollment`.

## Domain Rules

### Grades

Grades must be created or updated against `StudentTrackPlacement`.
`GradeEntry.classId` remains a denormalized context field for filters and legacy
reads. The write identity is placement-first:

- tenant
- placement
- subject
- academic period
- assessment label

### Report Cards

Report card generation resolves the student's reportable placements for the
school year and period. Primary dual-curriculum report cards may combine
sections, but each section remains tied to a placement.

`ReportCard.classId` remains contextual. The canonical write identity is:

- tenant
- placement
- academic period

### Attendance

Attendance must resolve the student's placement for the class and school year.
`Attendance.classId` remains contextual. The canonical duplicate guard is:

- tenant
- placement
- attendance date

### Timetable

Timetable slots remain class-level records because rooms and teacher assignments
are scheduled for classes. Student, parent and teacher portals must reach
timetable data through `StudentTrackPlacement` and then class-level slots.

Canonical references for new timetable writes are:

- `TeacherAssignment`
- `Room`
- `Classroom`

Text-only `teacherName` and `room` are legacy fallbacks.

## Guardrails

- Do not introduce a new academic workflow that writes only `Enrollment`.
- Do not use `classId` alone to identify a student's grade, report card or attendance record.
- Do not remove `Enrollment` without a production data inventory and rollback plan.
- When accepting `classId` from API/UI payloads, validate it against the resolved placement.
- For dual-curriculum flows, always resolve primary/secondary placements from `StudentTrackPlacement`.

## Current Enrollment Status

Decision: deprecate.

Reason:

- existing public API and UI still expose `/enrollments`
- existing compatibility mirror still preserves legacy ids
- finance and operational reporting may still depend on historical enrollment rows
- no destructive deletion is justified without a production usage inventory

Target:

- keep `Enrollment` readable only as compatibility
- move all academic decisions to placement-first code
- remove `Enrollment` in a future isolated cleanup only after data confirms it is dead
