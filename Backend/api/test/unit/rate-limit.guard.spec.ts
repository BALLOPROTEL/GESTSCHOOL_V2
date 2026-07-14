import { ConfigService } from "@nestjs/config";
import { HttpStatus } from "@nestjs/common";

import { RateLimitGuard } from "../../src/security/rate-limit.guard";

function contextFor(ip: string, forwardedFor?: string) {
  const headers = new Map<string, string>();
  return {
    context: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ ip, headers: { "x-forwarded-for": forwardedFor } }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => headers.set(name, String(value))
        })
      })
    } as never,
    headers
  };
}

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback: string) => values[key] ?? fallback
  } as ConfigService;
}

describe("RateLimitGuard", () => {
  const reflector = {
    getAllAndOverride: () => ({ bucket: "auth-test", max: 1, windowMs: 60_000 })
  } as never;

  it("uses Express resolved request.ip and ignores a spoofed forwarded header", async () => {
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2) };
    const guard = new RateLimitGuard(reflector, redis as never, config({ NODE_ENV: "production" }));

    await expect(
      guard.canActivate(contextFor("198.51.100.10", "203.0.113.1").context)
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor("198.51.100.10", "203.0.113.2").context)
    ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it("fails closed when Redis is unavailable in production", async () => {
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(null) };
    const guard = new RateLimitGuard(reflector, redis as never, config({ NODE_ENV: "production" }));

    await expect(guard.canActivate(contextFor("198.51.100.10").context)).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE
    });
  });

  it("never disables production rate limiting through RATE_LIMIT_DISABLED", async () => {
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(null) };
    const guard = new RateLimitGuard(
      reflector,
      redis as never,
      config({ NODE_ENV: "production", RATE_LIMIT_DISABLED: "true" })
    );

    await expect(guard.canActivate(contextFor("198.51.100.10").context)).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE
    });
  });

  it("keeps the in-memory fallback available in tests", async () => {
    const redis = { incrementWithExpiry: jest.fn().mockResolvedValue(null) };
    const guard = new RateLimitGuard(reflector, redis as never, config({ NODE_ENV: "test" }));

    await expect(guard.canActivate(contextFor("127.0.0.1").context)).resolves.toBe(true);
  });
});
