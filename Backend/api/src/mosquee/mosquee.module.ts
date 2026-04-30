import { Module } from "@nestjs/common";

import { MosqueeController } from "./mosquee.controller";
import { MosqueeService } from "./mosquee.service";

@Module({
  controllers: [MosqueeController],
  providers: [MosqueeService]
})
export class MosqueeModule {}
