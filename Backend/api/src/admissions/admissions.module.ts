import { Module } from "@nestjs/common";

import { AdmissionPrerequisitesController } from "./admission-prerequisites.controller";
import { AdmissionPrerequisitesService } from "./admission-prerequisites.service";

@Module({
  controllers: [AdmissionPrerequisitesController],
  providers: [AdmissionPrerequisitesService],
})
export class AdmissionsModule {}
