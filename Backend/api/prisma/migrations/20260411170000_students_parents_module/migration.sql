ALTER TABLE students
  ADD COLUMN IF NOT EXISTS establishment_id UUID,
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS administrative_notes VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS internal_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS birth_certificate_no VARCHAR(80),
  ADD COLUMN IF NOT EXISTS special_needs VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS primary_language VARCHAR(60),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  parental_role VARCHAR(40) NOT NULL DEFAULT 'OTHER',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  sex CHAR(1),
  primary_phone VARCHAR(30) NOT NULL,
  secondary_phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  profession VARCHAR(120),
  identity_document_type VARCHAR(40),
  identity_document_number VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  establishment_id UUID,
  user_id UUID,
  notes VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parents_user_id_key'
  ) THEN
    ALTER TABLE parents
      ADD CONSTRAINT parents_user_id_key UNIQUE (user_id);
  END IF;
END $$;

ALTER TABLE parents
  DROP CONSTRAINT IF EXISTS parents_user_id_fkey;

ALTER TABLE parents
  ADD CONSTRAINT parents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_parents_tenant_status
  ON parents (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_parents_tenant_role
  ON parents (tenant_id, parental_role);

CREATE INDEX IF NOT EXISTS idx_parents_tenant_email
  ON parents (tenant_id, email);

ALTER TABLE parent_student_links
  DROP CONSTRAINT IF EXISTS parent_student_links_parent_user_id_fkey;

ALTER TABLE parent_student_links
  ALTER COLUMN parent_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS parent_id UUID,
  ADD COLUMN IF NOT EXISTS relation_type VARCHAR(40),
  ADD COLUMN IF NOT EXISTS is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lives_with_student BOOLEAN,
  ADD COLUMN IF NOT EXISTS pickup_authorized BOOLEAN,
  ADD COLUMN IF NOT EXISTS legal_guardian BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_responsible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS comment VARCHAR(500),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE parent_student_links
  ADD CONSTRAINT parent_student_links_parent_user_id_fkey
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE parent_student_links
  DROP CONSTRAINT IF EXISTS parent_student_links_parent_id_fkey;

ALTER TABLE parent_student_links
  ADD CONSTRAINT parent_student_links_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE parent_student_links
SET
  relation_type = COALESCE(NULLIF(relation_type, ''), NULLIF(relationship, ''), 'OTHER'),
  is_primary_contact = is_primary,
  updated_at = now()
WHERE relation_type IS NULL OR is_primary_contact IS DISTINCT FROM is_primary;

INSERT INTO parents (
  id,
  tenant_id,
  parental_role,
  first_name,
  last_name,
  primary_phone,
  email,
  status,
  user_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  source.tenant_id,
  COALESCE(NULLIF(source.relationship, ''), 'OTHER'),
  'Parent',
  COALESCE(NULLIF(split_part(users.username, '@', 1), ''), 'Portail'),
  'A renseigner',
  CASE WHEN position('@' in users.username) > 1 THEN users.username ELSE NULL END,
  CASE WHEN users.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
  users.id,
  now(),
  now()
FROM (
  SELECT DISTINCT tenant_id, parent_user_id, max(relationship) AS relationship
  FROM parent_student_links
  WHERE parent_user_id IS NOT NULL
  GROUP BY tenant_id, parent_user_id
) AS source
JOIN users ON users.id = source.parent_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM parents WHERE parents.user_id = users.id
);

UPDATE parent_student_links links
SET
  parent_id = parents.id,
  updated_at = now()
FROM parents
WHERE links.parent_user_id = parents.user_id
  AND links.parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_parent_links_tenant_parent_profile
  ON parent_student_links (tenant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_links_tenant_status
  ON parent_student_links (tenant_id, status);

COMMENT ON TABLE parents IS
  'Parent/tuteur metier distinct du compte utilisateur portail optionnel.';

COMMENT ON COLUMN parent_student_links.parent_user_id IS
  'Lien legacy optionnel vers le compte portail parent. La verite metier est parent_id quand renseigne.';

COMMENT ON COLUMN parent_student_links.parent_id IS
  'Lien vers la fiche Parent metier.';
