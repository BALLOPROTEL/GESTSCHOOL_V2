import { Module } from "@nestjs/common";

import { LocalStorageProvider } from "./local-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import { StorageController } from "./storage.controller";
import { StorageService } from "./storage.service";

@Module({
  controllers: [StorageController],
  providers: [StorageService, LocalStorageProvider, SupabaseStorageProvider]
})
export class StorageModule {}
