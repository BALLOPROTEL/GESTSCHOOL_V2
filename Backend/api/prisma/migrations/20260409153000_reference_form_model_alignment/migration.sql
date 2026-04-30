ALTER TABLE school_years
  ADD COLUMN IF NOT EXISTS label VARCHAR(40),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS previous_year_id UUID,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT,
  ADD COLUMN IF NOT EXISTS comment VARCHAR(500);

UPDATE school_years
SET
  label = COALESCE(NULLIF(label, ''), code),
  status = CASE
    WHEN is_active THEN 'ACTIVE'
    ELSE COALESCE(NULLIF(status, ''), 'DRAFT')
  END,
  sort_order = COALESCE(sort_order, EXTRACT(YEAR FROM start_date)::INT)
WHERE label IS NULL
   OR label = ''
   OR status IS NULL
   OR status = ''
   OR sort_order IS NULL;

ALTER TABLE school_years
  ALTER COLUMN label SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_years_previous_year_id_fkey'
  ) THEN
    ALTER TABLE school_years
      ADD CONSTRAINT school_years_previous_year_id_fkey
      FOREIGN KEY (previous_year_id) REFERENCES school_years(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_years_tenant_id_label_key'
  ) THEN
    ALTER TABLE school_years
      ADD CONSTRAINT school_years_tenant_id_label_key UNIQUE (tenant_id, label);
  END IF;
END $$;

INSERT INTO school_years (
  tenant_id,
  code,
  label,
  start_date,
  end_date,
  status,
  is_active,
  is_default,
  sort_order,
  created_at,
  updated_at
)
SELECT DISTINCT
  cycles.tenant_id,
  'AS-LEGACY',
  'Legacy',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 day',
  'DRAFT',
  FALSE,
  FALSE,
  0,
  now(),
  now()
FROM cycles
WHERE NOT EXISTS (
  SELECT 1
  FROM school_years
  WHERE school_years.tenant_id = cycles.tenant_id
);

ALTER TABLE cycles
  ADD COLUMN IF NOT EXISTS school_year_id UUID,
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS theoretical_age_min INT,
  ADD COLUMN IF NOT EXISTS theoretical_age_max INT,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

UPDATE cycles AS cycle_to_update
SET school_year_id = (
  SELECT id
  FROM school_years
  WHERE school_years.tenant_id = cycle_to_update.tenant_id
  ORDER BY is_active DESC, start_date DESC, created_at DESC
  LIMIT 1
)
WHERE cycle_to_update.school_year_id IS NULL;

ALTER TABLE cycles
  ALTER COLUMN school_year_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycles_school_year_id_fkey'
  ) THEN
    ALTER TABLE cycles
      ADD CONSTRAINT cycles_school_year_id_fkey
      FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycles_tenant_id_code_key'
  ) THEN
    ALTER TABLE cycles DROP CONSTRAINT cycles_tenant_id_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cycles_tenant_id_school_year_id_code_key'
  ) THEN
    ALTER TABLE cycles
      ADD CONSTRAINT cycles_tenant_id_school_year_id_code_key
      UNIQUE (tenant_id, school_year_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cycles_school_year_id
  ON cycles (school_year_id);

ALTER TABLE levels
  ADD COLUMN IF NOT EXISTS alias VARCHAR(50),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS theoretical_age INT,
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS default_section VARCHAR(100);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'levels_tenant_id_track_code_key'
  ) THEN
    ALTER TABLE levels DROP CONSTRAINT levels_tenant_id_track_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'levels_tenant_id_cycle_id_code_key'
  ) THEN
    ALTER TABLE levels
      ADD CONSTRAINT levels_tenant_id_cycle_id_code_key
      UNIQUE (tenant_id, cycle_id, code);
  END IF;
END $$;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS homeroom_teacher_name VARCHAR(140),
  ADD COLUMN IF NOT EXISTS main_room VARCHAR(80),
  ADD COLUMN IF NOT EXISTS actual_capacity INT,
  ADD COLUMN IF NOT EXISTS filiere VARCHAR(100),
  ADD COLUMN IF NOT EXISTS series VARCHAR(100),
  ADD COLUMN IF NOT EXISTS speciality VARCHAR(120),
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS teaching_mode VARCHAR(40);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_tenant_id_school_year_id_track_code_key'
  ) THEN
    ALTER TABLE classes DROP CONSTRAINT classes_tenant_id_school_year_id_track_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'classes_tenant_id_school_year_id_code_key'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_tenant_id_school_year_id_code_key
      UNIQUE (tenant_id, school_year_id, code);
  END IF;
END $$;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS nature VARCHAR(30) NOT NULL DEFAULT 'FRANCOPHONE',
  ADD COLUMN IF NOT EXISTS short_label VARCHAR(60),
  ADD COLUMN IF NOT EXISTS default_coefficient DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS weekly_hours DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS is_graded BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE subjects
SET nature = CASE
  WHEN is_arabic THEN 'ARABOPHONE'
  ELSE 'FRANCOPHONE'
END
WHERE nature IS NULL
   OR nature = '';

ALTER TABLE academic_periods
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS parent_period_id UUID,
  ADD COLUMN IF NOT EXISTS is_grade_entry_open BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS grade_entry_deadline DATE,
  ADD COLUMN IF NOT EXISTS lock_date DATE,
  ADD COLUMN IF NOT EXISTS comment VARCHAR(500);

WITH ranked_periods AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, school_year_id
      ORDER BY start_date ASC, end_date ASC, created_at ASC
    ) AS next_sort_order
  FROM academic_periods
)
UPDATE academic_periods
SET sort_order = ranked_periods.next_sort_order
FROM ranked_periods
WHERE academic_periods.id = ranked_periods.id
  AND (academic_periods.sort_order IS NULL OR academic_periods.sort_order = 1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_periods_parent_period_id_fkey'
  ) THEN
    ALTER TABLE academic_periods
      ADD CONSTRAINT academic_periods_parent_period_id_fkey
      FOREIGN KEY (parent_period_id) REFERENCES academic_periods(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_academic_periods_parent_period_id
  ON academic_periods (parent_period_id);

CREATE TABLE IF NOT EXISTS subject_level_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subject_level_scopes_tenant_id_subject_id_level_id_key'
  ) THEN
    ALTER TABLE subject_level_scopes
      ADD CONSTRAINT subject_level_scopes_tenant_id_subject_id_level_id_key
      UNIQUE (tenant_id, subject_id, level_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subject_level_scopes_level
  ON subject_level_scopes (tenant_id, level_id);
