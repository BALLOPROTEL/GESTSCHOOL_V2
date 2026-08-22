-- LOT I2 stores incomplete admission drafts without creating business entities.
BEGIN;

CREATE TYPE "admission_case_mode" AS ENUM ('NEW_ADMISSION', 'RE_ENROLLMENT');
CREATE TYPE "admission_case_status" AS ENUM (
  'DRAFT',
  'READY',
  'FINALIZING',
  'CONFIRMED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "admission_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "mode" "admission_case_mode" NOT NULL,
  "status" "admission_case_status" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "payload_version" INTEGER NOT NULL DEFAULT 1,
  "draft_data" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "student_id" UUID,
  "school_year_id" UUID,
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "finalization_idempotency_key" VARCHAR(200),
  "finalization_payload_hash" CHAR(64),
  "cancelled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admission_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_cases_version_check" CHECK ("version" >= 1),
  CONSTRAINT "admission_cases_payload_version_check" CHECK ("payload_version" = 1),
  CONSTRAINT "admission_cases_draft_data_object_check" CHECK (jsonb_typeof("draft_data") = 'object'),
  CONSTRAINT "admission_cases_finalize_pair_check" CHECK (
    ("finalization_idempotency_key" IS NULL) = ("finalization_payload_hash" IS NULL)
  )
);

ALTER TABLE "admission_cases"
  ADD CONSTRAINT "admission_cases_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admission_cases"
  ADD CONSTRAINT "admission_cases_school_year_id_fkey"
  FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admission_cases"
  ADD CONSTRAINT "admission_cases_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admission_cases"
  ADD CONSTRAINT "admission_cases_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "uq_admission_cases_tenant_finalize_key"
  ON "admission_cases"("tenant_id", "finalization_idempotency_key");

CREATE INDEX "idx_admission_cases_tenant_status_updated"
  ON "admission_cases"("tenant_id", "status", "updated_at");

CREATE INDEX "idx_admission_cases_tenant_student"
  ON "admission_cases"("tenant_id", "student_id");

CREATE INDEX "idx_admission_cases_tenant_school_year"
  ON "admission_cases"("tenant_id", "school_year_id");

COMMIT;
