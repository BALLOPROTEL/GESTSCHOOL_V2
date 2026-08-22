import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { OutboxModule } from "../outbox/outbox.module";
import { ParentsModule } from "../parents/parents.module";
import { StudentsModule } from "../students/students.module";
import { AdmissionCasesController } from "./admission-cases.controller";
import { AdmissionCasesService } from "./admission-cases.service";
import { AdmissionFinalizationService } from "./admission-finalization.service";
import { AdmissionIdentitySearchService } from "./admission-identity-search.service";
import { AdmissionPrerequisitesController } from "./admission-prerequisites.controller";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";

@Module({
  imports: [
    AcademicStructureModule,
    AuditModule,
    OutboxModule,
    ParentsModule,
    StudentsModule,
  ],
  controllers: [AdmissionCasesController, AdmissionPrerequisitesController],
  providers: [
    AdmissionCasesService,
    AdmissionFinalizationService,
    AdmissionIdentitySearchService,
    AdmissionPrerequisitesService,
  ],
})
export class AdmissionsModule {}
