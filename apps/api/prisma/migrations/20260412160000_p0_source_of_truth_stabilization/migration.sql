-- Lot P0: start moving timetable source-of-truth away from free-text room/teacher fields.
-- The legacy `room` and `teacher_name` columns remain nullable compatibility fields during migration.

ALTER TABLE "timetable_slots"
  ADD COLUMN IF NOT EXISTS "room_id" UUID,
  ADD COLUMN IF NOT EXISTS "teacher_assignment_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_tts_tenant_room_day"
  ON "timetable_slots" ("tenant_id", "room_id", "day_of_week");

CREATE INDEX IF NOT EXISTS "idx_tts_tenant_teacher_assignment_day"
  ON "timetable_slots" ("tenant_id", "teacher_assignment_id", "day_of_week");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_room_id_fkey'
  ) THEN
    ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "timetable_slots_room_id_fkey"
      FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_teacher_assignment_id_fkey'
  ) THEN
    ALTER TABLE "timetable_slots"
      ADD CONSTRAINT "timetable_slots_teacher_assignment_id_fkey"
      FOREIGN KEY ("teacher_assignment_id") REFERENCES "teacher_assignments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

WITH room_matches AS (
  SELECT
    t."id" AS slot_id,
    MIN(r."id"::text)::uuid AS room_id,
    COUNT(*) AS match_count
  FROM "timetable_slots" t
  JOIN "rooms" r
    ON r."tenant_id" = t."tenant_id"
   AND LOWER(BTRIM(t."room")) IN (LOWER(BTRIM(r."code")), LOWER(BTRIM(r."name")))
  WHERE t."room_id" IS NULL
    AND t."room" IS NOT NULL
    AND BTRIM(t."room") <> ''
  GROUP BY t."id"
)
UPDATE "timetable_slots" t
SET "room_id" = room_matches.room_id
FROM room_matches
WHERE t."id" = room_matches.slot_id
  AND room_matches.match_count = 1;

WITH teacher_assignment_matches AS (
  SELECT
    t."id" AS slot_id,
    MIN(a."id"::text)::uuid AS teacher_assignment_id,
    COUNT(*) AS match_count
  FROM "timetable_slots" t
  JOIN "teacher_assignments" a
    ON a."tenant_id" = t."tenant_id"
   AND a."school_year_id" = t."school_year_id"
   AND a."class_id" = t."class_id"
   AND a."subject_id" = t."subject_id"
   AND a."track" = t."track"
   AND a."status" = 'ACTIVE'
  WHERE t."teacher_assignment_id" IS NULL
  GROUP BY t."id"
)
UPDATE "timetable_slots" t
SET "teacher_assignment_id" = teacher_assignment_matches.teacher_assignment_id
FROM teacher_assignment_matches
WHERE t."id" = teacher_assignment_matches.slot_id
  AND teacher_assignment_matches.match_count = 1;
