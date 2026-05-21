import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CreateUploadDescriptorDto } from "./dto/storage.dto";
import { LocalStorageProvider } from "./local-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import { type StorageDriver, type StoredFileView, type UploadDescriptorView } from "./storage-provider";

@Injectable()
export class StorageService {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    private readonly supabaseStorageProvider: SupabaseStorageProvider
  ) {}

  async createUploadDescriptor(
    tenantId: string,
    payload: CreateUploadDescriptorDto
  ): Promise<UploadDescriptorView> {
    const driver = this.resolveDriver();
    const input = {
      driver,
      tenantId,
      fileName: payload.fileName.trim(),
      mimeType: payload.mimeType?.trim() || "application/octet-stream",
      folder: payload.folder,
      bucketKind: payload.bucket,
      studentId: payload.studentId,
      schoolYearId: payload.schoolYearId,
      invoiceId: payload.invoiceId,
      userId: payload.userId
    };

    if (driver === "SUPABASE") {
      return this.supabaseStorageProvider.createUploadDescriptor(input);
    }

    return this.localStorageProvider.createUploadDescriptor(input);
  }

  async uploadUserAvatar(input: {
    tenantId: string;
    userId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
  }): Promise<StoredFileView> {
    const driver = this.resolveDriver();
    const uploadInput = {
      driver,
      tenantId: input.tenantId,
      userId: input.userId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bucketKind: "avatars" as const,
      folder: "avatars"
    };

    if (driver === "SUPABASE") {
      return this.supabaseStorageProvider.uploadBuffer(uploadInput, input.buffer);
    }

    return this.localStorageProvider.uploadBuffer(uploadInput, input.buffer);
  }

  private resolveDriver(): StorageDriver {
    const configuredProvider = this.configService
      .get<string>("STORAGE_PROVIDER", "")
      .trim()
      .toUpperCase();
    const normalized =
      configuredProvider ||
      this.configService.get<string>("FILE_STORAGE_DRIVER", "LOCAL").trim().toUpperCase();
    if (normalized === "S3") return "S3";
    if (normalized === "WEBHOOK") return "WEBHOOK";
    if (normalized === "SUPABASE") return "SUPABASE";
    return "LOCAL";
  }
}
