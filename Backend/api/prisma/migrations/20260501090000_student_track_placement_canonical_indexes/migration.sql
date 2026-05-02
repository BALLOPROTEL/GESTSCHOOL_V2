-- Canonical academic source-of-truth hardening.
--
-- StudentTrackPlacement is the canonical academic placement. The legacy class_id
-- columns stay available as denormalized context, but new uniqueness guards are
-- placement-first for grades, report cards and attendance.

UPDATE grades AS grade
SET
  placement_id = placement.id,
  track = placement.track
FROM academic_periods AS period
INNER JOIN student_track_placements AS placement
  ON placement.school_year_id = period.school_year_id
WHERE grade.placement_id IS NULL
  AND period.id = grade.academic_period_id
  AND period.tenant_id = grade.tenant_id
  AND placement.tenant_id = grade.tenant_id
  AND placement.student_id = grade.student_id
  AND placement.class_id = grade.class_id
  AND placement.track = grade.track
  AND placement.placement_status IN ('ACTIVE', 'COMPLETED');

UPDATE report_cards AS report_card
SET
  placement_id = placement.id,
  track = placement.track
FROM academic_periods AS period
INNER JOIN student_track_placements AS placement
  ON placement.school_year_id = period.school_year_id
WHERE report_card.placement_id IS NULL
  AND period.id = report_card.academic_period_id
  AND period.tenant_id = report_card.tenant_id
  AND placement.tenant_id = report_card.tenant_id
  AND placement.student_id = report_card.student_id
  AND placement.class_id = report_card.class_id
  AND placement.track = report_card.track
  AND placement.placement_status IN ('ACTIVE', 'COMPLETED');

UPDATE attendance AS attendance_row
SET
  placement_id = placement.id,
  track = placement.track
FROM student_track_placements AS placement
WHERE attendance_row.placement_id IS NULL
  AND placement.tenant_id = attendance_row.tenant_id
  AND placement.student_id = attendance_row.student_id
  AND placement.school_year_id = attendance_row.school_year_id
  AND placement.class_id = attendance_row.class_id
  AND placement.track = attendance_row.track
  AND placement.placement_status IN ('ACTIVE', 'COMPLETED');

CREATE UNIQUE INDEX IF NOT EXISTS uq_grades_tenant_placement_subject_period_assess
  ON grades (tenant_id, placement_id, subject_id, academic_period_id, assessment_label);

CREATE INDEX IF NOT EXISTS idx_grades_tenant_placement_period
  ON grades (tenant_id, placement_id, academic_period_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_cards_tenant_placement_period
  ON report_cards (tenant_id, placement_id, academic_period_id);

CREATE INDEX IF NOT EXISTS idx_report_cards_tenant_placement_period
  ON report_cards (tenant_id, placement_id, academic_period_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_att_tenant_placement_date
  ON attendance (tenant_id, placement_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_att_tenant_placement_date
  ON attendance (tenant_id, placement_id, attendance_date);
