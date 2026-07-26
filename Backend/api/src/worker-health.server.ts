import { createServer, type Server, type ServerResponse } from "node:http";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "./database/prisma.service";
import { RedisService } from "./infrastructure/redis/redis.service";

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
