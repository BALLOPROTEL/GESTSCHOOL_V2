# Payment Webhooks Runbook

This runbook covers PayDunya sandbox callbacks for GestSchool.

## Scope

Current phase:
- PayDunya sandbox only.
- No production payments.
- No frontend-return confirmation.
- Internal payment is created only after server-side provider confirmation.

## Preconditions

Render API variables:
- `PAYMENT_PROVIDER=paydunya`
- `PAYDUNYA_MODE=sandbox`
- `PAYDUNYA_MASTER_KEY`
- `PAYDUNYA_PUBLIC_KEY`
- `PAYDUNYA_PRIVATE_KEY`
- `PAYDUNYA_TOKEN`
- `PAYDUNYA_CALLBACK_URL=https://gestschool-ylik.onrender.com/api/v1/payments/paydunya/callback`
- `PAYDUNYA_RETURN_URL=https://gestschool.vercel.app`
- `PAYDUNYA_CANCEL_URL=https://gestschool.vercel.app`

Never set PayDunya secrets in Vercel.

Before initiation, verify configuration without exposing secrets:

```bash
curl -H "x-metrics-token: $MONITORING_METRICS_TOKEN" \
  https://gestschool-ylik.onrender.com/api/v1/monitoring/providers
```

Expected:
- `payments.enabled=true`
- `payments.mode=sandbox`
- all required PayDunya variables are `true`

## Initiation Check

1. Create an internal invoice.
2. Initiate checkout:
   ```bash
   curl -X POST "$API_URL/api/v1/payments/paydunya/initiate" \
     -H "Authorization: Bearer $STAFF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"invoiceId":"<invoice-id>"}'
   ```
3. Confirm the response contains:
   - `provider=PAYDUNYA`
   - `mode=sandbox`
   - `providerStatus=PENDING`
   - `checkoutUrl`
4. Confirm the response does not contain any key or token secret.
5. Confirm Render logs do not include provider keys.

## Callback Check

1. Complete payment through PayDunya sandbox.
2. Confirm callback reached:
   - `payment_provider_attempts.provider_status=COMPLETED`
   - exactly one `payments` row linked to the invoice
   - invoice status updated to `PAID` or `PARTIAL`
3. Replay the same callback if available.
4. Confirm there is still exactly one `payments` row.

## Failure Handling

Unknown token:
- Response should reject the callback.
- No payment must be created.

Invalid hash:
- Attempt status becomes `CALLBACK_REJECTED`.
- No payment must be created.

Provider confirm failure:
- Callback fails.
- No payment must be created.
- Investigate PayDunya sandbox availability before retrying.

## Rollback

1. Set `PAYMENT_PROVIDER=mock`.
2. Restart Render API.
3. Keep provider attempts for audit.
4. Do not delete confirmed payments.
5. If accounting state is inconsistent, freeze finance writes and reconcile manually from provider dashboard plus `payment_provider_attempts`.

## Go / No-Go

Go for staging activation only if:
- initiation test passes
- callback confirmation test passes
- duplicate callback is idempotent
- no secret appears in API responses or logs
- rollback has been rehearsed

No-go if:
- callback creates payment without provider confirmation
- duplicate callback creates duplicate payment
- frontend return URL can mark invoice paid
- any PayDunya secret appears in client-visible data
