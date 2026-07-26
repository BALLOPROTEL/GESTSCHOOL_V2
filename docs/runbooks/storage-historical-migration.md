# Historical Storage Migration Runbook

This runbook migrates legacy avatars, teacher documents and attendance
attachments to the private Supabase buckets used by GestSchool. It never
deletes a legacy source. The command defaults to dry-run and writes no database
or Supabase data unless every apply guard is supplied.

## Current assessed inventory

The LOT 4-PROD read-only audit used only `PROD_SNAPSHOT_DATABASE_URL`.

| Category               | Rows | Legacy tenant references | Parent mismatches |
| ---------------------- | ---: | -----------------------: | ----------------: |
| Avatars                |    2 |                        2 |                 0 |
| Teacher documents      |    0 |                        0 |                 0 |
| Attendance attachments |    0 |                        0 |                 0 |

Both avatar references point to distinct objects in the
`gestschool-avatars` bucket under the historical tenant prefix. They are
legacy public-object URLs. The snapshot predates the secure-storage metadata
migration, so it contains none of the new driver, bucket or key columns.

The physical existence of those two objects and the absence of bucket objects
without metadata were not verified during LOT 4-PROD: no service-role
credential was available, and no request to the real Supabase project was
performed.

## Invariants

- Historical tenant:
  `00000000-0000-0000-0000-000000000001`.
- Canonical tenant:
  `00000000-0000-4000-8000-000000000001`.
- Target buckets: `gestschool-documents` and `gestschool-avatars`.
- Both buckets must be private.
- `SUPABASE_STORAGE_AVATARS_PUBLIC=false`.
- The service-role key exists only in the API or controlled migration job.
- Signed URLs expire after 300 seconds; production validation permits 60-900.
- The tool updates only storage metadata columns. It does not rewrite
  `avatar_url`, `file_url`, audit JSON, processed outbox payloads or historical
  URLs.
- Source objects are never deleted automatically.

## Required configuration

Backend runtime:

```text
STORAGE_PROVIDER=supabase
FILE_STORAGE_DRIVER=SUPABASE
SUPABASE_URL=<https project URL>
SUPABASE_SERVICE_ROLE_KEY=<secret backend value>
SUPABASE_STORAGE_BUCKET_DOCUMENTS=gestschool-documents
SUPABASE_STORAGE_BUCKET_AVATARS=gestschool-avatars
SUPABASE_STORAGE_AVATARS_PUBLIC=false
SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS=300
SUPABASE_STORAGE_TIMEOUT_MS=10000
```

Migration-only variables:

```text
PROD_SNAPSHOT_DATABASE_URL=<read-only snapshot or staging clone for dry-run>
STORAGE_MIGRATION_DATABASE_URL=<writable staging or production database>
STORAGE_MIGRATION_ENVIRONMENT=staging|production
STORAGE_MIGRATION_ALLOW_WRITES=false
STORAGE_MIGRATION_ALLOWED_SOURCE_ORIGINS=<exact comma-separated HTTPS origins>
LEGACY_STORAGE_ROOT=<optional trusted local roots, comma-separated>
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in Vercel, frontend variables, a manifest,
a report or Git.

## 1. Read-only inventory

This command reads only PostgreSQL. It does not fetch files and therefore
reports legacy references as `blocked`:

```bash
pnpm --filter @gestschool/api storage:migrate:dry-run -- \
  --report=/secure/lot4-prod/inventory.json
```

Expected for the assessed snapshot: two avatar rows, no documents or
justifications, no error and two `source-read-disabled` results in the private
journal/report. Console output is aggregate-only.

## 2. Full dry-run on a staging copy

Prerequisites:

1. Restore a representative database copy.
2. Apply all repository migrations, including LOT 1C, to that copy.
3. Configure the exact legacy Supabase origin in
   `STORAGE_MIGRATION_ALLOWED_SOURCE_ORIGINS`.
4. Configure the backend-only Supabase variables.
5. Keep the target buckets private.

Then run:

```bash
pnpm --filter @gestschool/api storage:migrate:dry-run -- \
  --allow-source-read \
  --list-target-objects \
  --manifest-out=/secure/lot4-prod/staging-manifest.json \
  --journal=/secure/lot4-prod/staging-dry-run.jsonl \
  --report=/secure/lot4-prod/staging-dry-run.json
```

The tool validates every source with the live upload validator, computes
SHA-256 and size, derives a stable key under the canonical tenant, checks an
existing destination byte-for-byte and reports bucket objects without matching
metadata by fingerprint only.

Review and approve the manifest. Any `missing`, `orphan`, checksum mismatch or
error blocks apply.

## 3. Apply to staging

Use a writable staging database that is not the snapshot:

LOT 1C must already have migrated the staging row to the canonical tenant. The
migration engine explicitly blocks apply while a row still carries the
historical tenant, preventing a canonical Supabase key from being attached to a
legacy-tenant database row.

```bash
export STORAGE_MIGRATION_ENVIRONMENT=staging
export STORAGE_MIGRATION_ALLOW_WRITES=true
pnpm --filter @gestschool/api storage:migrate:apply -- \
  --allow-source-read \
  --manifest=/secure/lot4-prod/staging-manifest.json \
  --journal=/secure/lot4-prod/staging-apply.jsonl \
  --report=/secure/lot4-prod/staging-apply.json \
  --confirm=LOT4-PROD-STAGING
```

The command refuses apply when the writable URL equals
`PROD_SNAPSHOT_DATABASE_URL`. It uploads only an absent deterministic object,
downloads it again to verify checksum and size, then conditionally updates the
database row. If that update fails, it deletes only the newly uploaded object.
A failed compensation is a blocking incident and is recorded without source
URL, recipient data or credentials.

Replay the exact command. Expected result: every completed row is
`already-migrated`, with no new upload.

## 4. Production sequence

Production remains blocked until staging has passed.

1. Put API and worker in maintenance and stop all writes.
2. Verify a PostgreSQL backup by restoring it to a disposable database.
3. Export a read-only inventory and compare counts with the approved staging
   manifest.
4. Verify both buckets are private and that the service-role secret is present
   only on the backend migration job.
5. Deploy database migrations, including LOT 1C, under the controlled migration
   job.
6. Run the full dry-run against the resulting production schema and compare its
   checksum with the approved manifest.
7. Set `STORAGE_MIGRATION_ENVIRONMENT=production` and
   `STORAGE_MIGRATION_ALLOW_WRITES=true` only for the migration job.
8. Apply with `--confirm=LOT4-PROD-PRODUCTION`.
9. Replay in dry-run, reconcile metadata and bucket inventories, and test
   authenticated signed avatar access.
10. Deploy API, then worker, run storage smoke tests and reopen writes.
11. Set `STORAGE_MIGRATION_ALLOW_WRITES=false` and remove migration-only
    credentials from the job.

## Rollback

Rollback is allowed only before traffic and writes resume:

1. stop API and worker;
2. preserve the apply journal and object inventory;
3. restore the verified PostgreSQL backup;
4. delete only destination objects recorded as newly uploaded by this operation,
   after confirming each legacy source remains readable;
5. redeploy the previous compatible API and worker;
6. verify old avatar access and database counts;
7. reopen traffic only after reconciliation.

After writes resume, do not restore the old database over new data. Use a
forward repair based on the journal and escalate.

## Operator-only Supabase checks

Run these from a secured workstation. Do not paste outputs containing keys or
signed URLs into tickets:

1. Query only the non-secret bucket metadata and confirm both `public` flags are
   `false`:

   ```bash
   for bucket in gestschool-documents gestschool-avatars; do
     curl --fail --silent --show-error \
       -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
       -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
       "$SUPABASE_URL/storage/v1/bucket/$bucket" |
       jq '{id, public, file_size_limit, allowed_mime_types}'
   done
   ```

   Stop immediately if either bucket is absent or public.

2. List objects under both historical and canonical tenant prefixes.
   The official dry-run performs this with `--list-target-objects` and reports
   only counts and object-key fingerprints.
3. Run the full dry-run with service-role access. Confirm the two historical
   avatar references are no longer `blocked` and are reported as `ready`,
   `object-present` or `missing`. A `missing` result blocks migration.
4. Generate a 300-second signed URL and verify it expires.
5. Compare bucket object counts with database metadata and the migration
   manifest.
6. Report absent and orphan objects; do not delete them automatically.
