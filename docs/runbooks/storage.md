# Storage Runbook

## Preconditions

1. Configure Render with the variables documented in
   `docs/providers/supabase-storage.md`.
2. Create `gestschool-documents` as a private bucket.
3. Create `gestschool-avatars` as a private bucket.
4. Confirm that Vercel contains no Supabase service-role credential.
5. Back up PostgreSQL and verify that the backup can be restored before any
   historical-file migration.

## Deployment checks

1. Check `/api/v1/monitoring/providers` with the metrics token. The provider and
   both bucket variables must be reported as configured.
2. Upload a valid PNG avatar smaller than 2 MB. Refresh the profile and verify
   the image remains visible through a short-lived signed URL. Confirm that the
   persisted database value is storage metadata, not the signed URL.
3. Upload a valid teacher PDF smaller than 10 MB and download it through the API.
4. Upload a valid attendance attachment smaller than 5 MB and download it.
5. Repeat each private download with an unauthorized role and another tenant;
   access must be denied.
6. Try a renamed executable, a corrupt image, a forged MIME and a file with a
   path-like name; every request must fail before creating a database row.

## Provider incident

- Do not enable local disk in production.
- Stop retrying user uploads until Supabase is healthy.
- Keep database rows and object keys unchanged.
- After recovery, check a sample of private downloads and avatar replacements.
- Review API logs for cleanup or rollback errors. Those entries indicate a
  possible orphan that must be reconciled manually.

## Credential incident

1. Rotate `SUPABASE_SERVICE_ROLE_KEY` in Supabase.
2. Update the Render secret and restart the API.
3. Review Supabase object and audit logs for unexpected access.
4. Never expose the replacement key to the browser or documentation.

## Rollback

Redeploy the previous API version only if its database schema remains compatible.
Do not drop the additive storage metadata columns. Do not restore the removed
generic descriptor endpoint. Production rollback must keep Supabase selected;
local storage is intentionally unavailable in production.

## Historical-file migration plan

This plan covers legacy avatars, teacher documents and attendance attachments.
It is a future operational procedure: no production migration is performed as
part of LOT 4.

The executable procedure, safety gates and commands are maintained in
`docs/runbooks/storage-historical-migration.md`.

### 1. Read-only inventory

Run the inventory against a restored production copy first. Export only record
identifiers, tenant identifiers, legacy locations and current storage metadata:

- `users.avatar_url` plus `avatar_storage_driver/bucket/key`, MIME and size;
- `teacher_documents.file_url` plus `storage_driver/bucket/key`, MIME and size;
- `attendance_attachments.file_url` plus `storage_driver/bucket/key`, MIME and
  size.

Classify every legacy location as HTTP(S), local path, data URL, missing or
unsupported. Count records per tenant and category. Never log credentials,
signed query strings or file bytes.

### 2. Dry-run

The future migration command must default to dry-run. For each row it must:

1. verify tenant and parent-resource integrity;
2. resolve the legacy source without writing to PostgreSQL or Supabase;
3. download with strict time and size limits;
4. validate extension, declared MIME, binary signature and format decoding with
   the same validator as live uploads;
5. calculate SHA-256 and determine a stable destination key;
6. report `ready`, `already-migrated`, `missing`, `invalid`, `orphan` or `error`.

Stable keys must include tenant, resource type, resource ID, row ID and content
hash. A rerun therefore targets the same object instead of creating duplicates.

### 3. Idempotent execution and journal

The future write mode must require an explicit flag and consume the approved
dry-run manifest. It processes small batches and records an append-only journal
with operation ID, row ID, tenant ID, source fingerprint, destination key,
checksum, status, attempt count and timestamps.

For each row:

1. skip rows whose complete metadata already points to the expected object;
2. lock the row before changing metadata;
3. upload only when the deterministic destination object is absent;
4. verify the uploaded bytes or checksum;
5. update the storage metadata in one database transaction while retaining the
   legacy URL during the acceptance window;
6. delete a newly uploaded object if the database transaction fails;
7. mark the journal entry complete only after both storage and database checks.

Reruns resume failed or pending journal entries and never overwrite a completed
entry with different content. Parallel workers must use row locks or an
equivalent lease to prevent duplicate processing.

### 4. Missing files, orphans and reconciliation

- A database row whose legacy source cannot be read is marked `missing`; it is
  never silently archived or deleted.
- A row whose tenant or parent resource is missing is marked `orphan` for manual
  review.
- A Supabase object without a matching database row or completed journal entry
  is reported as an object orphan.
- Reconciliation compares database metadata, journal entries and bucket objects
  before and after each batch. Counts must balance before progressing.

### 5. Rollback

Keep legacy sources and legacy URL columns unchanged through the acceptance
window. Rollback restores the PostgreSQL backup or clears only metadata written
by the recorded migration operation, then deletes only destination objects owned
by that operation after confirming the legacy source is still available. Never
bulk-delete a bucket by prefix without matching the journal and database.

### 6. Production prerequisites

Do not run the migration until both buckets are verified private, Render secrets
are configured, a PostgreSQL backup has passed a restore test, the dry-run is
approved on a representative copy and all `missing`/`orphan` records have an
explicit disposition.
