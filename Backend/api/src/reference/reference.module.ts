import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { ReferenceCatalogService } from "./reference-catalog.service";
import { ReferenceController } from "./reference.controller";
import { ReferenceHierarchyService } from "./reference-hierarchy.service";
import { ReferenceSchoolYearsService } from "./reference-school-years.service";
import { ReferenceService } from "./reference.service";

@Module({
  imports: [AcademicStructureModule],
  controllers: [ReferenceController],
  providers: [
    ReferenceCatalogService,
    ReferenceHierarchyService,
    ReferenceSchoolYearsService,
    ReferenceService
  ],
  exports: [ReferenceService]
})
export class ReferenceModule {}
