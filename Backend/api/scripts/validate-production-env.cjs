const PLACEHOLDER_PATTERN = /^(change-me|changeme|replace-me|example|placeholder|secret|password)/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateProductionEnv(env) {
  const nodeEnv = String(env.NODE_ENV || "development").trim().toLowerCase();
  if (nodeEnv !== "production") {
    return { errors: [], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  function requireEnv(name) {
    const value = String(env[name] || "").trim();
    if (!value) errors.push(`${name} is required in production.`);
    return value;
  }

  function requireSecret(name) {
    const value = requireEnv(name);
    if (!value) return;

    if (value.length < 32 || PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`${name} must be a non-placeholder secret of at least 32 characters.`);
    }
  }

  function parsePostgresUrl(name) {
    const raw = requireEnv(name);
    if (!raw) return null;

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      errors.push(`${name} must be a valid PostgreSQL connection URL.`);
      return null;
    }

    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      errors.push(`${name} must use the postgresql:// protocol.`);
    }
    if (!parsed.username) errors.push(`${name} must include a database username.`);
    if (!parsed.password) errors.push(`${name} must include a database password.`);
    if (!parsed.hostname) errors.push(`${name} must include a database host.`);

    return parsed;
  }

  const databaseUrl = parsePostgresUrl("DATABASE_URL");
  const directUrl = parsePostgresUrl("DIRECT_URL");
  const corsOriginsRaw = requireEnv("CORS_ORIGINS");
  requireSecret("JWT_SECRET");
  requireSecret("PASSWORD_RESET_SECRET");

  const defaultTenantId = requireEnv("DEFAULT_TENANT_ID");
  if (defaultTenantId && !UUID_PATTERN.test(defaultTenantId)) {
    errors.push("DEFAULT_TENANT_ID must be a valid UUID.");
  }

  if (databaseUrl) {
    const isSupabasePooler = databaseUrl.hostname.includes("pooler.supabase.com");
    const isTransactionPooler =
      isSupabasePooler &&
      (databaseUrl.port === "6543" || databaseUrl.searchParams.get("pgbouncer") === "true");

    if (isSupabasePooler && !decodeURIComponent(databaseUrl.username).includes(".")) {
      errors.push(
        "DATABASE_URL uses Supabase pooler but the username is not tenant-qualified. " +
          "Use the Supabase pooler user format postgres.<project-ref>."
      );
    }

    if (isTransactionPooler && databaseUrl.searchParams.get("pgbouncer") !== "true") {
      warnings.push(
        "DATABASE_URL appears to use the Supabase transaction pooler. Add pgbouncer=true to the query string."
      );
    }
  }

  if (databaseUrl && directUrl) {
    if (databaseUrl.toString() === directUrl.toString()) {
      warnings.push(
        "DIRECT_URL is identical to DATABASE_URL. Prisma migrations should use a direct or session-pooler URL."
      );
    }

    const directIsTransactionPooler =
      directUrl.hostname.includes("pooler.supabase.com") &&
      (directUrl.port === "6543" || directUrl.searchParams.get("pgbouncer") === "true");

    if (directIsTransactionPooler) {
      errors.push(
        "DIRECT_URL must not use the Supabase transaction pooler. " +
          "Use db.<project-ref>.supabase.co:5432 or the Supabase session pooler for Prisma migrations."
      );
    }
  }

  const corsOrigins = corsOriginsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.some((origin) => origin === "*")) {
    errors.push("CORS_ORIGINS must not contain * in production.");
  }

  for (const origin of corsOrigins.filter((value) => value !== "*")) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "https:") {
        errors.push(`CORS_ORIGINS entry ${origin} must use https:// in production.`);
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
        errors.push(`CORS_ORIGINS entry ${origin} must be an origin without path, query or fragment.`);
      }
    } catch {
      errors.push(`CORS_ORIGINS entry ${origin} is not a valid origin.`);
    }
  }

  return { errors, warnings };
}

function run() {
  const { loadGestSchoolEnv } = require("./load-env.cjs");
  loadGestSchoolEnv(__dirname + "/..");

  const { errors, warnings } = validateProductionEnv(process.env);

  for (const warning of warnings) {
    console.warn(`[production-env] ${warning}`);
  }

  if (errors.length > 0) {
    console.error("[production-env] Invalid production configuration:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (String(process.env.NODE_ENV || "development").trim().toLowerCase() === "production") {
    console.log("[production-env] Production runtime configuration looks valid.");
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  validateProductionEnv
};
