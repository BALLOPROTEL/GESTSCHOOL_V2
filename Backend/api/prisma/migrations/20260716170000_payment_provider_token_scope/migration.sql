BEGIN;

-- Public provider callbacks resolve an attempt from (provider, provider_token)
-- without tenant context. Abort if historical data would make that lookup
-- ambiguous before replacing the tenant-scoped index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM payment_provider_attempts
    WHERE provider_token IS NOT NULL
    GROUP BY provider, provider_token
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT6_DUPLICATE_GLOBAL_PAYMENT_PROVIDER_TOKEN';
  END IF;
END $$;

DROP INDEX payment_provider_attempts_tenant_provider_token_key;

CREATE UNIQUE INDEX uq_payment_attempts_provider_token
  ON payment_provider_attempts (provider, provider_token)
  WHERE provider_token IS NOT NULL;

COMMIT;
