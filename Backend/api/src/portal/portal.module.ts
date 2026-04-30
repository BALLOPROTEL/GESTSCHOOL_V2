import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { GradesModule } from "../grades/grades.module";
import { SchoolLifeModule } from "../school-life/school-life.module";
import { PortalAccessService } from "./portal-access.service";
import { PortalController } from "./portal.controller";
import { PortalParentService } from "./portal-parent.service";
import { PortalService } from "./portal.service";
import { PortalTeacherService } from "./portal-teacher.service";

@Module({
  imports: [AcademicStructureModule, GradesModule, SchoolLifeModule],
  controllers: [PortalController],
  providers: [PortalService, PortalAccessService, PortalTeacherService, PortalParentService]
})
export class PortalModule {}
