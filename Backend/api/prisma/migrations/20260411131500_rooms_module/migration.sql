CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_types_tenant_id_code_key'
  ) THEN
    ALTER TABLE room_types
      ADD CONSTRAINT room_types_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_types_tenant_status
  ON room_types (tenant_id, status);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  building VARCHAR(120),
  floor VARCHAR(40),
  location VARCHAR(180),
  description VARCHAR(500),
  room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  capacity INT NOT NULL,
  exam_capacity INT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  is_shared_between_curricula BOOLEAN NOT NULL DEFAULT TRUE,
  default_track "AcademicTrack",
  establishment_id UUID,
  notes VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rooms_tenant_id_code_key'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_tenant_id_code_key UNIQUE (tenant_id, code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rooms_tenant_status
  ON rooms (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_rooms_tenant_type
  ON rooms (tenant_id, room_type_id);

CREATE INDEX IF NOT EXISTS idx_rooms_tenant_default_track
  ON rooms (tenant_id, default_track);

CREATE TABLE IF NOT EXISTS room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  level_id UUID REFERENCES levels(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES cycles(id) ON DELETE SET NULL,
  track "AcademicTrack",
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
  assignment_type VARCHAR(40) NOT NULL DEFAULT 'SHARED_ROOM',
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'room_assignments_scope_key'
  ) THEN
    ALTER TABLE room_assignments
      ADD CONSTRAINT room_assignments_scope_key
      UNIQUE (tenant_id, room_id, school_year_id, class_id, level_id, cycle_id, track, subject_id, period_id, assignment_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_room_assignments_tenant_room_status
  ON room_assignments (tenant_id, room_id, status);

CREATE INDEX IF NOT EXISTS idx_room_assignments_tenant_year_status
  ON room_assignments (tenant_id, school_year_id, status);

CREATE INDEX IF NOT EXISTS idx_room_assignments_tenant_track
  ON room_assignments (tenant_id, track);

CREATE TABLE IF NOT EXISTS room_availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  day_of_week INT,
  start_time CHAR(5),
  end_time CHAR(5),
  availability_type VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
  school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL,
  period_id UUID REFERENCES academic_periods(id) ON DELETE SET NULL,
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_availabilities_tenant_room_type
  ON room_availabilities (tenant_id, room_id, availability_type);

CREATE INDEX IF NOT EXISTS idx_room_availabilities_tenant_year
  ON room_availabilities (tenant_id, school_year_id);
