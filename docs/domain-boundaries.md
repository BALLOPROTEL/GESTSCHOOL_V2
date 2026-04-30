# Domain boundaries and current source of truth

This document records the current product boundaries that must stay clear before the next major phase. It is a governance document, not a new architecture layer.

For the operational source-of-truth matrix and stabilization checklist, see `docs/stabilisation-governance.md`.

## Double cursus francophone / arabophone

Source of truth:

- Prisma enum `AcademicTrack`
- `StudentTrackPlacement`
- `PedagogicalRule`
- track-aware class, level, timetable, grades and report-card flows

Current rule:

- `StudentTrackPlacement` is the strategic source of truth for a student's academic track placement.
- `Enrollment` remains a compatibility and administrative workflow object.
- Historical data may still default to `FRANCOPHONE` until explicitly migrated and validated.

Do not remove legacy compatibility fields until the migration has been audited and signed off.

## Finance vs payments

Source of truth today:

- `FinanceService` still owns fee plans, invoices, payments and recovery dashboard.
- `PaymentsController` is a route boundary, not yet a true service boundary.

Decision:

- Keep payment provider integration out of this phase.
- When a real provider is chosen, create a dedicated payment application service and webhook boundary instead of expanding `FinanceService` again.

## Reference vs academic structure

Source of truth today:

- `reference` exposes CRUD/catalog resources: school years, cycles, levels, classes, subjects, periods.
- `academic-structure` owns cross-domain academic rules: placements, track hierarchy, pedagogical rules and timetable validation.

Decision:

- Keep `academic-structure` internal to the backend for now.
- Continue reducing it as a hotspot, but do not expose it as a separate service or microservice yet.

## Enrollments / placements / tracks

Source of truth today:

- Enrollment is still needed for administrative registration workflows.
- Placement is the track-aware academic truth.

Decision:

- New cross-cursus logic should prefer placements.
- Enrollment compatibility must remain documented until all downstream flows are placement-aware.
- New tests and new write paths must prove that `StudentTrackPlacement` remains canonical and that `Enrollment` is only a compatibility/admin mirror.

## Notifications

Source of truth today:

- Generic notification persistence and dispatch live in `notifications`.
- School-life creates or consumes notifications for attendance/timetable-related workflows.
- Outbox and worker infrastructure remain backend-internal.

Decision:

- Keep generic notification mechanics separate from domain-specific reasons for sending notifications.
- Do not integrate Brevo or another provider until templates, consent, retries and delivery audit requirements are documented.

## Portals

Source of truth today:

- Teacher portal is real.
- Parent portal is real.
- Student portal is a placeholder.

Decision:

- Do not launch student portal as a product before access rules, data scope and UX are specified.
- Parent and teacher portals should remain scoped views over existing school data, not separate data sources.

## Mobile

Source of truth today:

- `Frontend/mobile` is only a product placeholder.

Decision:

- Do not start mobile until web, API, CI and domain boundaries are stable enough to support a second client.
