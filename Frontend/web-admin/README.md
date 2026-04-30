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
- Mosquee module

The student portal is still a placeholder. The mobile app is not implemented here.

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

Local development normally uses the Vite proxy:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Production and staging should set an explicit API URL in Vercel:

```text
VITE_API_BASE_URL=https://<render-api-service>.onrender.com/api/v1
```

The Vercel config no longer hardcodes the Render API URL. The environment decides which API the frontend talks to.

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
