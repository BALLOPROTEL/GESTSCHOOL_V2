import { Module } from "@nestjs/common";

import { AcademicStructureRuleValidator } from "./academic-structure-rule-validator.service";
import { AcademicStructureService } from "./academic-structure.service";

@Module({
  providers: [AcademicStructureRuleValidator, AcademicStructureService],
  exports: [AcademicStructureService]
})
export class AcademicStructureModule {}
