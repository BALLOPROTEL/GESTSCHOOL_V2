import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class InitiatePaydunyaPaymentDto {
  @ApiProperty()
  @IsUUID("all")
  invoiceId!: string;
}
