import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BackgroundModule } from "./background/background.module";
import { resolveEnvFilePath } from "./config/env-file-path";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./infrastructure/redis/redis.module";
import { ObservabilityModule } from "./observability/observability.module";
import { NotificationWorkerService } from "./school-life/notification-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveEnvFilePath()
    }),
    DatabaseModule,
    RedisModule,
    ObservabilityModule,
    BackgroundModule
  ],
  providers: [NotificationWorkerService]
})
export class WorkerModule {}
