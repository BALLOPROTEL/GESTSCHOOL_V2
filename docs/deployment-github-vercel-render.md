# Deployment Render Free + Vercel

Contexte actuel:
- une seule API Render en plan gratuit
- pas de worker Render separe
- pas de staging Render dedie
- frontend Vercel
- Supabase Storage, Brevo et PayDunya sont configures par variables Render

## Render API

`render.yaml` decrit uniquement le service web `gestschool-api`.

Le service utilise:
- `plan: free`
- `healthCheckPath: /api/v1/health/live`
- `startCommand: pnpm render:start:api`

Le worker separe n'est pas requis dans ce contexte. L'API peut traiter l'outbox en mode in-process leger:
- `NOTIFICATIONS_WORKER_ENABLED=false`
- `OUTBOX_IN_PROCESS_ENABLED=true`
- `OUTBOX_POLL_INTERVAL_MS=30000`
- `OUTBOX_BATCH_SIZE=10`

Ce mode est acceptable pour Render free et petite charge. Il n'est pas recommande pour une charge elevee. Le passage futur vers un worker separe consiste a:
1. creer un worker Render
2. mettre `OUTBOX_IN_PROCESS_ENABLED=false` sur l'API
3. mettre `NOTIFICATIONS_WORKER_ENABLED=true` sur le worker
4. partager les memes variables DB/providers avec le worker

## Variables Render API

Backend/runtime:
- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `DATABASE_URL`
- `DIRECT_URL`
- `CORS_ORIGINS=https://gestschool.vercel.app`
- `JWT_SECRET`
- `PASSWORD_RESET_SECRET`
- `MONITORING_METRICS_TOKEN`

Supabase Storage:
- `STORAGE_PROVIDER=supabase`
- `FILE_STORAGE_DRIVER=SUPABASE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET_DOCUMENTS=gestschool-documents`
- `SUPABASE_STORAGE_BUCKET_RECEIPTS=gestschool-receipts`
- `SUPABASE_STORAGE_BUCKET_REPORT_CARDS=gestschool-report-cards`
- `SUPABASE_STORAGE_BUCKET_AVATARS=gestschool-avatars`

Brevo:
- `NOTIFICATIONS_EMAIL_PROVIDER=brevo`
- `NOTIFICATIONS_SMS_PROVIDER=brevo`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL=no-reply@al-manarat-islamiyat.com`
- `BREVO_SENDER_NAME=Al Manarat Islamiyat`
- `BREVO_SMS_SENDER=Al Manarat Islamiyat`
- `BREVO_SMS_DRY_RUN=true`
- `ALLOW_REAL_SMS=false`

PayDunya sandbox:
- `PAYMENT_PROVIDER=paydunya`
- `PAYDUNYA_MODE=sandbox`
- `PAYDUNYA_MASTER_KEY`
- `PAYDUNYA_PUBLIC_KEY`
- `PAYDUNYA_PRIVATE_KEY`
- `PAYDUNYA_TOKEN`
- `PAYDUNYA_CALLBACK_URL=https://gestschool-ylik.onrender.com/api/v1/payments/paydunya/callback`
- `PAYDUNYA_RETURN_URL=https://gestschool.vercel.app`
- `PAYDUNYA_CANCEL_URL=https://gestschool.vercel.app`

Never put provider secrets in Vercel.

## Vercel Frontend

Required variable:
- `VITE_API_BASE_URL=https://gestschool-ylik.onrender.com/api/v1`

No Supabase service role key, Brevo key or PayDunya key belongs in Vercel.

## Secure Provider Config Check

After deploy, call:

```bash
curl -H "x-metrics-token: $MONITORING_METRICS_TOKEN" \
  https://gestschool-ylik.onrender.com/api/v1/monitoring/providers
```

The endpoint only returns booleans and enabled/disabled status. It must not return secret values.

## Post-Deployment Checklist

API:
- `GET https://gestschool-ylik.onrender.com/api/v1/health/live`
- `GET https://gestschool-ylik.onrender.com/api/v1/health/ready`
- provider check endpoint returns expected booleans
- login admin works from Vercel
- no CORS error from `https://gestschool.vercel.app`

Frontend:
- Vercel loads
- login calls Render URL, not `/api/v1` on Vercel
- dashboard loads
- modules eleves, inscriptions, finance, notes, portails open

Providers:
- Supabase upload descriptor returns `driver=SUPABASE`
- Brevo email test is sent only if `NOTIFICATION_TEST_EMAIL` is explicitly set
- SMS remains dry-run while `ALLOW_REAL_SMS=false`
- PayDunya initiate returns sandbox checkout URL
- PayDunya callback creates one payment and duplicate callback remains idempotent

## Known Limits

Render free can sleep, so first request can be slow.
In-process outbox runs only while the API process is awake.
For high volume notifications, move to a separate worker.
