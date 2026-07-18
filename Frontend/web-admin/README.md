# Web Admin

React + Vite + TypeScript admin app for GestSchool_V2.

## Current role

The web admin is the primary production UI. It contains the app shell, responsive admin navigation, auth screen and the current school management modules:

- Dashboard
- IAM / users and permissions
- Students
- Parents and parent-child links
- Teachers
- Rooms
- Academic reference
- Enrollments
- Finance and payments views
- Grades and report cards
- School-life: attendance, timetable and notifications
- Reports
- Teacher portal
- Parent portal
- Mosquee module (feature flag)

The student portal, Mosque module, local demo messaging and user billing screen are
still provisional. They are disabled by default outside explicitly configured
development or acceptance environments. The mobile app is not implemented here.

## Structure

```text
src/
  app/        # Shell, navigation, preview/bootstrap and app orchestration
  features/   # Product screens and domain-specific UI/services
  shared/     # Shared components, hooks, services, constants, types, utils
  styles/     # CSS layers
  test/       # Vitest/RTL setup
  main.tsx
```

## Environment

Local development may use the explicit local API URL below or the Vite proxy
`/api/v1`. A remote API is rejected in development so a local preview cannot
silently call production:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Preview, staging and production must set an explicit HTTPS API URL in Vercel:

```text
VITE_API_BASE_URL=https://<render-api-service>.onrender.com/api/v1
```

The build fails when `VITE_API_BASE_URL` is absent, invalid, relative, non-HTTPS
or points to localhost outside development/test. There is no automatic fallback
to Render or another production API.

Provisional modules use typed, opt-in flags. Every flag defaults to `false`:

```text
VITE_FEATURE_STUDENT_PORTAL=false
VITE_FEATURE_MOSQUEE=false
VITE_FEATURE_MESSAGES=false
VITE_FEATURE_USER_BILLING=false
```

Set a flag to the exact value `true` only in a controlled development or
acceptance environment. When disabled, its navigation and actions are hidden and
direct screen access renders a clear unavailable state.

## Run locally

```powershell
Copy-Item Frontend/web-admin/.env.example Frontend/web-admin/.env -Force
pnpm --filter @gestschool/web-admin dev
```

Default URL: `http://localhost:5180`

## Quality commands

```powershell
pnpm --filter @gestschool/web-admin lint
pnpm --filter @gestschool/web-admin test
pnpm --filter @gestschool/web-admin test:smoke
pnpm --filter @gestschool/web-admin build
```

On Windows, if `node_modules` ACLs are corrupted after an interrupted install, rebuild dependencies with:

```powershell
pnpm install --offline
```

## Auth/session behavior

The session is managed through shared session services and the resilient auth hook. The API client attempts refresh on `401`, clears invalid local sessions and tracks API availability so the UI can avoid repeatedly ejecting the user during temporary API outages.
