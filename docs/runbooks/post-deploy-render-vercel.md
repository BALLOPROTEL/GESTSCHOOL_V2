# Post-Deploy Render Free + Vercel Checklist

Run this after each controlled redeploy.

## API Checks

```bash
curl https://gestschool-ylik.onrender.com/api/v1/health/live
curl https://gestschool-ylik.onrender.com/api/v1/health/ready
curl -H "x-metrics-token: $MONITORING_METRICS_TOKEN" \
  https://gestschool-ylik.onrender.com/api/v1/monitoring/providers
```

Expected:
- health live returns `status=live`
- health ready returns `status=ready`
- provider check returns booleans only, no secret values
- `renderFreeMode.inProcessOutboxEnabled=true`
- `renderFreeMode.notificationWorkerEnabled=false`

## CORS Check

From browser DevTools on `https://gestschool.vercel.app`:
- no CORS error on `/health/live`
- no failed preflight due to `Cache-Control`
- API calls target `https://gestschool-ylik.onrender.com/api/v1`

## Frontend Checks

- Vercel app loads.
- Login admin works.
- Dashboard loads.
- Eleves, inscriptions, finance, notes and portals screens open.
- No `/api/v1` request is sent to Vercel origin when `VITE_API_BASE_URL` is set.

## Supabase Storage Check

1. Generate upload descriptor from API.
2. Confirm `driver=SUPABASE`.
3. Upload a tiny validation file.
4. Confirm object exists in Supabase.
5. Delete validation object.

## Brevo Check

Email:
- configure `NOTIFICATION_TEST_EMAIL` only for a controlled test
- send exactly one test email through a staff-triggered flow
- verify delivery in Brevo

SMS:
- keep `BREVO_SMS_DRY_RUN=true`
- keep `ALLOW_REAL_SMS=false`
- verify logs/status show dry-run behavior

## PayDunya Sandbox Check

1. Create a test invoice.
2. Initiate PayDunya sandbox checkout.
3. Complete sandbox payment.
4. Verify callback creates one internal payment.
5. Replay callback if available.
6. Verify no duplicate payment.

## No-Go Conditions

- any provider secret appears in API response, browser bundle or logs
- `PAYDUNYA_MODE` is not `sandbox`
- SMS dry-run is disabled without explicit approval
- CORS fails from Vercel
- outbox grows while API is awake and `OUTBOX_IN_PROCESS_ENABLED=true`
