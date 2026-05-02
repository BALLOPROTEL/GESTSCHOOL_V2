# Stabilisation Governance

This phase stabilizes existing modules and prepares real providers. It does not open the student portal, mobile app or microservices split.

## Immediate Scope

In scope:
- enrollment flow stays aligned with `StudentTrackPlacement`
- finance distinguishes internal invoices/payments from provider attempts
- parent and teacher portals stay scoped by existing access links and assignments
- Supabase Storage provider is available for durable documents
- Brevo provider is available for transactional email and SMS dry-run
- PayDunya is available in sandbox only
- runbooks document activation and rollback
- Render free runs a single API service with optional in-process outbox processing

Out of scope:
- student portal implementation
- mobile implementation
- production payment activation
- production SMS mass sending
- microservices extraction

## Source-of-Truth Rules

Academic:
- `StudentTrackPlacement` remains canonical.
- Enrollment remains compatibility/admin trace only until explicitly retired.
- New academic flows must not use Enrollment as academic truth.

Finance:
- `Invoice` is internal billing truth.
- `Payment` is internal accounting truth.
- `PaymentProviderAttempt` is provider attempt/audit truth.
- Frontend return URLs are not proof of payment.

Portals:
- Parent access must go through `Parent.userId -> ParentStudentLink.parentId`.
- Teacher access must go through `Teacher.userId -> TeacherAssignment`.

Storage:
- Supabase private buckets are the durable target.
- Local storage is dev/test fallback only.

Notifications:
- Mock stays default for dev/test.
- Brevo email can be enabled in staging.
- Brevo SMS stays dry-run unless explicitly approved.
- On Render free, `OUTBOX_IN_PROCESS_ENABLED=true` is the supported small-load mode.
- A separate worker is a future scaling path, not a current requirement.

Render free:
- API must boot with `NOTIFICATIONS_WORKER_ENABLED=false`.
- `OUTBOX_IN_PROCESS_ENABLED=true` processes audit, notification request and notification dispatch work in bounded batches.
- Recommended values: `OUTBOX_POLL_INTERVAL_MS=30000`, `OUTBOX_BATCH_SIZE=10`.
- This mode is not a replacement for a dedicated worker under higher load.

## Future Student Portal Prerequisites

Before implementing the student portal:
- stable student IAM and login lifecycle
- confirmed list of student-visible data
- scoped timetable, grades, absences, report cards and documents
- notification rules for student accounts
- portal-specific e2e tests

## Future Integrations

Before production activation:
- PayDunya production credentials and IPN validation rehearsal
- SMS sender registration and legal/opt-out review
- email domain authentication
- backup and restore rehearsal for documents
- reporting/audit model review

## Release Gate

Do not enable provider staging unless:
- backend lint/build/e2e pass
- frontend lint/test/smoke/build pass if frontend changed
- provider tests pass with mocked network
- runbooks are up to date
- no secret is exposed in frontend env or API responses
- `GET /api/v1/monitoring/providers` confirms provider config booleans with `x-metrics-token`
