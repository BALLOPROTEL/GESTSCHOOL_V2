import { Module } from "@nestjs/common";

import { AcademicStructureModule } from "../academic-structure/academic-structure.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PaymentsController } from "../payments/payments.controller";
import { PaydunyaProvider } from "../payments/paydunya.provider";
import { ReferenceModule } from "../reference/reference.module";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  imports: [AcademicStructureModule, NotificationsModule, ReferenceModule],
  controllers: [FinanceController, PaymentsController],
  providers: [FinanceService, PaydunyaProvider],
  exports: [FinanceService]
})
export class FinanceModule {}
