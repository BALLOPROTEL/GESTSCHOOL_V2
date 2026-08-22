-- LOT I4 protects automatic student matricules without rewriting historical identities.
-- Keep the read-only preflight outside the transaction so Prisma surfaces its
-- actionable error instead of PostgreSQL's generic aborted-transaction message.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM students
    GROUP BY tenant_id, upper(btrim(matricule))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'I4_DUPLICATE_NORMALIZED_STUDENT_MATRICULE';
  END IF;
END $$;

BEGIN;

CREATE UNIQUE INDEX "uq_students_tenant_matricule_normalized"
  ON "students" ("tenant_id", upper(btrim("matricule")));

ALTER TABLE "admission_cases"
  ADD COLUMN "reserved_matricule" VARCHAR(30);

CREATE UNIQUE INDEX "uq_admission_cases_tenant_reserved_matricule"
  ON "admission_cases" ("tenant_id", upper(btrim("reserved_matricule")))
  WHERE "reserved_matricule" IS NOT NULL;

CREATE TABLE "student_matricule_counters" (
  "tenant_id" UUID NOT NULL,
  "academic_year" INTEGER NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_matricule_counters_pkey"
    PRIMARY KEY ("tenant_id", "academic_year"),
  CONSTRAINT "student_matricule_counters_year_check"
    CHECK ("academic_year" BETWEEN 2000 AND 9999),
  CONSTRAINT "student_matricule_counters_next_value_check"
    CHECK ("next_value" BETWEEN 1 AND 1000000)
);

-- Start after any matricule already using the generated format. Historical
-- student identities are not rewritten.
INSERT INTO "student_matricule_counters" (
  "tenant_id",
  "academic_year",
  "next_value"
)
SELECT
  "tenant_id",
  substring(upper(btrim("matricule")) FROM '^GST-([0-9]{4})-')::INTEGER,
  MAX(substring(upper(btrim("matricule")) FROM '-([0-9]{6})$')::INTEGER) + 1
FROM "students"
WHERE upper(btrim("matricule")) ~ '^GST-[0-9]{4}-[0-9]{6}$'
GROUP BY
  "tenant_id",
  substring(upper(btrim("matricule")) FROM '^GST-([0-9]{4})-')::INTEGER;

COMMIT;
