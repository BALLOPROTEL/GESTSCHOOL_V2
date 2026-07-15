import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferenceModule } from "../reference/reference.module";
import { StorageModule } from "../storage/storage.module";
import { SchoolLifeAttendanceService } from "./school-life-attendance.service";
import { SchoolLifeController } from "./school-life.controller";
import { SchoolLifeNotificationOrchestratorService } from "./school-life-notification-orchestrator.service";
import { SchoolLifeService } from "./school-life.service";
import { SchoolLifeTimetableService } from "./school-life-timetable.service";

@Module({
  imports: [AcademicStructureModule, AuditModule, NotificationsModule, ReferenceModule, StorageModule],
  controllers: [SchoolLifeController],
  providers: [
    SchoolLifeAttendanceService,
    SchoolLifeNotificationOrchestratorService,
    SchoolLifeService,
    SchoolLifeTimetableService
  ],
  exports: [SchoolLifeService]
})
export class SchoolLifeModule {}
