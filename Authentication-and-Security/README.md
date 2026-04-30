# Authentication and Security

This directory documents the authentication and security boundary of GestSchool_V2.

The executable NestJS code stays in:

- `Backend/api/src/auth`
- `Backend/api/src/security`
- `Backend/api/src/users`

This is intentional. Authentication, roles, permissions, JWT handling, refresh tokens,
and user account lifecycle are still part of the current modular backend. They must not
be extracted into a fake standalone service before the production cutover is stable.

Current source of truth:

- Roles and permission types: `Backend/api/src/security`
- Authentication endpoints and session flow: `Backend/api/src/auth`
- User administration: `Backend/api/src/users`
- Production secrets and environment values: Render/Vercel dashboards, not the repo

Future extraction rule:

- Extract this boundary only when auth needs an independent runtime, independent
  release cycle, or independent scaling.
- Do not duplicate role/permission constants outside the backend before that decision.
