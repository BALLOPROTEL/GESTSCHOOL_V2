import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { ParentsController } from "./parents.controller";
import { ParentsService } from "./parents.service";

@Module({
  imports: [AuditModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService]
})
export class ParentsModule {}
