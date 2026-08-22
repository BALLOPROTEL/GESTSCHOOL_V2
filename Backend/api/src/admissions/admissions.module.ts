import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AdmissionCasesController } from "./admission-cases.controller";
import { AdmissionCasesService } from "./admission-cases.service";
import { AdmissionPrerequisitesController } from "./admission-prerequisites.controller";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";

@Module({
  imports: [AuditModule],
  controllers: [AdmissionCasesController, AdmissionPrerequisitesController],
  providers: [AdmissionCasesService, AdmissionPrerequisitesService],
})
export class AdmissionsModule {}
