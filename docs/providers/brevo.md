# Brevo Notification Provider

Brevo is supported for transactional email and SMS through the GestSchool
notification gateway. `MOCK` remains the safe default. Configuring an API key
alone never enables a real provider.

Official contracts checked for LOT 5B:

- email send: `POST /v3/smtp/email`, API key in the `api-key` header, HTTP 201
  with `messageId` (or `messageIds` for batch responses);
- SMS send: `POST /v3/transactionalSMS/send`, API key in `api-key`, HTTP 201
  with a numeric `messageId`;
- sender verification: `GET /v3/senders`, no message is sent;
- retryable statuses documented by the official Node guide: 408, 429, 500,
  502, 503 and 504;
- rate-limit delay: `Retry-After`, then `x-sib-ratelimit-reset` in seconds;
- inbound webhook authentication: HTTP Basic or Bearer credentials configured
  on the Brevo webhook. GestSchool uses Bearer authentication;
- email callbacks expose `message-id`, `event`, `id` (webhook identifier) and
  `ts_event`; SMS callbacks expose a numeric `messageId`, `msg_status` and
  timestamps. The documented SMS abbreviations `bl` (blacklisted) and `rej`
  (rejected) are treated as permanent delivery failures.

Brevo does not document a native HMAC signature for transactional callbacks.
GestSchool therefore does not claim one. The callback route uses a strong
Bearer credential, a bounded event timestamp, database event deduplication and
monotonic delivery-state transitions. Some documented SMS callbacks omit the
numeric event timestamp; for those callbacks the authenticated receipt time is
used, while a timestamp-independent event fingerprint prevents a replay from
being processed twice.

## Delivery Guarantee

GestSchool provides **at-least-once processing with local deduplication**.

- Email sends include the notification UUID in the Brevo email body header
  `headers["Idempotency-Key"]`. Brevo documents email idempotence as a
  short-lived protection window, not a durable exactly-once guarantee.
- SMS has no documented Brevo idempotency contract. The provider message ID,
  local leases, retries and callback deduplication reduce risk but cannot
  eliminate a duplicate after an unknown network outcome.
- Provider callbacks may be duplicated or arrive out of order. GestSchool
  derives a deterministic callback fingerprint and does not regress a terminal
  delivery state.

No code or operations document may claim exactly-once delivery.

## Runtime Ownership

Production API:

- `GESTSCHOOL_PROCESS_ROLE=api`
- `NOTIFICATIONS_WORKER_ENABLED=false`
- `OUTBOX_IN_PROCESS_ENABLED=false`
- `NOTIFICATIONS_EMAIL_PROVIDER=MOCK` until synchronous activation/reset email
  is explicitly enabled
- `NOTIFICATIONS_SMS_PROVIDER=MOCK`
- `BREVO_WEBHOOK_ENABLED=false` until the callback is configured in Brevo

Dedicated production worker after approval:

- `GESTSCHOOL_PROCESS_ROLE=worker`
- `NOTIFICATIONS_WORKER_ENABLED=true`
- `OUTBOX_IN_PROCESS_ENABLED=false`
- `NOTIFICATIONS_EMAIL_PROVIDER=BREVO`
- `NOTIFICATIONS_SMS_PROVIDER=MOCK`
- `BREVO_SMS_DRY_RUN=true`
- `ALLOW_REAL_SMS=false`

The worker example is deliberately not part of the root Render blueprint:
Render has no free background worker. Creating it requires an explicit cost
decision.

Activation and password-reset emails remain synchronous in the API because
their one-use secrets are not encrypted for durable outbox storage. When real
email is enabled, the API also needs the Brevo email credentials. These two
flows are not moved to the worker in LOT 5B.

## Required Server Variables

Shared only by processes that use Brevo:

- `BREVO_API_KEY` (secret)
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_TIMEOUT_MS=8000`

SMS worker:

- `BREVO_SMS_SENDER` (alphanumeric, at most 11 characters, or an eligible
  numeric sender)
- `BREVO_SMS_DRY_RUN=true`
- `ALLOW_REAL_SMS=false`

Inbound callback on the API:

- `BREVO_WEBHOOK_ENABLED=true` only after configuration
- `BREVO_WEBHOOK_AUTH_TOKEN` (strong secret, configured as the Brevo webhook
  Bearer credential)
- `BREVO_WEBHOOK_MAX_AGE_SECONDS=90000`

Brevo indique que les webhooks sortants en echec sont retentes pendant au plus
24 heures avant abandon dans sa
[documentation de supervision des webhooks](https://help.brevo.com/hc/en-us/articles/27824932835474-Create-outbound-webhooks-to-send-real-time-data-from-Brevo-to-an-external-app).
La fenetre d'acceptation est donc limitee a 25 heures : l'horizon fournisseur
documente plus une heure pour le transport et un faible decalage d'horloge.
Sept jours serait inutilement permissif. Le jeton Bearer du webhook doit etre
genere independamment de `BREVO_API_KEY` ; aucun des deux secrets ne doit etre
journalise.

Never configure any Brevo key or callback credential in Vercel or another
frontend environment.

## Sender Verification Without Sending

After setting the API key and sender on the selected Render service:

```bash
pnpm --filter @gestschool/api notifications:verify:brevo-sender
```

The command calls only `GET /v3/senders` and prints booleans plus the provider
name. It does not print the sender address or API key and does not send email.

## Staging Recipe

1. Configure the first email recipe exactly as follows:
   `NOTIFICATIONS_EMAIL_PROVIDER=BREVO`,
   `NOTIFICATIONS_SMS_PROVIDER=MOCK`, `BREVO_SMS_DRY_RUN=true` and
   `ALLOW_REAL_SMS=false`.
2. Add the Brevo key and a verified sender only to the API/worker server
   environments.
3. Run the sender verification command.
4. Configure a non-batched transactional webhook in Brevo for the staging API
   callback URL:
   `/api/v1/notifications/brevo/delivery-events`.
5. Configure the same strong Bearer token in Brevo and
   `BREVO_WEBHOOK_AUTH_TOKEN`, then enable `BREVO_WEBHOOK_ENABLED`.
6. Enable Brevo email on staging and send one manually approved, non-sensitive
   test to a controlled address. Confirm accepted ID, callback and final state.
7. Keep SMS in dry-run and validate payload mapping and worker state.
8. Only after legal, sender, routing, quota and cost approval may a separate
   controlled SMS test set both `ALLOW_REAL_SMS=true` and
   `BREVO_SMS_DRY_RUN=false`.

No step 6 or 8 is performed by LOT 5B.

## Failure and Rollback

1. Set the affected provider back to `MOCK`.
2. Keep the API background modes disabled and stop the dedicated worker if its
   configuration is suspect.
3. Preserve notification, attempt and callback rows for diagnosis.
4. Do not blindly replay unknown-outcome SMS; reconcile with Brevo first.
5. Re-enable only after sender, credentials, webhook and backlog are verified.
