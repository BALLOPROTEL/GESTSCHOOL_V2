# Storage Runbook

This runbook covers durable document storage through Supabase Storage.

## Preconditions

Render API variables:
- `STORAGE_PROVIDER=supabase`
- `FILE_STORAGE_DRIVER=SUPABASE`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET_DOCUMENTS=gestschool-documents`
- `SUPABASE_STORAGE_BUCKET_RECEIPTS=gestschool-receipts`
- `SUPABASE_STORAGE_BUCKET_REPORT_CARDS=gestschool-report-cards`
- `SUPABASE_STORAGE_BUCKET_AVATARS=gestschool-avatars`

Vercel must not contain:
- `SUPABASE_SERVICE_ROLE_KEY`
- any backend-only provider key

## Bucket Preparation

1. Create required buckets in Supabase.
2. Keep buckets private.
3. Validate bucket names match Render API variables.
4. Confirm project URL matches `SUPABASE_URL`.

## Smoke Test

0. Verify configuration without exposing secrets:
   ```bash
   curl -H "x-metrics-token: $MONITORING_METRICS_TOKEN" \
     https://gestschool-ylik.onrender.com/api/v1/monitoring/providers
   ```
   Expected: `storage.enabled=true` and all required Supabase variables are `true`.

1. Request an upload descriptor:
   ```bash
   curl -X POST "$API_URL/api/v1/storage/upload-descriptor" \
     -H "Authorization: Bearer $STAFF_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "fileName":"certificat-medical.pdf",
       "mimeType":"application/pdf",
       "bucket":"documents",
       "studentId":"<student-id>"
     }'
   ```
2. Confirm response:
   - `driver=SUPABASE`
   - `bucket=gestschool-documents`
   - `key` starts with `tenants/{tenantId}/...`
   - `uploadUrl` is a signed upload URL
   - response contains no service role key
3. Upload a small file with the signed URL.
4. Confirm object exists in Supabase.
5. Delete the validation object manually from Supabase or with a controlled admin script.

## Incident Handling

Supabase API unavailable:
- Stop new document uploads.
- Keep existing object keys.
- Do not switch production back to local storage as a permanent fix.

Bad bucket config:
- Fix Render variable.
- Restart API.
- Reissue upload descriptors.

Leaked service role key:
- Rotate key immediately.
- Audit Render logs and Supabase access.
- Reissue only backend environment variables.

## Rollback

1. For staging/dev only, set `FILE_STORAGE_DRIVER=LOCAL`.
2. For production, prefer disabling upload endpoints temporarily over writing to local disk.
3. Keep Supabase objects untouched.
4. Re-enable `FILE_STORAGE_DRIVER=SUPABASE` after provider recovery.

## Go / No-Go

Go for staging activation only if:
- bucket smoke test passes
- signed upload works
- no service key appears in responses/logs
- local storage is not enabled in production

No-go if:
- frontend requires service role key
- descriptors point to local disk in production
- bucket paths do not include tenant isolation
