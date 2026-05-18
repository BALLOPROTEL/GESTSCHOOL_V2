ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ(6);

UPDATE users
SET
  status = CASE
    WHEN deleted_at IS NOT NULL THEN 'ARCHIVED'
    WHEN is_active = false THEN 'INACTIVE'
    ELSE status
  END,
  activated_at = CASE
    WHEN is_active = true AND activated_at IS NULL THEN created_at
    ELSE activated_at
  END,
  disabled_at = CASE
    WHEN is_active = false AND disabled_at IS NULL THEN updated_at
    ELSE disabled_at
  END;

CREATE TABLE IF NOT EXISTS user_security_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type VARCHAR(30) NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  used_at TIMESTAMPTZ(6),
  consumed_ip VARCHAR(80),
  consumed_user_agent VARCHAR(500),
  metadata JSONB,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT user_security_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_security_tokens_token_hash_key
  ON user_security_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_user_security_tokens_user_id
  ON user_security_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_security_tokens_tenant_type_expires
  ON user_security_tokens(tenant_id, type, expires_at);

CREATE INDEX IF NOT EXISTS idx_users_tenant_status
  ON users(tenant_id, status);
