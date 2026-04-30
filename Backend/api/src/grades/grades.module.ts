import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { ReferenceModule } from "../reference/reference.module";
import { GradesController } from "./grades.controller";
import { GradesEntryService } from "./grades-entry.service";
import { GradesReportCardsService } from "./grades-report-cards.service";
import { GradesService } from "./grades.service";

@Module({
  imports: [AcademicStructureModule, ReferenceModule],
  controllers: [GradesController],
  providers: [GradesService, GradesEntryService, GradesReportCardsService],
  exports: [GradesService]
})
export class GradesModule {}
