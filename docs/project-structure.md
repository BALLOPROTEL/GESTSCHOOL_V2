# Project structure

This document records the current GestSchool_V2 repository structure. It is pragmatic on purpose: the project is a modular monolith, not a microservices platform yet.

## Current tree

```text
GestSchool_V2/
  Frontend/
    web-admin/
      src/
        app/                 # Shell, navigation, preview/bootstrap, app orchestration
        features/            # Real product domains and screens
        shared/              # Reusable UI, hooks, services, constants, types, utils
        styles/              # CSS layers split by role
        test/                # Vitest/RTL setup
        App.tsx              # Thin compatibility re-export
        main.tsx
      public/
        favicon.png
        logo.png
      package.json
      vercel.json
    mobile/
      README.md              # Product placeholder only, no mobile app yet
  Backend/
    api/
      src/
        academic-structure/
        analytics/
        audit/
        auth/
        background/
        common/
        database/
        enrollments/
        finance/
        grades/
        health/
        infrastructure/
        mosquee/
        notifications/
        observability/
        outbox/
        parents/
        payments/
        portal/
        reference/
        rooms/
        school-life/
        security/
        storage/
        students/
        teachers/
        users/
        worker.ts
      prisma/
        migrations/
        schema.prisma
        seed-minimal.ts
        seed-users.ts
      scripts/
      test/
      package.json
  Infrastructure/
    docker/
    k8s/
    migrations/
    monitoring/
    scripts/
  Authentication-and-Security/    # Documentation boundary
  Database/                       # Documentation boundary, Prisma remains under Backend/api/prisma
  DevOps/                         # Documentation boundary
  Integrations/                   # Future integration notes, no provider implementation yet
  Notifications/                  # Notification architecture notes, runtime remains in Backend/api
  Scalability-and-Performance/    # Future strategy notes, no microservices yet
  docs/
  backups/
  .github/
  package.json
  pnpm-workspace.yaml
  render.yaml
  vercel.json
```

## Runtime source of truth

| Area | Current source of truth |
| --- | --- |
| Web admin | `Frontend/web-admin` |
| API and worker | `Backend/api` |
| Prisma schema and migrations | `Backend/api/prisma` |
| Render deployment | `render.yaml` |
| Vercel deployment | root `vercel.json` or `Frontend/web-admin/vercel.json` depending on project root |
| Backend e2e safety | `Backend/api/scripts/with-test-database.cjs` |
| Frontend tests | `Frontend/web-admin/src/**/*.test.tsx` |

## Mapping from the old layout

| Previous path | Current path | Notes |
| --- | --- | --- |
| `apps/web-admin` | `Frontend/web-admin` | React/Vite admin frontend. |
| `apps/api` | `Backend/api` | NestJS API and worker runtime. |
| `apps/mobile` | `Frontend/mobile` | Planned boundary only. |
| `infra` | `Infrastructure` | Docker, k8s, monitoring, scripts. |
| `apps/web-admin/src/screens` | `Frontend/web-admin/src/features` | Feature-oriented frontend structure. |
| `apps/web-admin/src/components` | `Frontend/web-admin/src/shared/components` | Shared UI. |
| `apps/web-admin/src/hooks` | `Frontend/web-admin/src/shared/hooks` | Shared hooks. |
| `apps/web-admin/src/services` | `Frontend/web-admin/src/shared/services` | Browser/session/API services. |
| `apps/api/src/mosque` | `Backend/api/src/mosquee` | French domain naming in code/API. Prisma table names remain legacy-safe. |

## Important boundaries

- Prisma stays in `Backend/api/prisma` to avoid breaking CLI commands, Render build, generated client paths and migrations.
- Root folders such as `Authentication-and-Security`, `Database`, `Integrations`, `Notifications` and `Scalability-and-Performance` are governance/documentation boundaries, not executable services.
- The project is not ready for microservices. The next structural work is to keep reducing monolith hotspots inside the current modular monolith.
- The mobile folder is intentionally retained, but it is not an implemented product.

## Current frontend structure

- `src/app`: shell, navigation, preview data, responsive table decorator, app-level orchestration.
- `src/features`: auth, dashboard, students, parents, teachers, rooms, IAM, reference, enrollments, finance, grades, school-life, reports, portals, mosquee.
- `src/shared`: reusable components, services, hooks, constants, types and utilities.
- `src/styles`: layered CSS. Some large files remain and must be governed, especially feature/layout/theme layers.

## Current backend structure

- Controllers expose REST resources.
- Services are still the main application layer.
- Several domains now use facade services plus sub-services.
- Remaining hotspots are tracked in docs and should be reduced without creating decorative architecture.

## Explicitly not present

The repository intentionally does not include Python, Django, FastAPI, Java, Spring, MongoDB, MySQL, GraphQL, Tailwind, React Native, Flutter, medical domains or fake microservice packages.
