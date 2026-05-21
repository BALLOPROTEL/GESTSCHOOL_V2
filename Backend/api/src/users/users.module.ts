import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DevBootstrapUsersService } from "../database/dev-bootstrap-users.service";
import { StorageModule } from "../storage/storage.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule, AuthModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService, DevBootstrapUsersService],
  exports: [UsersService]
})
export class UsersModule {}
