-- LOT I3 persists finalization leases, stable results and sanitized failures.
BEGIN;

ALTER TABLE "admission_cases"
  ADD COLUMN "finalization_result" JSONB,
  ADD COLUMN "finalization_started_at" TIMESTAMPTZ(6),
  ADD COLUMN "finalization_lease_token" UUID,
  ADD COLUMN "finalization_lease_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "confirmed_at" TIMESTAMPTZ(6),
  ADD COLUMN "failed_at" TIMESTAMPTZ(6),
  ADD COLUMN "failure_code" VARCHAR(80),
  ADD COLUMN "failure_message" VARCHAR(500);

ALTER TABLE "admission_cases"
  ADD CONSTRAINT "admission_cases_finalization_result_object_check"
    CHECK (
      "finalization_result" IS NULL
      OR jsonb_typeof("finalization_result") = 'object'
    ),
  ADD CONSTRAINT "admission_cases_finalizing_lease_check"
    CHECK (
      "status" <> 'FINALIZING'
      OR (
        "finalization_idempotency_key" IS NOT NULL
        AND "finalization_payload_hash" IS NOT NULL
        AND "finalization_started_at" IS NOT NULL
        AND "finalization_lease_token" IS NOT NULL
        AND "finalization_lease_expires_at" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "admission_cases_confirmed_result_check"
    CHECK (
      "status" <> 'CONFIRMED'
      OR (
        "confirmed_at" IS NOT NULL
        AND "finalization_result" IS NOT NULL
        AND "finalization_idempotency_key" IS NOT NULL
        AND "finalization_payload_hash" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "admission_cases_failed_diagnostic_check"
    CHECK (
      "status" <> 'FAILED'
      OR ("failed_at" IS NOT NULL AND "failure_code" IS NOT NULL)
    );

CREATE INDEX "idx_admission_cases_finalize_lease"
  ON "admission_cases"("status", "finalization_lease_expires_at");

COMMIT;
