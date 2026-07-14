# Backend Runtime Safety

## Production secret policy

As of this consolidation pass, `JWT_SECRET` is mandatory when `NODE_ENV=production`.
The API now fails fast during boot if the secret is missing.

### Effective behavior

- `production`:
  - `JWT_SECRET` is required
  - boot fails immediately if absent
  - no silent fallback is tolerated
- non-production:
  - a development-only fallback remains available to keep local bootstrap simple
  - this fallback must never be relied on for staging or production

### Centralized source of truth

JWT runtime resolution is now centralized in:
- `Backend/api/src/security/jwt-config.util.ts`

Consumers aligned on the same runtime rules:
- `token.module.ts`
- `jwt-auth.guard.ts`
- `auth.service.ts` password reset secret fallback path

## Access-token session policy

Each access token now carries a `sid` matching the primary key of its persisted
refresh-token session. For every protected request, the authentication guard
performs one database query that verifies together:

- the current user still exists and belongs to the token tenant;
- `status=ACTIVE`, `is_active=true`, and `deleted_at IS NULL`;
- the session exists, belongs to the same user and tenant, is not revoked, and
  has not expired.

Logout, logout-all, password changes, administrative password resets, account
deactivation, archival, and soft deletion revoke the corresponding persisted
sessions. Revocation therefore invalidates both the refresh token and associated
access token on the next protected request. Access tokens issued before this
policy do not contain `sid` and are rejected; users must authenticate again after
deployment.

The added query is intentionally not cached because immediate revocation is the
security requirement. On the disposable PostgreSQL test database, the equivalent
query measured 0.069 ms execution time (1.926 ms planning time) on an empty test
dataset. Both lookup identifiers are primary keys. Production latency and query
volume must still be observed after deployment.

There is currently no canonical `Tenant` model/table with an active or suspended
state. The guard can prove tenant consistency between token, user, and session,
but cannot validate a tenant lifecycle state that does not exist in the schema.

## E2E database safety policy

Backend e2e tests now require:
- `TEST_DATABASE_URL`
- optionally `TEST_DIRECT_URL`

Safety rules:
- tests refuse to start without `TEST_DATABASE_URL`
- test database URLs must look explicitly disposable (`test`, `e2e`, `jest`, or localhost)
- package scripts route e2e execution through `Backend/api/scripts/with-test-database.cjs`
- destructive cleanup must never rely on the operator's ambient `DATABASE_URL`

### Scripts

- `pnpm --filter @gestschool/api test:e2e`
- `pnpm --filter @gestschool/api test:e2e:db`
- `pnpm --filter @gestschool/api test:e2e:db:fresh`

All three now inject `DATABASE_URL` from `TEST_DATABASE_URL` through the wrapper script.
## CI alignment

The GitHub Actions workflow must expose both the normal Prisma URLs and the disposable e2e URLs:

- `DATABASE_URL`
- `DIRECT_URL`
- `TEST_DATABASE_URL`
- `TEST_DIRECT_URL`

`DATABASE_URL` is used by Prisma tooling. `TEST_DATABASE_URL` is consumed by `with-test-database.cjs` before e2e execution and is injected back as `DATABASE_URL` only inside the guarded child process.

A CI workflow that calls `test:e2e`, `test:e2e:db` or `test:e2e:db:fresh` without `TEST_DATABASE_URL` is intentionally broken and must be fixed, not bypassed.

## Frontend API URL policy

The frontend must not depend on a hardcoded production API rewrite in Vercel. Each Vercel environment must set:

```text
VITE_API_BASE_URL=https://<target-api>/api/v1
```

This keeps preview, staging and production independently switchable without editing source control.
