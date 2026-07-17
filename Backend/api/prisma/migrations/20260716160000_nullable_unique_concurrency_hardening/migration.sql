BEGIN;

-- Abort before changing constraints if historical data violates a target invariant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM teacher_skills
    GROUP BY tenant_id, teacher_id, subject_id, track, cycle_id, level_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_TEACHER_SKILL_SCOPE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM teacher_assignments
    WHERE is_homeroom_teacher = TRUE AND status = 'ACTIVE'
    GROUP BY tenant_id, school_year_id, class_id, track
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_ACTIVE_HOMEROOM_ASSIGNMENT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM room_assignments
    GROUP BY tenant_id, room_id, school_year_id, class_id, level_id,
      cycle_id, track, subject_id, period_id, assignment_type
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_ROOM_ASSIGNMENT_SCOPE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM room_availabilities
    GROUP BY tenant_id, room_id, school_year_id, period_id, day_of_week,
      start_time, end_time, availability_type
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_ROOM_AVAILABILITY_SCOPE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM parent_student_links
    WHERE parent_id IS NOT NULL AND archived_at IS NULL
    GROUP BY tenant_id, parent_id, student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_PARENT_PROFILE_STUDENT_LINK';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM parent_student_links
    WHERE parent_user_id IS NOT NULL AND archived_at IS NULL
    GROUP BY tenant_id, parent_user_id, student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_PARENT_USER_STUDENT_LINK';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM parent_student_links
    WHERE is_primary_contact = TRUE AND archived_at IS NULL
    GROUP BY tenant_id, student_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_PRIMARY_PARENT_CONTACT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM payments
    WHERE reference_external IS NOT NULL
    GROUP BY tenant_id, payment_method, reference_external
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_PAYMENT_EXTERNAL_REFERENCE';
  END IF;
END $$;

ALTER TABLE teacher_skills
  DROP CONSTRAINT teacher_skills_scope_key,
  ADD CONSTRAINT teacher_skills_scope_key
    UNIQUE NULLS NOT DISTINCT
      (tenant_id, teacher_id, subject_id, track, cycle_id, level_id);

ALTER TABLE room_assignments
  DROP CONSTRAINT room_assignments_scope_key,
  ADD CONSTRAINT room_assignments_scope_key
    UNIQUE NULLS NOT DISTINCT
      (tenant_id, room_id, school_year_id, class_id, level_id, cycle_id,
       track, subject_id, period_id, assignment_type);

ALTER TABLE parent_student_links
  DROP CONSTRAINT uq_parent_links_scope;

ALTER TABLE room_availabilities
  ADD CONSTRAINT room_availabilities_scope_key
    UNIQUE NULLS NOT DISTINCT
      (tenant_id, room_id, school_year_id, period_id, day_of_week,
       start_time, end_time, availability_type);

CREATE UNIQUE INDEX uq_teacher_assignments_active_homeroom
  ON teacher_assignments (tenant_id, school_year_id, class_id, track)
  WHERE is_homeroom_teacher = TRUE AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_parent_links_active_profile_student
  ON parent_student_links (tenant_id, parent_id, student_id)
  WHERE parent_id IS NOT NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX uq_parent_links_active_user_student
  ON parent_student_links (tenant_id, parent_user_id, student_id)
  WHERE parent_user_id IS NOT NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX uq_parent_links_one_primary_contact
  ON parent_student_links (tenant_id, student_id)
  WHERE is_primary_contact = TRUE AND archived_at IS NULL;

CREATE UNIQUE INDEX uq_payments_external_reference
  ON payments (tenant_id, payment_method, reference_external)
  WHERE reference_external IS NOT NULL;

COMMIT;
