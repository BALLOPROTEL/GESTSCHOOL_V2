import { ConfigService } from "@nestjs/config";

import { RedisService } from "../../src/infrastructure/redis/redis.service";

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, fallback: string) => values[key] ?? fallback
  } as ConfigService;
}

describe("RedisService production startup", () => {
  it("fails fast when REDIS_URL is missing in production", async () => {
    const service = new RedisService(config({ NODE_ENV: "production", REDIS_URL: "" }));

    await expect(service.onModuleInit()).rejects.toThrow("REDIS_URL is required in production");
  });

  it("allows Redis to be absent in local tests", async () => {
    const service = new RedisService(config({ NODE_ENV: "test", REDIS_URL: "" }));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.getStatus()).toBe("disabled");
  });
});
