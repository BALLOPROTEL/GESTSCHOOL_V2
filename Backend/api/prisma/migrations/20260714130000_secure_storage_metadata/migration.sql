BEGIN;

ALTER TABLE "users"
  ADD COLUMN "avatar_storage_driver" VARCHAR(20),
  ADD COLUMN "avatar_storage_bucket" VARCHAR(120),
  ADD COLUMN "avatar_storage_key" VARCHAR(500),
  ADD COLUMN "avatar_mime_type" VARCHAR(120),
  ADD COLUMN "avatar_size" INTEGER;

ALTER TABLE "attendance_attachments"
  ADD COLUMN "size" INTEGER,
  ADD COLUMN "storage_driver" VARCHAR(20),
  ADD COLUMN "storage_bucket" VARCHAR(120),
  ADD COLUMN "storage_key" VARCHAR(500);

ALTER TABLE "teacher_documents"
  ADD COLUMN "storage_driver" VARCHAR(20),
  ADD COLUMN "storage_bucket" VARCHAR(120),
  ADD COLUMN "storage_key" VARCHAR(500);

ALTER TABLE "users"
  ADD CONSTRAINT "users_avatar_size_non_negative"
  CHECK ("avatar_size" IS NULL OR "avatar_size" >= 0);

ALTER TABLE "attendance_attachments"
  ADD CONSTRAINT "attendance_attachments_size_non_negative"
  CHECK ("size" IS NULL OR "size" >= 0);

ALTER TABLE "teacher_documents"
  ADD CONSTRAINT "teacher_documents_size_non_negative"
  CHECK ("size" IS NULL OR "size" >= 0);

CREATE UNIQUE INDEX "uq_atta_tenant_storage_object"
  ON "attendance_attachments"("tenant_id", "storage_bucket", "storage_key");

CREATE UNIQUE INDEX "uq_teacher_documents_tenant_storage_object"
  ON "teacher_documents"("tenant_id", "storage_bucket", "storage_key");

CREATE UNIQUE INDEX "uq_users_tenant_avatar_storage_object"
  ON "users"("tenant_id", "avatar_storage_bucket", "avatar_storage_key");

COMMIT;
