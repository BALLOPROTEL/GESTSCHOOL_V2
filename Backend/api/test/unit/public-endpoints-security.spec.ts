import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { MonitoringController } from "../../src/health/monitoring.controller";

const strongToken = "metrics-token-production-2026";

const configService = (values: Record<string, string | undefined>): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => values[key] ?? defaultValue)
  }) as unknown as ConfigService;

const createController = (values: Record<string, string | undefined>): MonitoringController =>
  new MonitoringController(
    {} as never,
    configService(values),
    { isConnected: () => false, getOperationalMetrics: () => Promise.resolve({}) } as never,
    { snapshot: () => ({ duration: [], total: [], operations: [] }) } as never
  );

describe("public endpoint security policy", () => {
  it("keeps monitoring metrics disabled in production without a token", async () => {
    const controller = createController({
      MONITORING_METRICS_TOKEN: "",
      NODE_ENV: "production"
    });

    await expect(controller.metrics()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects unsafe shared tokens in production", () => {
    const controller = createController({
      MONITORING_METRICS_TOKEN: "test-secret",
      NODE_ENV: "production"
    });

    expect(() => controller.providerChecks("test-secret")).toThrow(ForbiddenException);
  });

  it("reports provider readiness without exposing secret values", () => {
    const controller = createController({
      BREVO_API_KEY: "brevo-secret-value",
      MONITORING_METRICS_TOKEN: strongToken,
      NODE_ENV: "production",
      PAYMENT_PROVIDER: "paydunya",
      PAYDUNYA_PRIVATE_KEY: "paydunya-private-secret",
      STORAGE_PROVIDER: "SUPABASE",
      SUPABASE_SERVICE_ROLE_KEY: "supabase-service-role-secret",
      SUPABASE_URL: "https://gestschool.supabase.co"
    });

    const checks = controller.providerChecks(strongToken);
    const serialized = JSON.stringify(checks);

    expect(serialized).not.toContain("brevo-secret-value");
    expect(serialized).not.toContain("paydunya-private-secret");
    expect(serialized).not.toContain("supabase-service-role-secret");
    expect(serialized).toContain('"SUPABASE_SERVICE_ROLE_KEY":true');
    expect(serialized).toContain('"PAYDUNYA_PRIVATE_KEY":true');
  });

  it("accepts the monitoring token through a standard bearer header", () => {
    const controller = createController({
      MONITORING_METRICS_TOKEN: strongToken,
      NODE_ENV: "production"
    });

    expect(() => controller.providerChecks(undefined, `Bearer ${strongToken}`)).not.toThrow();
  });
});
