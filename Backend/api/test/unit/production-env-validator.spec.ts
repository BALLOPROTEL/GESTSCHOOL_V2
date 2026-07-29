const { validateProductionEnv } = require("../../scripts/validate-production-env.cjs") as {
  validateProductionEnv: (env: NodeJS.ProcessEnv) => {
    errors: string[];
    warnings: string[];
  };
};

const strongSecret = "a-strong-production-secret-with-32-characters";

const validEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  GESTSCHOOL_RUNTIME_ENV: "production",
  GESTSCHOOL_PROCESS_ROLE: "api",
  DATABASE_URL: "postgresql://gestschool:password@db.example.com:5432/gestschool",
  DIRECT_URL: "postgresql://gestschool:password@db-direct.example.com:5432/gestschool",
  CORS_ORIGINS: "https://gestschool.vercel.app",
  REDIS_URL: "rediss://default:redis-password@redis.example.com:6379",
  TRUST_PROXY_HOPS: "1",
  RATE_LIMIT_DISABLED: "false",
  JWT_ISSUER: "gestschool",
  JWT_AUDIENCE: "gestschool-clients",
  JWT_SECRET: strongSecret,
  PASSWORD_RESET_SECRET: `${strongSecret}-reset`,
  DEFAULT_TENANT_ID: "00000000-0000-4000-8000-000000000001",
  FILE_STORAGE_DRIVER: "SUPABASE",
  STORAGE_PROVIDER: "supabase",
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: `${strongSecret}-supabase`,
  SUPABASE_STORAGE_BUCKET_DOCUMENTS: "gestschool-documents",
  SUPABASE_STORAGE_BUCKET_AVATARS: "gestschool-avatars",
  SUPABASE_STORAGE_AVATARS_PUBLIC: "false",
  SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS: "300",
  MONITORING_METRICS_TOKEN: `${strongSecret}-metrics`,
  SWAGGER_ENABLED: "false",
  NOTIFICATIONS_EMAIL_ENABLED: "false",
  NOTIFICATIONS_SMS_ENABLED: "false",
  NOTIFICATIONS_WORKER_ENABLED: "false",
  OUTBOX_IN_PROCESS_ENABLED: "false"
});

const validNotificationEnv = (): NodeJS.ProcessEnv => ({
  ...validEnv(),
  GESTSCHOOL_PROCESS_ROLE: "worker",
  WORKER_HEALTH_PORT: "3001",
  NOTIFICATIONS_WORKER_ENABLED: "true",
  OUTBOX_IN_PROCESS_ENABLED: "false",
  NOTIFICATIONS_EMAIL_ENABLED: "true",
  NOTIFICATIONS_SMS_ENABLED: "false",
  NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
  NOTIFICATIONS_SMS_PROVIDER: "MOCK",
  BREVO_API_KEY: `${strongSecret}-brevo`,
  BREVO_SENDER_EMAIL: "no-reply@example.com",
  BREVO_SMS_DRY_RUN: "true",
  BREVO_TIMEOUT_MS: "8000",
  NOTIFICATION_WEBHOOK_SIGNING_SECRET: `${strongSecret}-webhook`,
  NOTIFICATION_WEBHOOK_REPLAY_WINDOW_SECONDS: "300",
  OUTBOX_CLAIM_TTL_SECONDS: "120",
  OUTBOX_MAX_ATTEMPTS: "6",
  OUTBOX_RETRY_BASE_SECONDS: "15",
  OUTBOX_RETRY_MAX_SECONDS: "600",
  NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS: "120",
  NOTIFY_MAX_ATTEMPTS: "5",
  NOTIFY_RETRY_BASE_SECONDS: "30",
  NOTIFY_RETRY_MAX_SECONDS: "7200"
});

describe("production environment validator", () => {
  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(validEnv())).toEqual({ errors: [], warnings: [] });
  });

  it("rejects the historical tenant", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      DEFAULT_TENANT_ID: "00000000-0000-0000-0000-000000000001"
    });

    expect(result.errors).toContain("DEFAULT_TENANT_ID must be a valid versioned UUID.");
    expect(result.warnings).toEqual([]);
  });

  it("rejects every other UUID-shaped non-versioned tenant id", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      DEFAULT_TENANT_ID: "11111111-1111-0111-8111-111111111111"
    });

    expect(result.errors).toContain("DEFAULT_TENANT_ID must be a valid versioned UUID.");
    expect(result.warnings).toEqual([]);
  });

  it("rejects a missing production tenant id", () => {
    const env = validEnv();
    delete env.DEFAULT_TENANT_ID;

    const result = validateProductionEnv(env);

    expect(result.errors).toContain("DEFAULT_TENANT_ID is required in production.");
    expect(result.warnings).toEqual([]);
  });

  it("does not enforce production-only variables in development", () => {
    expect(validateProductionEnv({ NODE_ENV: "development" })).toEqual({
      errors: [],
      warnings: []
    });
  });

  it("requires an explicit supported runtime environment for production images", () => {
    const missing = validEnv();
    delete missing.GESTSCHOOL_RUNTIME_ENV;
    expect(validateProductionEnv(missing).errors).toContain(
      "GESTSCHOOL_RUNTIME_ENV is required when NODE_ENV=production."
    );

    expect(
      validateProductionEnv({
        ...validEnv(),
        GESTSCHOOL_RUNTIME_ENV: "local"
      }).errors
    ).toContain(
      "GESTSCHOOL_RUNTIME_ENV must be rc, staging or production when NODE_ENV=production."
    );
    expect(
      validateProductionEnv({
        NODE_ENV: "test",
        GESTSCHOOL_RUNTIME_ENV: "unexpected"
      }).errors
    ).toContain(
      "GESTSCHOOL_RUNTIME_ENV must be local, test, rc, staging or production."
    );
  });

  it("rejects weak secrets, wildcard CORS and malformed tenant ids", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      CORS_ORIGINS: "*",
      JWT_SECRET: "change-me",
      PASSWORD_RESET_SECRET: "short",
      DEFAULT_TENANT_ID: "tenant-1"
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "JWT_SECRET must be a non-placeholder secret of at least 32 characters.",
        "PASSWORD_RESET_SECRET must be a non-placeholder secret of at least 32 characters.",
        "DEFAULT_TENANT_ID must be a valid versioned UUID.",
        "CORS_ORIGINS must not contain * in production."
      ])
    );
  });

  it("accepts the Supabase transaction pooler only for DATABASE_URL", () => {
    const env = {
      ...validEnv(),
      DATABASE_URL:
        "postgresql://postgres.project-ref:password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1",
      DIRECT_URL: "postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres"
    };

    expect(validateProductionEnv(env)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects an unqualified Supabase pooler user and a transaction DIRECT_URL", () => {
    const poolerUrl =
      "postgresql://postgres:password@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    const result = validateProductionEnv({
      ...validEnv(),
      DATABASE_URL: poolerUrl,
      DIRECT_URL: poolerUrl
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("username is not tenant-qualified"),
        expect.stringContaining("DIRECT_URL must not use the Supabase transaction pooler")
      ])
    );
  });

  it("rejects CORS URLs with non-HTTPS schemes or paths", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      CORS_ORIGINS: "http://gestschool.vercel.app,https://school.example.com/app"
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "CORS_ORIGINS entry http://gestschool.vercel.app must use https:// in production.",
        "CORS_ORIGINS entry https://school.example.com/app must be an origin without path, query or fragment."
      ])
    );
  });

  it("requires Redis, a bounded trusted proxy and active rate limiting", () => {
    const env = validEnv();
    delete env.REDIS_URL;
    delete env.TRUST_PROXY_HOPS;
    env.RATE_LIMIT_DISABLED = "true";

    const result = validateProductionEnv(env);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "REDIS_URL is required in production.",
        "RATE_LIMIT_DISABLED must not be enabled in production.",
        "TRUST_PROXY_HOPS is required in production.",
        "TRUST_PROXY_HOPS must be an integer between 1 and 5 in production."
      ])
    );
  });

  it("rejects incomplete JWT and unsafe production storage configuration", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      JWT_ISSUER: "",
      JWT_AUDIENCE: "placeholder",
      FILE_STORAGE_DRIVER: "LOCAL",
      STORAGE_PROVIDER: "local"
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "JWT_ISSUER is required in production.",
        "JWT_AUDIENCE must not be a placeholder value.",
        "FILE_STORAGE_DRIVER must be SUPABASE in production.",
        "STORAGE_PROVIDER must be supabase in production."
      ])
    );
  });

  it("requires distinct private storage buckets and a bounded signed URL lifetime", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      SUPABASE_STORAGE_BUCKET_DOCUMENTS: "shared-bucket",
      SUPABASE_STORAGE_BUCKET_AVATARS: "shared-bucket",
      SUPABASE_STORAGE_AVATARS_PUBLIC: "true",
      SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS: "3600"
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "SUPABASE_STORAGE_BUCKET_DOCUMENTS and SUPABASE_STORAGE_BUCKET_AVATARS must be distinct.",
        "SUPABASE_STORAGE_AVATARS_PUBLIC must be false in production.",
        "SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS must be an integer between 60 and 900."
      ])
    );
  });

  it("requires provider credentials only when notification processing is enabled", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      OUTBOX_IN_PROCESS_ENABLED: "true",
      NOTIFICATIONS_EMAIL_ENABLED: "true",
      NOTIFICATIONS_SMS_ENABLED: "true",
      NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
      NOTIFICATIONS_SMS_PROVIDER: "BREVO",
      BREVO_SMS_DRY_RUN: "true"
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "BREVO_API_KEY is required in production.",
        "BREVO_SENDER_EMAIL is required in production."
      ])
    );
  });

  it("validates Brevo credentials for synchronous API authentication emails", () => {
    const invalid = validateProductionEnv({
      ...validEnv(),
      NOTIFICATIONS_EMAIL_ENABLED: "true",
      NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
      NOTIFICATIONS_SMS_PROVIDER: "MOCK"
    });

    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        "BREVO_API_KEY is required in production.",
        "BREVO_SENDER_EMAIL is required in production.",
        "BREVO_TIMEOUT_MS is required in production."
      ])
    );

    expect(
      validateProductionEnv({
        ...validEnv(),
        NOTIFICATIONS_EMAIL_ENABLED: "true",
        NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
        NOTIFICATIONS_SMS_PROVIDER: "MOCK",
        BREVO_API_KEY: `${strongSecret}-brevo`,
        BREVO_SENDER_EMAIL: "no-reply@example.com",
        BREVO_TIMEOUT_MS: "8000"
      })
    ).toEqual({ errors: [], warnings: [] });
  });

  it("accepts a complete durable notification configuration", () => {
    expect(validateProductionEnv(validNotificationEnv())).toEqual({
      errors: [],
      warnings: []
    });
  });

  it("enforces one explicit production process role", () => {
    const missingRole = validEnv();
    delete missingRole.GESTSCHOOL_PROCESS_ROLE;

    expect(validateProductionEnv(missingRole).errors).toContain(
      "GESTSCHOOL_PROCESS_ROLE is required in production."
    );
    expect(
      validateProductionEnv({
        ...validEnv(),
        GESTSCHOOL_PROCESS_ROLE: "scheduler"
      }).errors
    ).toContain("GESTSCHOOL_PROCESS_ROLE must be api or worker.");
  });

  it("rejects background processing inside the production API", () => {
    const result = validateProductionEnv({
      ...validNotificationEnv(),
      GESTSCHOOL_PROCESS_ROLE: "api",
      NOTIFICATIONS_WORKER_ENABLED: "false",
      OUTBOX_IN_PROCESS_ENABLED: "true"
    });

    expect(result.errors).toContain(
      "OUTBOX_IN_PROCESS_ENABLED must be false for the production API; deploy a dedicated worker."
    );
  });

  it("requires one dedicated worker strategy and its health port", () => {
    const result = validateProductionEnv({
      ...validNotificationEnv(),
      NOTIFICATIONS_WORKER_ENABLED: "false",
      WORKER_HEALTH_PORT: ""
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "NOTIFICATIONS_WORKER_ENABLED must be true for the worker process.",
        "WORKER_HEALTH_PORT is required in production."
      ])
    );
  });

  it("rejects simultaneous in-process and dedicated workers", () => {
    const result = validateProductionEnv({
      ...validNotificationEnv(),
      OUTBOX_IN_PROCESS_ENABLED: "true"
    });

    expect(result.errors).toContain(
      "NOTIFICATIONS_WORKER_ENABLED and OUTBOX_IN_PROCESS_ENABLED must not both be enabled."
    );
  });

  it("requires protected monitoring and disables Swagger for the production API", () => {
    const env = validEnv();
    delete env.MONITORING_METRICS_TOKEN;
    env.SWAGGER_ENABLED = "true";

    const result = validateProductionEnv(env);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "MONITORING_METRICS_TOKEN is required in production.",
        "SWAGGER_ENABLED must be false for the production API."
      ])
    );
  });

  it("requires a strong bearer credential and bounded age for enabled Brevo webhooks", () => {
    const missing = validateProductionEnv({
      ...validEnv(),
      BREVO_WEBHOOK_ENABLED: "true",
      BREVO_WEBHOOK_AUTH_TOKEN: "",
      BREVO_WEBHOOK_MAX_AGE_SECONDS: ""
    });
    expect(missing.errors).toEqual(
      expect.arrayContaining([
        "BREVO_WEBHOOK_AUTH_TOKEN is required in production.",
        "BREVO_WEBHOOK_MAX_AGE_SECONDS is required in production."
      ])
    );

    expect(
      validateProductionEnv({
        ...validEnv(),
        BREVO_WEBHOOK_ENABLED: "true",
        BREVO_WEBHOOK_AUTH_TOKEN: `${strongSecret}-brevo-webhook`,
        BREVO_WEBHOOK_MAX_AGE_SECONDS: "90000"
      })
    ).toEqual({ errors: [], warnings: [] });
  });

  it("accepts an email-only Brevo worker while SMS remains safely mocked", () => {
    expect(validateProductionEnv(validNotificationEnv())).toEqual({
      errors: [],
      warnings: []
    });
  });

  it("accepts MOCK channels in an RC only with the dedicated explicit authorization", () => {
    const rc: NodeJS.ProcessEnv = {
      ...validNotificationEnv(),
      GESTSCHOOL_RUNTIME_ENV: "rc",
      NOTIFICATIONS_EMAIL_ENABLED: "true",
      NOTIFICATIONS_SMS_ENABLED: "true",
      NOTIFICATIONS_EMAIL_PROVIDER: "MOCK",
      NOTIFICATIONS_SMS_PROVIDER: "MOCK"
    };
    delete rc.BREVO_API_KEY;
    delete rc.BREVO_SENDER_EMAIL;
    delete rc.BREVO_TIMEOUT_MS;

    expect(validateProductionEnv(rc).errors).toContain(
      "RC mock notification providers require ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC=true."
    );

    const accepted = validateProductionEnv({
      ...rc,
      ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC: "true"
    });
    expect(accepted.errors).toEqual([]);
    expect(accepted.warnings).toContain(
      "RC-only MOCK provider enabled for: email, sms."
    );
  });

  it("never permits the RC MOCK authorization in staging or production", () => {
    const production = validateProductionEnv({
      ...validNotificationEnv(),
      ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC: "true"
    });
    expect(production.errors).toContain(
      "ALLOW_MOCK_NOTIFICATION_PROVIDERS_IN_RC may only be true when GESTSCHOOL_RUNTIME_ENV=rc."
    );

    const staging = validateProductionEnv({
      ...validNotificationEnv(),
      GESTSCHOOL_RUNTIME_ENV: "staging",
      NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
      NOTIFICATIONS_SMS_PROVIDER: "MOCK",
      NOTIFICATIONS_SMS_ENABLED: "true"
    });
    expect(staging.errors).toContain(
      "Enabled notification channels must not use MOCK in staging: sms."
    );
  });

  it("accepts staging email-only only when the mocked SMS channel is disabled", () => {
    expect(
      validateProductionEnv({
        ...validNotificationEnv(),
        GESTSCHOOL_RUNTIME_ENV: "staging",
        NOTIFICATIONS_EMAIL_ENABLED: "true",
        NOTIFICATIONS_SMS_ENABLED: "false",
        NOTIFICATIONS_EMAIL_PROVIDER: "BREVO",
        NOTIFICATIONS_SMS_PROVIDER: "MOCK",
        BREVO_SMS_DRY_RUN: "true",
        ALLOW_REAL_SMS: "false"
      })
    ).toEqual({ errors: [], warnings: [] });
  });

  it("requires both explicit flags before enabling real Brevo SMS", () => {
    const dryRunDisabled = {
      ...validNotificationEnv(),
      NOTIFICATIONS_SMS_ENABLED: "true",
      NOTIFICATIONS_SMS_PROVIDER: "BREVO",
      BREVO_SMS_DRY_RUN: "false",
      BREVO_SMS_SENDER: "AlManarat"
    };
    expect(validateProductionEnv(dryRunDisabled).errors).toContain(
      "ALLOW_REAL_SMS must be true when BREVO_SMS_DRY_RUN is false."
    );

    expect(
      validateProductionEnv({
        ...dryRunDisabled,
        ALLOW_REAL_SMS: "true"
      })
    ).toEqual({ errors: [], warnings: [] });
  });

  it("requires the timeout for the provider that is actually enabled", () => {
    const brevo = validNotificationEnv();
    delete brevo.BREVO_TIMEOUT_MS;

    const webhook: NodeJS.ProcessEnv = {
      ...validNotificationEnv(),
      NOTIFICATIONS_EMAIL_PROVIDER: "WEBHOOK",
      NOTIFICATIONS_SMS_PROVIDER: "WEBHOOK",
      NOTIFY_EMAIL_WEBHOOK_URL: "https://notifications.example.com/email",
      NOTIFY_SMS_WEBHOOK_URL: "https://notifications.example.com/sms",
      NOTIFY_EMAIL_WEBHOOK_SIGNING_SECRET: `${strongSecret}-email-webhook`,
      NOTIFY_SMS_WEBHOOK_SIGNING_SECRET: `${strongSecret}-sms-webhook`,
      NOTIFY_WEBHOOK_TIMEOUT_MS: "8000"
    };
    delete webhook.BREVO_TIMEOUT_MS;

    expect(validateProductionEnv(brevo).errors).toContain(
      "BREVO_TIMEOUT_MS is required in production."
    );
    expect(validateProductionEnv(webhook)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects a provider timeout that can outlive the dispatch lease", () => {
    const result = validateProductionEnv({
      ...validNotificationEnv(),
      BREVO_TIMEOUT_MS: "120000",
      NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS: "120"
    });

    expect(result.errors).toContain(
      "NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS must exceed the provider timeout."
    );
  });

  it("rejects an outbox retry cap below its base delay", () => {
    const result = validateProductionEnv({
      ...validNotificationEnv(),
      OUTBOX_RETRY_BASE_SECONDS: "60",
      OUTBOX_RETRY_MAX_SECONDS: "30"
    });

    expect(result.errors).toContain(
      "OUTBOX_RETRY_MAX_SECONDS must be greater than or equal to OUTBOX_RETRY_BASE_SECONDS."
    );
  });
});
