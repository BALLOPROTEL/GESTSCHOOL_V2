import { Module } from "@nestjs/common";

import { AcademicStructureRuleValidator } from "./academic-structure-rule-validator.service";
import { AcademicStructureService } from "./academic-structure.service";
import { AdmissionAcademicPolicyService } from "./admission-academic-policy.service";

@Module({
  providers: [
    AcademicStructureRuleValidator,
    AdmissionAcademicPolicyService,
    AcademicStructureService,
  ],
  exports: [AcademicStructureService, AdmissionAcademicPolicyService],
})
export class AcademicStructureModule {}
