# Scalability and Performance

This directory prepares future architecture decisions without creating fake
microservices.

Current production shape:

- Modular NestJS backend in `Backend/api`
- Vite React admin frontend in `Frontend/web-admin`
- Worker process from the same API package
- PostgreSQL as the relational source of truth
- Redis-ready infrastructure for async/cache concerns
- Kubernetes and monitoring manifests under `Infrastructure/`

Do not create standalone services here yet.

Possible future extraction candidates, only after evidence:

- Notifications worker if provider throughput or retries justify isolation
- Reporting/analytics if queries become too expensive for the API runtime
- Payments if provider compliance and reconciliation require a separate lifecycle

Decision rule:

- Extract only when there is a measurable runtime, deployment, scaling, security, or
  ownership reason.
- Until then, keep GestSchool_V2 as a disciplined modular monolith.
