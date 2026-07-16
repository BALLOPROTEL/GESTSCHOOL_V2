-- LOT 5: durable notification leases, lifecycle states and provider callback replay protection.
-- This migration intentionally fails before writes if the existing tenant-scoped
-- idempotency invariant has already been violated.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM notifications
    WHERE idempotency_key IS NOT NULL
    GROUP BY tenant_id, idempotency_key
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LOT 5 preflight failed: duplicate notification idempotency keys exist';
  END IF;
END $$;

ALTER TABLE notifications
  ALTER COLUMN status TYPE VARCHAR(30),
  ADD COLUMN template_version VARCHAR(40) NOT NULL DEFAULT 'v1',
  ADD COLUMN locked_at TIMESTAMPTZ(6),
  ADD COLUMN locked_by VARCHAR(120),
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ(6),
  ADD COLUMN last_attempt_at TIMESTAMPTZ(6),
  ADD COLUMN dead_lettered_at TIMESTAMPTZ(6),
  ADD COLUMN cancelled_at TIMESTAMPTZ(6),
  ADD COLUMN delivery_outcome_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN replay_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_replayed_at TIMESTAMPTZ(6),
  ADD COLUMN last_replayed_by_user_id UUID;

ALTER TABLE notifications
  ALTER COLUMN delivery_status SET DEFAULT 'PENDING';

UPDATE notifications
SET idempotency_key = 'legacy-notification:' || id::text
WHERE idempotency_key IS NULL OR btrim(idempotency_key) = '';

ALTER TABLE notifications
  ALTER COLUMN idempotency_key SET NOT NULL;

UPDATE notifications
SET status = CASE
  WHEN status IN ('PENDING', 'SCHEDULED') THEN 'PENDING'
  WHEN status = 'SENT' AND delivery_status = 'DELIVERED' THEN 'DELIVERED'
  WHEN status = 'SENT' THEN 'SENT'
  WHEN status = 'FAILED' THEN 'FAILED_PERMANENT'
  ELSE 'FAILED_PERMANENT'
END;

UPDATE notifications
SET delivery_status = status;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_lifecycle_status_check CHECK (
    status IN (
      'PENDING',
      'PROCESSING',
      'SENT',
      'DELIVERED',
      'FAILED_RETRYABLE',
      'FAILED_PERMANENT',
      'DEAD_LETTER',
      'CANCELLED'
    )
  ),
  ADD CONSTRAINT notifications_attempts_nonnegative_check CHECK (attempts >= 0),
  ADD CONSTRAINT notifications_replay_count_nonnegative_check CHECK (replay_count >= 0);

CREATE INDEX idx_notif_dispatch_queue
  ON notifications(status, next_attempt_at, lease_expires_at);

ALTER TABLE notification_delivery_attempts
  ADD COLUMN worker_id VARCHAR(120),
  ADD COLUMN lease_token UUID,
  ADD COLUMN retryable BOOLEAN,
  ADD COLUMN outcome_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN http_status INTEGER,
  ADD COLUMN retry_after_at TIMESTAMPTZ(6);

ALTER TABLE notification_delivery_attempts
  ADD CONSTRAINT notification_attempt_http_status_check CHECK (
    http_status IS NULL OR (http_status >= 100 AND http_status <= 599)
  );

ALTER TABLE notification_provider_callbacks
  ADD COLUMN provider_event_id VARCHAR(160),
  ADD COLUMN signature_timestamp TIMESTAMPTZ(6);

CREATE UNIQUE INDEX uq_notif_callbacks_tenant_provider_event
  ON notification_provider_callbacks(tenant_id, provider, provider_event_id);

ALTER TABLE outbox_events
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ(6);

UPDATE outbox_events
SET status = 'DEAD_LETTER'
WHERE status = 'FAILED';

ALTER TABLE outbox_events
  ADD CONSTRAINT outbox_events_status_check CHECK (
    status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER', 'CANCELLED')
  ),
  ADD CONSTRAINT outbox_events_attempts_nonnegative_check CHECK (attempts >= 0);

CREATE INDEX idx_outbox_events_status_lease_expires_at
  ON outbox_events(status, lease_expires_at);
