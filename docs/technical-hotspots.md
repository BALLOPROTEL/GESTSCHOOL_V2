# Technical hotspots governance

This document records the remaining technical hotspots after the stabilization pass. It prevents the next phase from treating known dense areas as invisible debt.

## Frontend

### School-life

Current status:

- `school-life-panel.tsx` still owns a dense UI and workflow state.
- API calls have been moved to `features/school-life/services/school-life-service.ts`.
- Remaining work is UI decomposition by attendance, timetable and notifications sections.

Next safe steps:

1. Extract attendance section components and form models.
2. Extract timetable section components and derived selectors.
3. Extract notifications section components.
4. Add targeted React tests for one attendance action and one timetable filter.

### App shell API coupling

Current status:

- API base URL resolution now lives in `shared/services/api-config.ts`.
- The resilient auth hook still owns the authenticated request function.
- Several features still receive `api` as a dependency from the shell.

Next safe step:

- Keep dependency injection for tests, but centralize shared request types and error parsing so feature services stop depending on shell-specific shapes.

## Backend

### Academic structure

Current status:

- `AcademicStructureService` is still central, but pedagogical rule validation has been extracted to `AcademicStructureRuleValidator`.
- The service remains the internal source of truth for placements, hierarchy and timetable rule checks.

Next safe steps:

1. Split track placement mutations from query/view helpers.
2. Split pedagogical rule CRUD from placement hierarchy.
3. Keep the module internal until the domain stabilizes further.

### Notifications

Current status:

- Notification request bus, processor and gateway are separated.
- `NotificationsService` remains dense because it still owns creation, listing, dispatch, callbacks and status updates.

Next safe steps:

1. Extract dispatch lifecycle to a dedicated service.
2. Extract target-address resolution to a dedicated resolver.
3. Keep provider-specific integrations out until templates and consent rules are documented.

### Finance / payments

Current status:

- `FinanceService` owns fee plans, invoices, payments and recovery.
- `PaymentsController` is only a route boundary; it is not yet a true domain service.

Next safe steps:

1. Extract invoice lifecycle.
2. Extract payment recording and receipt generation.
3. Introduce a provider-facing payment service only when the provider integration starts.

### Users / parents / analytics

Current status:

- These services are functional but still dense.
- They should be reduced incrementally after the CI/tests/docs baseline is stable.

Next safe steps:

- Users: split identity linking and permission updates.
- Parents: split parent directory from parent-child relation management.
- Analytics: split reporting aggregation from audit-log access.
