# Notifications

This directory documents the notification boundary of GestSchool_V2.

The executable notification code currently stays in the backend:

- `Backend/api/src/notifications`
- `Backend/api/src/outbox`
- `Backend/api/src/background`
- `Backend/api/src/worker.ts`
- `Backend/api/src/worker.module.ts`

Current model:

- API creates notification/outbox work.
- Worker processes asynchronous notification dispatch.
- Provider mode is controlled by environment variables such as `NOTIFY_EMAIL_PROVIDER`,
  `NOTIFY_SMS_PROVIDER`, and `NOTIFICATIONS_WORKER_ENABLED`.

Rule:

- Keep notification execution inside the current API/worker boundary for now.
- Extract to a separate service only when queue volume, provider complexity, or
  operational isolation requires it.
