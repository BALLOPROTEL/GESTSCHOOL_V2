CREATE TABLE "payment_provider_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "payment_id" UUID,
  "provider" VARCHAR(40) NOT NULL,
  "mode" VARCHAR(20) NOT NULL,
  "provider_token" VARCHAR(160),
  "provider_payment_id" VARCHAR(160),
  "provider_status" VARCHAR(40) NOT NULL DEFAULT 'INITIATING',
  "amount" DECIMAL(14, 2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'CFA',
  "checkout_url" TEXT,
  "callback_payload" JSONB,
  "failure_reason" TEXT,
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_provider_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_provider_attempts_tenant_provider_token_key"
  ON "payment_provider_attempts"("tenant_id", "provider", "provider_token");

CREATE INDEX "idx_payment_attempts_invoice_status"
  ON "payment_provider_attempts"("tenant_id", "invoice_id", "provider_status");

CREATE INDEX "idx_payment_attempts_provider_payment"
  ON "payment_provider_attempts"("tenant_id", "provider_payment_id");

ALTER TABLE "payment_provider_attempts"
  ADD CONSTRAINT "payment_provider_attempts_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_provider_attempts"
  ADD CONSTRAINT "payment_provider_attempts_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
