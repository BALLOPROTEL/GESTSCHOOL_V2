import { request } from "node:http";

import { ConfigService } from "@nestjs/config";

import { WorkerHealthServer } from "../../src/worker-health.server";

function get(
  port: number,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ body: unknown; statusCode: number }> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port, path, method: "GET", headers },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            body:
              response.headers["content-type"]?.startsWith("application/json")
                ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
                : Buffer.concat(chunks).toString("utf8"),
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
      ({
        WORKER_HEALTH_HOST: "127.0.0.1",
        WORKER_HEALTH_PORT: "0",
        MONITORING_METRICS_TOKEN: "worker-monitoring-token-with-more-than-32-characters"
      })[key] ?? fallback
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

  it("protects and exports worker queue metrics without sensitive payloads", async () => {
    const server = new WorkerHealthServer(
      config,
      {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            dueOutbox: 2n,
            failedNotificationsDue: 1n,
            oldestOutboxLagSeconds: 45,
            deadLetterNotifications: 0n
          }
        ])
      } as never,
      { isConfigured: () => true, ping: jest.fn().mockResolvedValue(true) }
    );
    await server.start();

    await expect(get(server.addressPort(), "/metrics")).resolves.toMatchObject({
      statusCode: 403
    });
    const response = await get(server.addressPort(), "/metrics", {
      Authorization:
        "Bearer worker-monitoring-token-with-more-than-32-characters"
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("gestschool_worker_outbox_due_total 2");
    expect(response.body).toContain(
      "gestschool_worker_notifications_failed_due_total 1"
    );
    expect(response.body).not.toContain("target_address");

    await server.stop();
  });
});
