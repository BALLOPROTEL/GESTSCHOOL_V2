import { ConsoleLogger, Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./database/prisma.service";
import { RedisService } from "./infrastructure/redis/redis.service";
import { WorkerModule } from "./worker.module";
import { WorkerHealthServer } from "./worker-health.server";

async function bootstrap(): Promise<void> {
  const production = String(process.env.NODE_ENV || "development").trim().toLowerCase() === "production";
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
    logger: new ConsoleLogger({
      colors: !production,
      json: production,
      prefix: "gestschool-worker"
    })
  });

  app.flushLogs();
  const healthServer = new WorkerHealthServer(
    app.get(ConfigService),
    app.get(PrismaService),
    app.get(RedisService)
  );
  await healthServer.start();

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    Logger.log({ event: "worker_shutdown", signal }, "WorkerBootstrap");
    await healthServer.stop();
    await app.close();
  };
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  Logger.log("GestSchool worker started.", "WorkerBootstrap");
}

void bootstrap();
