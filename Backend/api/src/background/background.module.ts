import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BackgroundTasksService } from "./background-tasks.service";
import { InProcessBackgroundRunnerService } from "./in-process-background-runner.service";

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [BackgroundTasksService, InProcessBackgroundRunnerService],
  exports: [BackgroundTasksService]
})
export class BackgroundModule {}
