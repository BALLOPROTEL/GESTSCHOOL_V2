const { validateProductionEnv } = require("../../scripts/validate-production-env.cjs") as {
  validateProductionEnv: (env: NodeJS.ProcessEnv) => {
    errors: string[];
    warnings: string[];
  };
};

const strongSecret = "a-strong-production-secret-with-32-characters";

const validEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
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
  NOTIFICATIONS_WORKER_ENABLED: "false",
  OUTBOX_IN_PROCESS_ENABLED: "false"
});

describe("production environment validator", () => {
  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(validEnv())).toEqual({ errors: [], warnings: [] });
  });

  it("temporarily accepts only the known historical tenant id with an explicit warning", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      DEFAULT_TENANT_ID: "00000000-0000-0000-0000-000000000001",
      ALLOW_LEGACY_DEFAULT_TENANT_ID: "true"
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      expect.stringContaining("historical non-versioned tenant UUID")
    ]);
  });

  it("rejects the historical tenant id unless compatibility is explicitly enabled", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      DEFAULT_TENANT_ID: "00000000-0000-0000-0000-000000000001"
    });

    expect(result.errors).toEqual([
      expect.stringContaining("ALLOW_LEGACY_DEFAULT_TENANT_ID=true")
    ]);
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

  it("requires provider credentials only when notification processing is enabled", () => {
    const result = validateProductionEnv({
      ...validEnv(),
      OUTBOX_IN_PROCESS_ENABLED: "true",
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
});
