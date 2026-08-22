BEGIN;

-- Technical authentication artifacts have no independent retention value.
ALTER TABLE "refresh_tokens"
  DROP CONSTRAINT "refresh_tokens_user_id_fkey",
  ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Delivery history remains available after a student profile is removed.
ALTER TABLE "notifications"
  DROP CONSTRAINT "notifications_student_id_fkey",
  ADD CONSTRAINT "notifications_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL;

-- Academic history must never disappear as a side effect of deleting a
-- student or school year.
ALTER TABLE "student_track_placements"
  DROP CONSTRAINT "student_track_placements_student_id_fkey",
  ADD CONSTRAINT "student_track_placements_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT,
  DROP CONSTRAINT "student_track_placements_school_year_id_fkey",
  ADD CONSTRAINT "student_track_placements_school_year_id_fkey"
    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE RESTRICT;

-- Pedagogical rules are retained but detached when an optional scope is
-- removed. This aligns PostgreSQL with the existing Prisma model.
ALTER TABLE "pedagogical_rules"
  DROP CONSTRAINT "pedagogical_rules_school_year_id_fkey",
  ADD CONSTRAINT "pedagogical_rules_school_year_id_fkey"
    FOREIGN KEY ("school_year_id") REFERENCES "school_years"("id") ON DELETE SET NULL,
  DROP CONSTRAINT "pedagogical_rules_cycle_id_fkey",
  ADD CONSTRAINT "pedagogical_rules_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL,
  DROP CONSTRAINT "pedagogical_rules_level_id_fkey",
  ADD CONSTRAINT "pedagogical_rules_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE SET NULL,
  DROP CONSTRAINT "pedagogical_rules_class_id_fkey",
  ADD CONSTRAINT "pedagogical_rules_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL;

-- Stored files and family relationships require an explicit business action;
-- direct parent deletion must not orphan storage or relationship history.
ALTER TABLE "teacher_documents"
  DROP CONSTRAINT "teacher_documents_teacher_id_fkey",
  ADD CONSTRAINT "teacher_documents_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE RESTRICT;

ALTER TABLE "attendance_attachments"
  DROP CONSTRAINT "attendance_attachments_attendance_id_fkey",
  ADD CONSTRAINT "attendance_attachments_attendance_id_fkey"
    FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE RESTRICT;

ALTER TABLE "parent_student_links"
  DROP CONSTRAINT "parent_student_links_parent_id_fkey",
  ADD CONSTRAINT "parent_student_links_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "parents"("id") ON DELETE RESTRICT,
  DROP CONSTRAINT "parent_student_links_student_id_fkey",
  ADD CONSTRAINT "parent_student_links_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;

COMMIT;
