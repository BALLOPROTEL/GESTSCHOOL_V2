import { createServer, type Server, type ServerResponse } from "node:http";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./database/prisma.service";
import { RedisService } from "./infrastructure/redis/redis.service";
import { isUnsafeSharedSecret, secureCompare } from "./security/secure-compare.util";

type WorkerMetricRow = {
  dueOutbox: bigint | number;
  failedNotificationsDue: bigint | number;
  oldestOutboxLagSeconds: bigint | number;
  deadLetterNotifications: bigint | number;
};

export class WorkerHealthServer {
  private readonly logger = new Logger(WorkerHealthServer.name);
  private server: Server | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: Pick<PrismaService, "$queryRaw">,
    private readonly redis: Pick<RedisService, "isConfigured" | "ping">
  ) {}

  async start(): Promise<void> {
    if (this.server) return;

    const host = this.configService.get<string>("WORKER_HEALTH_HOST", "0.0.0.0").trim();
    const port = this.port();
    this.server = createServer((request, response) => {
      if (request.method !== "GET") {
        this.writeJson(response, 405, { status: "method_not_allowed" });
        return;
      }
      if (request.url === "/health/live") {
        this.writeJson(response, 200, {
          status: "live",
          service: "gestschool-worker",
          uptimeSeconds: Number(process.uptime().toFixed(2))
        });
        return;
      }
      if (request.url === "/health/ready") {
        void this.readiness(response);
        return;
      }
      if (request.url === "/metrics") {
        void this.metrics(request.headers.authorization, request.headers["x-metrics-token"], response);
        return;
      }
      this.writeJson(response, 404, { status: "not_found" });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(port, host, () => resolve());
    });
    this.logger.log({
      event: "worker_health_listening",
      host,
      port: this.addressPort()
    });
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  addressPort(): number {
    const address = this.server?.address();
    return typeof address === "object" && address ? address.port : this.port();
  }

  private async readiness(response: ServerResponse): Promise<void> {
    const [databaseResult, redisResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.isConfigured() ? this.redis.ping() : Promise.resolve(false)
    ]);
    const databaseUp = databaseResult.status === "fulfilled";
    const redisUp = redisResult.status === "fulfilled" && redisResult.value === true;
    this.writeJson(response, databaseUp && redisUp ? 200 : 503, {
      status: databaseUp && redisUp ? "ready" : "not_ready",
      database: databaseUp ? "up" : "unavailable",
      redis: redisUp ? "up" : "unavailable"
    });
  }

  private async metrics(
    authorization: string | undefined,
    tokenHeader: string | string[] | undefined,
    response: ServerResponse
  ): Promise<void> {
    const expectedToken = this.configService
      .get<string>("MONITORING_METRICS_TOKEN", "")
      .trim();
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/iu)?.[1]?.trim();
    const suppliedToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (
      !expectedToken ||
      isUnsafeSharedSecret(expectedToken) ||
      !secureCompare(suppliedToken || bearerToken, expectedToken)
    ) {
      this.writeJson(response, 403, { status: "forbidden" });
      return;
    }

    const redisUp = this.redis.isConfigured() && (await this.redis.ping().catch(() => false));
    let databaseUp = false;
    let metricRow: WorkerMetricRow = {
      dueOutbox: 0,
      failedNotificationsDue: 0,
      oldestOutboxLagSeconds: 0,
      deadLetterNotifications: 0
    };
    try {
      const rows = await this.prisma.$queryRaw<WorkerMetricRow[]>`
        SELECT
          (
            SELECT COUNT(*)
            FROM outbox_events
            WHERE status = 'PENDING'
              AND available_at <= NOW()
          ) AS "dueOutbox",
          (
            SELECT COALESCE(
              EXTRACT(EPOCH FROM (NOW() - MIN(created_at))),
              0
            )
            FROM outbox_events
            WHERE status = 'PENDING'
              AND available_at <= NOW()
          ) AS "oldestOutboxLagSeconds",
          (
            SELECT COUNT(*)
            FROM notifications
            WHERE status = 'FAILED_RETRYABLE'
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
          ) AS "failedNotificationsDue",
          (
            SELECT COUNT(*)
            FROM notifications
            WHERE status = 'DEAD_LETTER'
          ) AS "deadLetterNotifications"
      `;
      metricRow = rows[0] || metricRow;
      databaseUp = true;
    } catch {
      databaseUp = false;
    }

    const lines = [
      "# TYPE gestschool_worker_up gauge",
      "gestschool_worker_up 1",
      "# TYPE gestschool_worker_database_up gauge",
      `gestschool_worker_database_up ${databaseUp ? 1 : 0}`,
      "# TYPE gestschool_worker_redis_up gauge",
      `gestschool_worker_redis_up ${redisUp ? 1 : 0}`,
      "# TYPE gestschool_worker_outbox_due_total gauge",
      `gestschool_worker_outbox_due_total ${Number(metricRow.dueOutbox)}`,
      "# TYPE gestschool_worker_outbox_lag_seconds_max gauge",
      `gestschool_worker_outbox_lag_seconds_max ${Number(metricRow.oldestOutboxLagSeconds)}`,
      "# TYPE gestschool_worker_notifications_failed_due_total gauge",
      `gestschool_worker_notifications_failed_due_total ${Number(metricRow.failedNotificationsDue)}`,
      "# TYPE gestschool_worker_notifications_dead_letter_total gauge",
      `gestschool_worker_notifications_dead_letter_total ${Number(metricRow.deadLetterNotifications)}`,
      "# TYPE gestschool_worker_process_uptime_seconds gauge",
      `gestschool_worker_process_uptime_seconds ${process.uptime().toFixed(2)}`
    ];
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(`${lines.join("\n")}\n`);
  }

  private writeJson(response: ServerResponse, statusCode: number, payload: object): void {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(payload));
  }

  private port(): number {
    const configured = Number(this.configService.get<string>("WORKER_HEALTH_PORT", "3001"));
    if (!Number.isInteger(configured) || configured < 0 || configured > 65535) {
      throw new Error("WORKER_HEALTH_PORT must be an integer between 0 and 65535.");
    }
    return configured;
  }
}
