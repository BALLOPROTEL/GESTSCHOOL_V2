import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReferenceModule } from "../reference/reference.module";
import { SchoolLifeAttendanceService } from "./school-life-attendance.service";
import { SchoolLifeController } from "./school-life.controller";
import { SchoolLifeNotificationOrchestratorService } from "./school-life-notification-orchestrator.service";
import { SchoolLifeService } from "./school-life.service";
import { SchoolLifeTimetableService } from "./school-life-timetable.service";

@Module({
  imports: [AcademicStructureModule, NotificationsModule, ReferenceModule],
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
