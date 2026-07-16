const PLACEHOLDER_PATTERN = /^(change-me|changeme|replace-me|example|placeholder|secret|password)/i;
const VERSIONED_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

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

  function booleanValue(name, fallback = false) {
    const raw = String(env[name] ?? fallback).trim().toLowerCase();
    return raw === "true" || raw === "1" || raw === "yes";
  }

  function requireCredential(name, minimumLength = 16) {
    const value = requireEnv(name);
    if (value && (value.length < minimumLength || PLACEHOLDER_PATTERN.test(value))) {
      errors.push(`${name} must be a non-placeholder credential.`);
    }
    return value;
  }

  function requireInteger(name, minimum, maximum) {
    const raw = requireEnv(name);
    const value = Number(raw);
    if (
      !/^\d+$/.test(raw) ||
      !Number.isInteger(value) ||
      value < minimum ||
      value > maximum
    ) {
      errors.push(`${name} must be an integer between ${minimum} and ${maximum}.`);
      return null;
    }
    return value;
  }

  function parseServiceUrl(name, protocols) {
    const raw = requireEnv(name);
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      if (!protocols.includes(parsed.protocol)) {
        errors.push(`${name} must use one of: ${protocols.join(", ")}.`);
      }
      if (!parsed.hostname) errors.push(`${name} must include a host.`);
      return parsed;
    } catch {
      errors.push(`${name} must be a valid URL.`);
      return null;
    }
  }

  function requireStorageBucket(name) {
    const value = requireEnv(name);
    if (value && !/^[a-z0-9][a-z0-9._-]{1,80}$/.test(value)) {
      errors.push(`${name} must be a valid Supabase bucket name.`);
    }
    return value;
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
  const jwtIssuer = requireEnv("JWT_ISSUER");
  const jwtAudience = requireEnv("JWT_AUDIENCE");
  if (jwtIssuer && PLACEHOLDER_PATTERN.test(jwtIssuer)) {
    errors.push("JWT_ISSUER must not be a placeholder value.");
  }
  if (jwtAudience && PLACEHOLDER_PATTERN.test(jwtAudience)) {
    errors.push("JWT_AUDIENCE must not be a placeholder value.");
  }

  parseServiceUrl("REDIS_URL", ["redis:", "rediss:"]);
  if (booleanValue("RATE_LIMIT_DISABLED")) {
    errors.push("RATE_LIMIT_DISABLED must not be enabled in production.");
  }

  const proxyHopsRaw = requireEnv("TRUST_PROXY_HOPS");
  const proxyHops = Number(proxyHopsRaw);
  if (!/^\d+$/.test(proxyHopsRaw) || !Number.isInteger(proxyHops) || proxyHops < 1 || proxyHops > 5) {
    errors.push("TRUST_PROXY_HOPS must be an integer between 1 and 5 in production.");
  }

  const storageDriver = requireEnv("FILE_STORAGE_DRIVER").toUpperCase();
  const storageProvider = String(env.STORAGE_PROVIDER || storageDriver).trim().toUpperCase();
  if (storageDriver && storageDriver !== "SUPABASE") {
    errors.push("FILE_STORAGE_DRIVER must be SUPABASE in production.");
  }
  if (storageProvider && storageProvider !== "SUPABASE") {
    errors.push("STORAGE_PROVIDER must be supabase in production.");
  }
  if (storageDriver === "SUPABASE" || storageProvider === "SUPABASE") {
    parseServiceUrl("SUPABASE_URL", ["https:"]);
    requireCredential("SUPABASE_SERVICE_ROLE_KEY", 32);
    const documentsBucket = requireStorageBucket("SUPABASE_STORAGE_BUCKET_DOCUMENTS");
    const avatarsBucket = requireStorageBucket("SUPABASE_STORAGE_BUCKET_AVATARS");
    if (documentsBucket && avatarsBucket && documentsBucket === avatarsBucket) {
      errors.push(
        "SUPABASE_STORAGE_BUCKET_DOCUMENTS and SUPABASE_STORAGE_BUCKET_AVATARS must be distinct."
      );
    }
    if (booleanValue("SUPABASE_STORAGE_AVATARS_PUBLIC")) {
      errors.push(
        "SUPABASE_STORAGE_AVATARS_PUBLIC must be false in production."
      );
    }
    const signedUrlTtlRaw = requireEnv("SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS");
    const signedUrlTtl = Number(signedUrlTtlRaw);
    if (
      !/^\d+$/.test(signedUrlTtlRaw) ||
      !Number.isInteger(signedUrlTtl) ||
      signedUrlTtl < 60 ||
      signedUrlTtl > 900
    ) {
      errors.push(
        "SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS must be an integer between 60 and 900."
      );
    }
  }

  const notificationsEnabled =
    booleanValue("NOTIFICATIONS_WORKER_ENABLED") || booleanValue("OUTBOX_IN_PROCESS_ENABLED");
  if (notificationsEnabled) {
    const emailProvider = String(
      env.NOTIFICATIONS_EMAIL_PROVIDER || env.NOTIFY_EMAIL_PROVIDER || ""
    )
      .trim()
      .toUpperCase();
    const smsProvider = String(
      env.NOTIFICATIONS_SMS_PROVIDER || env.NOTIFY_SMS_PROVIDER || ""
    )
      .trim()
      .toUpperCase();
    const allowedProviders = ["BREVO", "WEBHOOK"];

    if (!allowedProviders.includes(emailProvider)) {
      errors.push("NOTIFICATIONS_EMAIL_PROVIDER must be BREVO or WEBHOOK when notifications are enabled.");
    }
    if (!allowedProviders.includes(smsProvider)) {
      errors.push("NOTIFICATIONS_SMS_PROVIDER must be BREVO or WEBHOOK when notifications are enabled.");
    }
    if (emailProvider === "BREVO" || smsProvider === "BREVO") {
      requireCredential("BREVO_API_KEY", 16);
    }
    if (emailProvider === "BREVO") {
      requireEnv("BREVO_SENDER_EMAIL");
    }
    if (smsProvider === "BREVO" && !booleanValue("BREVO_SMS_DRY_RUN", true)) {
      requireEnv("BREVO_SMS_SENDER");
      if (!booleanValue("ALLOW_REAL_SMS")) {
        errors.push("ALLOW_REAL_SMS must be true when BREVO_SMS_DRY_RUN is false.");
      }
    }
    if (emailProvider === "WEBHOOK") {
      parseServiceUrl("NOTIFY_EMAIL_WEBHOOK_URL", ["https:"]);
      requireSecret("NOTIFY_EMAIL_WEBHOOK_SIGNING_SECRET");
    }
    if (smsProvider === "WEBHOOK") {
      parseServiceUrl("NOTIFY_SMS_WEBHOOK_URL", ["https:"]);
      requireSecret("NOTIFY_SMS_WEBHOOK_SIGNING_SECRET");
    }

    requireSecret("NOTIFICATION_WEBHOOK_SIGNING_SECRET");
    requireInteger("NOTIFICATION_WEBHOOK_REPLAY_WINDOW_SECONDS", 60, 3600);
    requireInteger("OUTBOX_CLAIM_TTL_SECONDS", 30, 3600);
    requireInteger("OUTBOX_MAX_ATTEMPTS", 1, 20);
    const outboxRetryBaseSeconds = requireInteger(
      "OUTBOX_RETRY_BASE_SECONDS",
      1,
      3600
    );
    const outboxRetryMaxSeconds = requireInteger(
      "OUTBOX_RETRY_MAX_SECONDS",
      1,
      86400
    );
    if (
      outboxRetryBaseSeconds !== null &&
      outboxRetryMaxSeconds !== null &&
      outboxRetryMaxSeconds < outboxRetryBaseSeconds
    ) {
      errors.push(
        "OUTBOX_RETRY_MAX_SECONDS must be greater than or equal to OUTBOX_RETRY_BASE_SECONDS."
      );
    }
    const dispatchLeaseSeconds = requireInteger(
      "NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS",
      30,
      3600
    );
    const providerTimeouts = [];
    if (emailProvider === "BREVO" || smsProvider === "BREVO") {
      providerTimeouts.push(requireInteger("BREVO_TIMEOUT_MS", 1000, 120000));
    }
    if (emailProvider === "WEBHOOK" || smsProvider === "WEBHOOK") {
      providerTimeouts.push(requireInteger("NOTIFY_WEBHOOK_TIMEOUT_MS", 1000, 120000));
    }
    requireInteger("NOTIFY_MAX_ATTEMPTS", 1, 20);
    const retryBaseSeconds = requireInteger("NOTIFY_RETRY_BASE_SECONDS", 1, 3600);
    const retryMaxSeconds = requireInteger("NOTIFY_RETRY_MAX_SECONDS", 1, 86400);
    if (
      retryBaseSeconds !== null &&
      retryMaxSeconds !== null &&
      retryMaxSeconds < retryBaseSeconds
    ) {
      errors.push("NOTIFY_RETRY_MAX_SECONDS must be greater than or equal to NOTIFY_RETRY_BASE_SECONDS.");
    }
    if (
      dispatchLeaseSeconds !== null &&
      providerTimeouts.some(
        (providerTimeoutMs) =>
          providerTimeoutMs !== null && dispatchLeaseSeconds * 1000 <= providerTimeoutMs
      )
    ) {
      errors.push(
        "NOTIFICATIONS_DISPATCH_CLAIM_TTL_SECONDS must exceed the provider timeout."
      );
    }
  }

  const defaultTenantId = requireEnv("DEFAULT_TENANT_ID");
  if (defaultTenantId && !VERSIONED_UUID_PATTERN.test(defaultTenantId)) {
    if (defaultTenantId === LEGACY_DEFAULT_TENANT_ID) {
      if (String(env.ALLOW_LEGACY_DEFAULT_TENANT_ID || "").trim().toLowerCase() !== "true") {
        errors.push(
          "DEFAULT_TENANT_ID uses the historical non-versioned tenant UUID. " +
            "Set ALLOW_LEGACY_DEFAULT_TENANT_ID=true only for the temporary compatibility period."
        );
      } else {
        warnings.push(
          "DEFAULT_TENANT_ID uses the historical non-versioned tenant UUID. " +
            "This compatibility exception is temporary and applies only to the known legacy identifier."
        );
      }
    } else {
      errors.push("DEFAULT_TENANT_ID must be a valid versioned UUID.");
    }
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
