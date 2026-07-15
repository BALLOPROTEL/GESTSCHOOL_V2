import { Module } from "@nestjs/common";

import { FileValidationService } from "./file-validation.service";
import { LocalStorageProvider } from "./local-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import { StorageService } from "./storage.service";

@Module({
  providers: [
    StorageService,
    FileValidationService,
    LocalStorageProvider,
    SupabaseStorageProvider
  ],
  exports: [StorageService, FileValidationService]
})
export class StorageModule {}
