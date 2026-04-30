# Prisma Legacy Compatibility Inventory

This document records the legacy compatibility that is still tolerated in GestSchool_V2.
Nothing listed here should be removed blindly.
The current policy is to contain, document, and phase out safely.

## Transitional data still tolerated

### Enrollment / placement compatibility

The source of truth is progressively shifting to `StudentTrackPlacement`, but several compatibility links remain active:

- `StudentTrackPlacement.legacyEnrollmentId`
- `Enrollment.placement` through the `LegacyEnrollmentPlacement` relation
- `GradeEntry.placementId`
- `ReportCard.placementId`
- `ReportCard.secondaryPlacementId`
- `Attendance.placementId`
- finance flows still resolve placement-aware billing contexts

Important correction:

- The current Prisma schema does not expose an `Enrollment.trackPlacementId` scalar field.
- The compatibility bridge is held from `StudentTrackPlacement.legacyEnrollmentId` to `Enrollment`.
- New code must not introduce a fresh enrollment-to-placement scalar without a dedicated migration decision.

### Timetable canonical references

Canonical refs are now the target model:
- `TimetableSlot.teacherAssignmentId`
- `TimetableSlot.roomId`

Legacy fallback text fields are still tolerated for compatibility and migration safety:
- `TimetableSlot.teacherName`
- `TimetableSlot.room`

Current rule:
- new writes should prefer canonical refs
- text fallback remains tolerated only where migration or historical compatibility still requires it
- backend e2e forces `TIMETABLE_REQUIRE_CANONICAL_REFS=true` so new tests cannot silently rely on text-only slots

### Classroom compatibility fields

`Classroom` still carries descriptive compatibility fields that are not part of the ideal long-term normalized model:
- `homeroomTeacherName`
- `mainRoom`
- `filiere`
- `series`
- `speciality`
- `teachingMode`

These fields remain tolerated because they still support historical payloads and transitional UX/API expectations.

## Safe deprecation strategy

### Phase 1
- keep reads backward-compatible
- constrain new writes toward canonical relations
- keep explicit documentation of transitional fields

### Phase 2
- instrument where legacy fields are still populated in production data
- add migration scripts per field family when usage is understood
- stop creating new legacy-only values in services/controllers

### Phase 3
- remove dead read paths only after data confirms zero operational dependency
- ship schema cleanup in isolated migrations, never mixed with large feature refactors

## What must not happen

- no bulk destructive cleanup on production data
- no schema field removal without production usage inventory
- no assumption that `Enrollment` compatibility is fully dead
- no assumption that timetable text fallback can disappear before data/backfill verification
