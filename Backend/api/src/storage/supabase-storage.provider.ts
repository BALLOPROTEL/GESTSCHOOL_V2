import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type CreateStorageUploadDescriptorInput,
  type StorageBucketKind,
  type StorageProvider,
  type UploadDescriptorView
} from "./storage-provider";

type JsonObject = Record<string, unknown>;

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async createUploadDescriptor(
    input: CreateStorageUploadDescriptorInput
  ): Promise<UploadDescriptorView> {
    const bucketKind = input.bucketKind || "documents";
    const bucket = this.bucketName(bucketKind);
    const fileName = this.sanitizeFileName(input.fileName);
    const key = this.buildObjectPath(input, bucketKind, fileName);
    const expiresIn = this.resolveSignedUploadTtlSeconds();
    const signedUpload = await this.createSignedUploadUrl(bucket, key, expiresIn);
    const now = new Date();

    return {
      driver: "SUPABASE",
      tenantId: input.tenantId,
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      key,
      uploadUrl: signedUpload.uploadUrl,
      fileUrl: this.authenticatedObjectUrl(bucket, key),
      expiresAt: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      bucket,
      token: signedUpload.token
    };
  }

  private async createSignedUploadUrl(
    bucket: string,
    key: string,
    expiresIn: number
  ): Promise<{ uploadUrl: string; token?: string }> {
    const response = await this.fetchJson(
      `${this.storageBaseUrl()}/object/upload/sign/${encodeURIComponent(bucket)}/${this.encodeObjectKey(key)}`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          expiresIn,
          upsert: false
        })
      }
    );

    const signedURL =
      this.stringValue(response.signedURL) ||
      this.stringValue(response.signedUrl) ||
      this.stringValue(response.url);
    const token = this.stringValue(response.token) || undefined;
    if (!signedURL && !token) {
      throw new Error("Supabase signed upload response is missing signed URL or token.");
    }

    return {
      uploadUrl: signedURL ? this.absoluteStorageUrl(signedURL) : this.uploadUrlFromToken(bucket, key, token!),
      token
    };
  }

  private headers(): Record<string, string> {
    const serviceRoleKey = this.requiredConfig("SUPABASE_SERVICE_ROLE_KEY");
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    };
  }

  private storageBaseUrl(): string {
    return `${this.supabaseUrl()}/storage/v1`;
  }

  private supabaseUrl(): string {
    return this.requiredConfig("SUPABASE_URL").replace(/\/+$/, "");
  }

  private bucketName(kind: StorageBucketKind): string {
    const envByKind: Record<StorageBucketKind, string> = {
      documents: "SUPABASE_STORAGE_BUCKET_DOCUMENTS",
      receipts: "SUPABASE_STORAGE_BUCKET_RECEIPTS",
      "report-cards": "SUPABASE_STORAGE_BUCKET_REPORT_CARDS",
      avatars: "SUPABASE_STORAGE_BUCKET_AVATARS"
    };
    const defaults: Record<StorageBucketKind, string> = {
      documents: "gestschool-documents",
      receipts: "gestschool-receipts",
      "report-cards": "gestschool-report-cards",
      avatars: "gestschool-avatars"
    };
    return this.configService.get<string>(envByKind[kind], defaults[kind]).trim();
  }

  private buildObjectPath(
    input: CreateStorageUploadDescriptorInput,
    bucketKind: StorageBucketKind,
    fileName: string
  ): string {
    const prefix = `tenants/${input.tenantId}`;
    const uniqueFileName = `${randomUUID().slice(0, 12)}-${fileName}`;
    if (bucketKind === "receipts") {
      return `${prefix}/receipts/${this.pathSegment(input.invoiceId || "unassigned")}/${uniqueFileName}`;
    }
    if (bucketKind === "report-cards") {
      return (
        `${prefix}/report-cards/${this.pathSegment(input.studentId || "unassigned")}` +
        `/${this.pathSegment(input.schoolYearId || "unknown-school-year")}/${uniqueFileName}`
      );
    }
    if (bucketKind === "avatars") {
      return `${prefix}/avatars/${this.pathSegment(input.userId || "unassigned")}/${uniqueFileName}`;
    }
    if (input.folder?.trim()) {
      return `${prefix}/${this.sanitizeFolder(input.folder)}/${uniqueFileName}`;
    }
    return `${prefix}/students/${this.pathSegment(input.studentId || "unassigned")}/documents/${uniqueFileName}`;
  }

  private authenticatedObjectUrl(bucket: string, key: string): string {
    return `${this.storageBaseUrl()}/object/authenticated/${encodeURIComponent(bucket)}/${this.encodeObjectKey(key)}`;
  }

  private uploadUrlFromToken(bucket: string, key: string, token: string): string {
    return (
      `${this.storageBaseUrl()}/object/upload/sign/${encodeURIComponent(bucket)}/` +
      `${this.encodeObjectKey(key)}?token=${encodeURIComponent(token)}`
    );
  }

  private absoluteStorageUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }
    if (url.startsWith("/storage/v1/")) {
      return `${this.supabaseUrl()}${url}`;
    }
    if (url.startsWith("/")) {
      return `${this.storageBaseUrl()}${url}`;
    }
    return `${this.storageBaseUrl()}/${url}`;
  }

  private async fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
    const timeoutMs = Number(this.configService.get<string>("SUPABASE_STORAGE_TIMEOUT_MS", "10000"));
    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), effectiveTimeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: abortController.signal
      });
      const raw = await response.text();
      const parsed = this.asObject(this.parseMaybeJson(raw));
      if (!response.ok) {
        throw new Error(`Supabase Storage request failed (${response.status}): ${this.safeErrorText(parsed)}`);
      }
      return parsed;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) {
      throw new Error(`${key} is required for Supabase Storage integration.`);
    }
    return value;
  }

  private resolveSignedUploadTtlSeconds(): number {
    const raw = Number(this.configService.get<string>("SUPABASE_STORAGE_SIGNED_UPLOAD_TTL_SECONDS", "7200"));
    return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 7200) : 7200;
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

  private sanitizeFolder(folder: string): string {
    return folder
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9/\-_]+/g, "-")
      .replace(/\/+/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .replace(/^-|-$/g, "") || "documents";
  }

  private pathSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "unknown";
  }

  private encodeObjectKey(key: string): string {
    return key.split("/").map((part) => encodeURIComponent(part)).join("/");
  }

  private parseMaybeJson(value: unknown): unknown {
    if (typeof value !== "string") {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private stringValue(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private safeErrorText(value: JsonObject): string {
    return JSON.stringify({
      statusCode: value.statusCode,
      error: value.error,
      message: value.message
    }).slice(0, 500);
  }
}
