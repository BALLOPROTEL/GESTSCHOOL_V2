import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { RoomAssignmentsService } from "./room-assignments.service";
import { RoomAvailabilitiesService } from "./room-availabilities.service";
import { RoomTypesService } from "./room-types.service";
import { RoomsCatalogService } from "./rooms-catalog.service";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { RoomsSupportService } from "./rooms-support.service";

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomsSupportService,
    RoomTypesService,
    RoomsCatalogService,
    RoomAssignmentsService,
    RoomAvailabilitiesService
  ],
  exports: [RoomsService]
})
export class RoomsModule {}
