import type { ConfigService } from "@nestjs/config";

const enabled = (value: string): boolean =>
  ["1", "true", "yes"].includes(value.trim().toLowerCase());

const configValue = (configService: ConfigService, key: string, fallback: string): string =>
  configService.get<string>(key, fallback).trim();

export function allowsProductionSandboxInProcessOutbox(
  configService: ConfigService
): boolean {
  return (
    configValue(configService, "GESTSCHOOL_RUNTIME_ENV", "").toLowerCase() ===
      "production" &&
    configValue(configService, "GESTSCHOOL_PROCESS_ROLE", "").toLowerCase() === "api" &&
    enabled(
      configValue(
        configService,
        "ALLOW_IN_PROCESS_OUTBOX_FOR_EMPTY_SANDBOX",
        "false"
      )
    ) &&
    configValue(configService, "WEB_CONCURRENCY", "") === "1" &&
    !enabled(configValue(configService, "NOTIFICATIONS_WORKER_ENABLED", "false")) &&
    !enabled(configValue(configService, "NOTIFICATIONS_EMAIL_ENABLED", "false")) &&
    !enabled(configValue(configService, "NOTIFICATIONS_SMS_ENABLED", "false")) &&
    configValue(configService, "NOTIFICATIONS_EMAIL_PROVIDER", "MOCK").toUpperCase() ===
      "MOCK" &&
    configValue(configService, "NOTIFICATIONS_SMS_PROVIDER", "MOCK").toUpperCase() ===
      "MOCK" &&
    !enabled(configValue(configService, "BREVO_WEBHOOK_ENABLED", "false")) &&
    !enabled(configValue(configService, "ALLOW_REAL_SMS", "false")) &&
    configValue(configService, "PAYMENT_PROVIDER", "mock").toLowerCase() === "mock"
  );
}
