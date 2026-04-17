CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  matricule VARCHAR(40) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  sex CHAR(1),
  birth_date DATE,
  primary_phone VARCHAR(30),
  secondary_phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  photo_url TEXT,
  nationality VARCHAR(80),
  identity_document_type VARCHAR(40),
  identity_document_number VARCHAR(80),
  hire_date DATE,
  teacher_type VARCHAR(30) NOT NULL DEFAULT 'TITULAIRE',
  speciality VARCHAR(140),
  main_diploma VARCHAR(140),
  teaching_language VARCHAR(60),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  establishment_id UUID,
  user_id UUID,
  internal_notes VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teachers_tenant_id_matricule_key'
  ) THEN
    ALTER TABLE teachers
      ADD CONSTRAINT teachers_tenant_id_matricule_key UNIQUE (tenant_id, matricule);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teachers_tenant_id_email_key'
  ) THEN
    ALTER TABLE teachers
      ADD CONSTRAINT teachers_tenant_id_email_key UNIQUE (tenant_id, email);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teachers_user_id_key'
  ) THEN
    ALTER TABLE teachers
      ADD CONSTRAINT teachers_user_id_key UNIQUE (user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teachers_tenant_status
  ON teachers (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_teachers_tenant_type
  ON teachers (tenant_id, teacher_type);

CREATE TABLE IF NOT EXISTS teacher_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  level_id UUID REFERENCES levels(id) ON DELETE SET NULL,
  qualification VARCHAR(140),
  years_experience INT,
  priority INT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_skills_scope_key'
  ) THEN
    ALTER TABLE teacher_skills
      ADD CONSTRAINT teacher_skills_scope_key
      UNIQUE (tenant_id, teacher_id, subject_id, cycle_id, level_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_skills_tenant_teacher
  ON teacher_skills (tenant_id, teacher_id);

CREATE INDEX IF NOT EXISTS idx_teacher_skills_tenant_subject
  ON teacher_skills (tenant_id, subject_id);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
  workload_hours DECIMAL(6, 2),
  coefficient DECIMAL(6, 2),
  is_homeroom_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  role VARCHAR(60),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_scope_key'
  ) THEN
    ALTER TABLE teacher_assignments
      ADD CONSTRAINT teacher_assignments_scope_key
      UNIQUE (tenant_id, teacher_id, school_year_id, class_id, subject_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_teacher_status
  ON teacher_assignments (tenant_id, teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_year_class
  ON teacher_assignments (tenant_id, school_year_id, class_id);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_tenant_subject
  ON teacher_assignments (tenant_id, subject_id);

CREATE TABLE IF NOT EXISTS teacher_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  document_type VARCHAR(40) NOT NULL,
  file_url TEXT NOT NULL,
  original_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(120),
  size INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_teacher_documents_tenant_teacher_status
  ON teacher_documents (tenant_id, teacher_id, status);
