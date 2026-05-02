# PayDunya Sandbox Provider

PayDunya is only enabled in sandbox for this phase. Production mode must stay disabled until a human staging review validates payment initiation, callback confirmation, duplicate callback idempotence, accounting impact and rollback.

Official references:
- https://developers.paydunya.com/doc/FR/http_json
- https://developers.paydunya.com/doc/EN/sandbox_softpay

## Runtime Ownership

Render API only:
- `PAYMENT_PROVIDER=paydunya`
- `PAYDUNYA_MODE=sandbox`
- `PAYDUNYA_MASTER_KEY`
- `PAYDUNYA_PUBLIC_KEY`
- `PAYDUNYA_PRIVATE_KEY`
- `PAYDUNYA_TOKEN`
- `PAYDUNYA_CALLBACK_URL`
- `PAYDUNYA_RETURN_URL`
- `PAYDUNYA_CANCEL_URL`
- `PAYDUNYA_STORE_NAME`
- `PAYDUNYA_TIMEOUT_MS`

Never configure PayDunya secrets in Vercel.

## Implemented Contract

- `POST /api/v1/payments/paydunya/initiate`
  - Staff-only endpoint.
  - Creates a `PaymentProviderAttempt`.
  - Calls PayDunya sandbox checkout invoice creation.
  - Stores provider token, checkout URL and provider status.

- `POST /api/v1/payments/paydunya/callback`
  - Public webhook endpoint.
  - Requires PayDunya hash validation.
  - Confirms provider status server-side via the PayDunya confirm endpoint before creating an internal payment.
  - Is idempotent: duplicate callbacks do not create duplicate `Payment` rows.

- `GET /api/v1/payments/:id/status`
  - Staff-only endpoint for internal payment or provider attempt status.

## Safety Rules

- A frontend return URL is never payment proof.
- Only provider confirmation can transition an invoice/payment to paid.
- `PAYDUNYA_MODE=production` intentionally fails in this phase.
- Provider payloads are stored for audit, but secrets are never written to payloads or responses.
- Provider errors are sanitized before persistence.

## Staging Test

1. Configure sandbox keys in Render API.
2. Confirm `PAYMENT_PROVIDER=paydunya` and `PAYDUNYA_MODE=sandbox`.
3. Confirm secure provider check reports required PayDunya variables as present:
   ```bash
   curl -H "x-metrics-token: $MONITORING_METRICS_TOKEN" \
     https://gestschool-ylik.onrender.com/api/v1/monitoring/providers
   ```
4. Create an invoice in the deployed environment.
5. Initiate payment with:
   `POST /api/v1/payments/paydunya/initiate`
6. Pay with a PayDunya sandbox account.
7. Verify callback created one `Payment`.
8. Replay the same callback or return flow and verify no duplicate payment.

Do not mark PayDunya real sandbox as validated from local mock tests only.

## Rollback

1. Set `PAYMENT_PROVIDER=mock`.
2. Redeploy API.
3. Keep `payment_provider_attempts` rows for audit.
4. Do not delete internal payments already confirmed by provider.
