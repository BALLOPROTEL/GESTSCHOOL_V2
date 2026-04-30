import { ConfigService } from "@nestjs/config";

const DEV_DEFAULT_JWT_SECRET = "dev-only-secret-change-me";

export type JwtRuntimeConfig = {
  secret: string;
  issuer: string;
  audience: string;
};

const isProductionEnvironment = (configService: ConfigService): boolean =>
  configService.get<string>("NODE_ENV", "development").trim().toLowerCase() === "production";

export const getJwtRuntimeConfig = (configService: ConfigService): JwtRuntimeConfig => {
  const configuredSecret = configService.get<string>("JWT_SECRET")?.trim();

  if (!configuredSecret && isProductionEnvironment(configService)) {
    throw new Error("JWT_SECRET must be configured in production.");
  }

  return {
    secret: configuredSecret || DEV_DEFAULT_JWT_SECRET,
    issuer: configService.get<string>("JWT_ISSUER", "gestschool"),
    audience: configService.get<string>("JWT_AUDIENCE", "gestschool-clients")
  };
};

export const getJwtSecret = (configService: ConfigService): string =>
  getJwtRuntimeConfig(configService).secret;
