ALTER TABLE teacher_skills
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

ALTER TABLE teacher_assignments
  ADD COLUMN IF NOT EXISTS track "AcademicTrack" NOT NULL DEFAULT 'FRANCOPHONE';

ALTER TABLE teacher_skills
  DROP CONSTRAINT IF EXISTS teacher_skills_scope_key;

ALTER TABLE teacher_skills
  ADD CONSTRAINT teacher_skills_scope_key
  UNIQUE (tenant_id, teacher_id, subject_id, track, cycle_id, level_id);

ALTER TABLE teacher_assignments
  DROP CONSTRAINT IF EXISTS teacher_assignments_scope_key;

ALTER TABLE teacher_assignments
  ADD CONSTRAINT teacher_assignments_scope_key
  UNIQUE (tenant_id, teacher_id, school_year_id, class_id, subject_id, track);

CREATE INDEX IF NOT EXISTS idx_teacher_skills_tenant_track
  ON teacher_skills (tenant_id, track);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_track
  ON teacher_assignments (tenant_id, track);

COMMENT ON COLUMN teacher_skills.track IS
  'Cursus pedagogique de competence: FRANCOPHONE ou ARABOPHONE. Les lignes existantes sont regularisees en FRANCOPHONE par defaut.';

COMMENT ON COLUMN teacher_assignments.track IS
  'Cursus pedagogique de l''affectation: FRANCOPHONE ou ARABOPHONE. Les lignes existantes sont regularisees en FRANCOPHONE par defaut.';
