import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { TeachersAssignmentsService } from "./teachers-assignments.service";
import { TeachersController } from "./teachers.controller";
import { TeachersDirectoryService } from "./teachers-directory.service";
import { TeachersDocumentsService } from "./teachers-documents.service";
import { TeachersService } from "./teachers.service";
import { TeachersSkillsService } from "./teachers-skills.service";
import { TeachersSupportService } from "./teachers-support.service";

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [TeachersController],
  providers: [
    TeachersService,
    TeachersSupportService,
    TeachersDirectoryService,
    TeachersSkillsService,
    TeachersAssignmentsService,
    TeachersDocumentsService
  ],
  exports: [TeachersService]
})
export class TeachersModule {}
