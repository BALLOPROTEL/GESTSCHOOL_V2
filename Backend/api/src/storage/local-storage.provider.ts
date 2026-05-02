import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type CreateStorageUploadDescriptorInput,
  type StorageProvider,
  type UploadDescriptorView
} from "./storage-provider";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  createUploadDescriptor(input: CreateStorageUploadDescriptorInput): UploadDescriptorView {
    this.assertAllowedDriver(input.driver);

    const sanitizedFileName = this.sanitizeFileName(input.fileName);
    const folder = this.sanitizeFolder(input.folder);
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const key = `${input.tenantId}/${folder}/${yyyy}/${mm}/${randomUUID().slice(0, 12)}-${sanitizedFileName}`;

    const baseUrl = this.configService
      .get<string>("FILE_STORAGE_BASE_URL", "http://localhost:3000/files")
      .trim()
      .replace(/\/+$/, "");
    const fileUrl = `${baseUrl}/${key}`;

    let uploadUrl = fileUrl;
    if (input.driver === "S3") {
      const bucket = this.configService.get<string>("FILE_STORAGE_S3_BUCKET", "gestschool");
      uploadUrl = `s3://${bucket}/${key}`;
    }
    if (input.driver === "WEBHOOK") {
      uploadUrl = this.configService.get<string>("FILE_STORAGE_PRESIGN_ENDPOINT", "").trim();
    }

    return {
      driver: input.driver,
      tenantId: input.tenantId,
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      key,
      uploadUrl,
      fileUrl,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString()
    };
  }

  private assertAllowedDriver(driver: string): void {
    if (driver === "LOCAL" && this.configService.get<string>("NODE_ENV") === "production") {
      const allowLocal = this.configService
        .get<string>("FILE_STORAGE_ALLOW_LOCAL_IN_PROD", "false")
        .trim()
        .toLowerCase();
      if (allowLocal !== "true") {
        throw new Error(
          "FILE_STORAGE_DRIVER=LOCAL is disabled in production. Use FILE_STORAGE_DRIVER=SUPABASE."
        );
      }
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 140);
  }

  private sanitizeFolder(folder: string | undefined): string {
    const base = (folder || "general").trim().toLowerCase();
    const sanitized = base
      .replace(/[^a-z0-9/\-_]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .replace(/^-|-$/g, "");
    return sanitized || "general";
  }
}
