import { request } from "node:http";

import { ConfigService } from "@nestjs/config";

import { WorkerHealthServer } from "../../src/worker-health.server";

function get(port: number, path: string): Promise<{ body: unknown; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port, path, method: "GET" },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            statusCode: response.statusCode || 0
          });
        });
      }
    );
    call.on("error", reject);
    call.end();
  });
}

describe("WorkerHealthServer", () => {
  const config = {
    get: (key: string, fallback: string) =>
      ({ WORKER_HEALTH_HOST: "127.0.0.1", WORKER_HEALTH_PORT: "0" })[key] ?? fallback
  } as ConfigService;

  it("reports live and ready only when PostgreSQL and Redis are reachable", async () => {
    const server = new WorkerHealthServer(
      config,
      { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) } as never,
      { isConfigured: () => true, ping: jest.fn().mockResolvedValue(true) }
    );
    await server.start();

    await expect(get(server.addressPort(), "/health/live")).resolves.toMatchObject({
      statusCode: 200,
      body: { status: "live", service: "gestschool-worker" }
    });
    await expect(get(server.addressPort(), "/health/ready")).resolves.toEqual({
      statusCode: 200,
      body: { status: "ready", database: "up", redis: "up" }
    });

    await server.stop();
  });

  it("fails readiness without leaking dependency errors", async () => {
    const server = new WorkerHealthServer(
      config,
      { $queryRaw: jest.fn().mockRejectedValue(new Error("postgresql://secret")) } as never,
      { isConfigured: () => true, ping: jest.fn().mockResolvedValue(false) }
    );
    await server.start();

    const response = await get(server.addressPort(), "/health/ready");
    expect(response).toEqual({
      statusCode: 503,
      body: {
        status: "not_ready",
        database: "unavailable",
        redis: "unavailable"
      }
    });
    expect(JSON.stringify(response)).not.toContain("postgresql://secret");

    await server.stop();
  });
});
