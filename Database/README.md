# Database

This directory documents the database boundary of GestSchool_V2.

The Prisma schema, migrations, and seeds currently remain inside the API package:

- `Backend/api/prisma/schema.prisma`
- `Backend/api/prisma/migrations`
- `Backend/api/prisma/seed-minimal.ts`
- `Backend/api/prisma/seed-users.ts`
- `Backend/api/scripts/*`

This is deliberate. Prisma is tightly coupled to the NestJS API package and its generated
client workflow. Moving Prisma physically to this root directory would require changing
Prisma command resolution, package scripts, Render build behavior, and developer commands.

Current source of truth:

- Schema source of truth: `Backend/api/prisma/schema.prisma`
- Migration source of truth: `Backend/api/prisma/migrations`
- Controlled DB audit and migration scripts: `Backend/api/scripts`
- Legacy SQL/bootstrap artifacts: `Infrastructure/migrations` and `Infrastructure/scripts`

Rule:

- Use Prisma migrations for the V2 production database.
- Treat raw SQL under `Infrastructure/` as infrastructure/bootstrap or legacy support,
  not as the primary V2 schema authority.
