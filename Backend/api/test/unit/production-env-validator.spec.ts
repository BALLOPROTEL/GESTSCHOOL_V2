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
  JWT_SECRET: strongSecret,
  PASSWORD_RESET_SECRET: `${strongSecret}-reset`,
  DEFAULT_TENANT_ID: "00000000-0000-4000-8000-000000000001"
});

describe("production environment validator", () => {
  it("accepts a complete production configuration", () => {
    expect(validateProductionEnv(validEnv())).toEqual({ errors: [], warnings: [] });
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
        "DEFAULT_TENANT_ID must be a valid UUID.",
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
});
