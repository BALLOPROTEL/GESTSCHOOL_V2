import { type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type ExpressApplication = {
  disable(setting: string): void;
  set(setting: string, value: number | boolean): void;
};

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

export function configureHttpPlatform(
  app: INestApplication,
  configService: ConfigService
): void {
  const express = app.getHttpAdapter().getInstance() as ExpressApplication;
  const nodeEnv = configService.get<string>("NODE_ENV", "development").trim().toLowerCase();
  const trustedProxyHops = resolveTrustedProxyHops(
    configService.get<string>("TRUST_PROXY_HOPS", "0")
  );

  express.set("trust proxy", trustedProxyHops);
  express.disable("x-powered-by");

  app.use((_request: unknown, response: HeaderResponse, next: () => void) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    if (nodeEnv === "production") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });
}

export function resolveTrustedProxyHops(rawValue: string): number {
  const normalized = rawValue.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
  }

  const value = Number(normalized);
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 5.");
  }
  return value;
}
