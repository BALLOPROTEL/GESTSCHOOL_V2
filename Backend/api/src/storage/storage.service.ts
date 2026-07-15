import { randomUUID } from "node:crypto";

import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { type ValidatedUpload } from "./file-validation.service";
import { LocalStorageProvider } from "./local-storage.provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";
import {
  type DownloadedStoredFile,
  type StorageBucketKind,
  type StorageDriver,
  type StorageProvider,
  type StoredFileView,
  type StoredObjectReference
} from "./storage-provider";

@Injectable()
export class StorageService implements OnModuleInit {
  constructor(
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    private readonly supabaseStorageProvider: SupabaseStorageProvider
  ) {}

  onModuleInit(): void {
    this.resolveDriver();
  }

  async storeValidatedFile(input: {
    tenantId: string;
    bucketKind: StorageBucketKind;
    scope: readonly string[];
    file: ValidatedUpload;
  }): Promise<StoredFileView> {
    const driver = this.resolveDriver();
    const key = this.buildKey(input.tenantId, input.scope, input.file.extension);
    const result = await this.provider(driver).store({
      bucketKind: input.bucketKind,
      key,
      mimeType: input.file.mimeType,
      buffer: input.file.buffer
    });
    return {
      driver,
      tenantId: input.tenantId,
      originalName: input.file.originalName,
      mimeType: input.file.mimeType,
      size: input.file.size,
      key,
      bucket: result.bucket
    };
  }

  async createTemporaryAccessUrl(
    reference: StoredObjectReference,
    mimeType: string
  ): Promise<string> {
    this.assertReference(reference);
    if (reference.driver === "SUPABASE") {
      return this.supabaseStorageProvider.createSignedUrl(
        reference,
        this.signedUrlTtlSeconds()
      );
    }
    const file = await this.localStorageProvider.read(reference);
    return `data:${mimeType};base64,${file.buffer.toString("base64")}`;
  }

  async readFile(reference: StoredObjectReference): Promise<DownloadedStoredFile> {
    this.assertReference(reference);
    return this.provider(reference.driver).read(reference);
  }

  async deleteFile(reference: StoredObjectReference): Promise<void> {
    this.assertReference(reference);
    await this.provider(reference.driver).delete(reference);
  }

  private buildKey(tenantId: string, scope: readonly string[], extension: string): string {
    const normalizedScope = scope.map((value) => this.pathSegment(value));
    if (normalizedScope.length === 0) throw new Error("Storage scope is required.");
    return `tenants/${tenantId}/${normalizedScope.join("/")}/${randomUUID()}${extension}`;
  }

  private assertReference(reference: StoredObjectReference): void {
    const expectedPrefix = `tenants/${reference.tenantId}/`;
    if (!reference.key.startsWith(expectedPrefix) || reference.key.includes("..")) {
      throw new Error("Stored object does not belong to the requested tenant.");
    }
  }

  private provider(driver: StorageDriver): StorageProvider {
    return driver === "SUPABASE" ? this.supabaseStorageProvider : this.localStorageProvider;
  }

  private resolveDriver(): StorageDriver {
    const provider = this.configService.get<string>("STORAGE_PROVIDER", "").trim().toUpperCase();
    const legacyDriver = this.configService
      .get<string>("FILE_STORAGE_DRIVER", "LOCAL")
      .trim()
      .toUpperCase();
    const configured = provider || legacyDriver;
    if (configured === "LOCAL" || configured === "SUPABASE") return configured;
    if (configured === "S3" || configured === "WEBHOOK") {
      throw new Error(
        `${configured} storage is not implemented. Use FILE_STORAGE_DRIVER=LOCAL or SUPABASE.`
      );
    }
    throw new Error(`Unsupported storage driver: ${configured || "empty"}.`);
  }

  private pathSegment(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,100}$/.test(normalized)) {
      throw new Error("Invalid storage scope segment.");
    }
    return normalized;
  }

  private signedUrlTtlSeconds(): number {
    const configured = Number(
      this.configService.get<string>("SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS", "300")
    );
    return Number.isInteger(configured) && configured >= 60 && configured <= 900
      ? configured
      : 300;
  }
}
