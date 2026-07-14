import { Controller, Get, type INestApplication, Req } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import {
  configureHttpPlatform,
  resolveTrustedProxyHops
} from "../../src/security/http-platform.config";

@Controller()
class IpController {
  @Get("ip")
  ip(@Req() req: { ip?: string }): { ip?: string } {
    return { ip: req.ip };
  }
}

async function createApp(proxyHops: string): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [IpController]
  }).compile();
  const app = moduleRef.createNestApplication();
  configureHttpPlatform(
    app,
    new ConfigService({ NODE_ENV: "test", TRUST_PROXY_HOPS: proxyHops })
  );
  await app.init();
  return app;
}

describe("HTTP platform security", () => {
  it("does not trust X-Forwarded-For without an explicitly trusted proxy", async () => {
    const app = await createApp("0");
    try {
      const response = await request(app.getHttpServer())
        .get("/ip")
        .set("X-Forwarded-For", "203.0.113.9")
        .expect(200);
      expect(response.body.ip).not.toBe("203.0.113.9");
      expect(response.headers["x-powered-by"]).toBeUndefined();
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    } finally {
      await app.close();
    }
  });

  it("uses the forwarded client IP behind exactly one trusted proxy", async () => {
    const app = await createApp("1");
    try {
      const response = await request(app.getHttpServer())
        .get("/ip")
        .set("X-Forwarded-For", "203.0.113.9")
        .expect(200);
      expect(response.body.ip).toBe("203.0.113.9");
    } finally {
      await app.close();
    }
  });

  it("rejects unbounded or malformed proxy settings", () => {
    expect(() => resolveTrustedProxyHops("true")).toThrow();
    expect(() => resolveTrustedProxyHops("6")).toThrow();
  });
});
