-- Strengthen IAM account metadata while keeping users.role as the effective legacy RBAC role.
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "user_id" UUID;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email" VARCHAR(150),
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "account_type" VARCHAR(30) NOT NULL DEFAULT 'STAFF',
  ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(180),
  ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "establishment_id" UUID,
  ADD COLUMN IF NOT EXISTS "staff_function" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "department" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "notes" VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS "must_change_password_at_first_login" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "account_type" = CASE
  WHEN "role" = 'ENSEIGNANT' THEN 'TEACHER'
  WHEN "role" = 'PARENT' THEN 'PARENT'
  WHEN "role" = 'STUDENT' THEN 'STUDENT'
  ELSE 'STAFF'
END
WHERE "account_type" IS NULL OR "account_type" = 'STAFF';

UPDATE "users"
SET
  "email" = CASE WHEN "username" LIKE '%@%' THEN "username" ELSE "email" END,
  "display_name" = COALESCE("display_name", "username")
WHERE "email" IS NULL OR "display_name" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_user_id_key'
  ) THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_user_id_key" UNIQUE ("user_id");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_user_id_fkey'
  ) THEN
    ALTER TABLE "students"
      ADD CONSTRAINT "students_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_id_email_key'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_tenant_id_email_key" UNIQUE ("tenant_id", "email");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_users_tenant_account_type" ON "users"("tenant_id", "account_type");
