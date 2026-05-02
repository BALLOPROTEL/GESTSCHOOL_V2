# Brevo Notification Provider

Brevo is available for transactional email and SMS dispatch through the existing notification gateway. Mock mode remains the default for development and tests.

Official references:
- https://developers.brevo.com/docs/send-a-transactional-email
- https://developers.brevo.com/docs/transactional-sms-endpoints

## Runtime Ownership

Render API in Render free mode:
- `NOTIFICATIONS_EMAIL_PROVIDER=brevo`
- `NOTIFICATIONS_SMS_PROVIDER=brevo`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL=no-reply@al-manarat-islamiyat.com`
- `BREVO_SENDER_NAME=Al Manarat Islamiyat`
- `BREVO_SMS_SENDER=Al Manarat Islamiyat`
- `BREVO_SMS_DRY_RUN=true`
- `ALLOW_REAL_SMS=false`
- `NOTIFICATION_TEST_EMAIL`
- `NOTIFICATION_TEST_PHONE`
- `BREVO_TIMEOUT_MS=8000`

Never configure `BREVO_API_KEY` in Vercel.

Legacy compatibility:
- `NOTIFY_EMAIL_PROVIDER`
- `NOTIFY_SMS_PROVIDER`

The code reads the new `NOTIFICATIONS_*` names first, then falls back to legacy `NOTIFY_*`.

## Modes

Email:
- `MOCK`
- `WEBHOOK`
- `BREVO`

SMS:
- `MOCK`
- `WEBHOOK`
- `BREVO`

SMS dry-run is enabled by default. To send real SMS in a controlled staging test, both variables must allow it:
- `ALLOW_REAL_SMS=true`
- `BREVO_SMS_DRY_RUN=false`

Do not disable SMS dry-run in production until sender ID, country routing, quotas and opt-out/legal obligations are validated.

Email test:
- no automatic real email is sent by startup
- send a controlled test only when `NOTIFICATION_TEST_EMAIL` is explicitly configured

## Templates Covered

The provider is transport-level. Business templates remain controlled by notification request content:
- account created / credentials
- payment received
- invoice issued
- school notification
- report card available

## Safety Rules

- API keys are read server-side only.
- Provider errors are sanitized and do not log API keys.
- SMS sender is normalized to Brevo-safe alphanumeric text and capped to 15 characters.
- In Render free mode, retry is managed by the API in-process outbox runner when `OUTBOX_IN_PROCESS_ENABLED=true`.
- With a future worker service, disable API in-process mode and enable the worker instead.

## Rollback

1. Set `NOTIFICATIONS_EMAIL_PROVIDER=MOCK` and `NOTIFICATIONS_SMS_PROVIDER=MOCK`.
2. Restart API.
3. Keep failed notification records for retry after provider restoration.
4. Do not replay SMS batches blindly; use a bounded retry window.
