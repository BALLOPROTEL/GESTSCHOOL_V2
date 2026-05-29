import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type CreateStorageUploadDescriptorInput,
  type StoredFileView,
  type StorageBucketKind,
  type StorageProvider,
  type UploadDescriptorView
} from "./storage-provider";

type JsonObject = Record<string, unknown>;

class SupabaseStorageRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly response: JsonObject,
    readonly raw: string
  ) {
    super(message);
  }
}

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

  async uploadBuffer(
    input: CreateStorageUploadDescriptorInput,
    buffer: Buffer
  ): Promise<StoredFileView> {
    const bucketKind = input.bucketKind || "documents";
    const bucket = this.bucketName(bucketKind);
    const fileName = this.sanitizeFileName(input.fileName);
    const key = this.buildObjectPath(input, bucketKind, fileName);
    const body = new Uint8Array(buffer);

    try {
      await this.uploadObject(bucket, key, input.mimeType, body);
    } catch (error) {
      if (bucketKind !== "avatars" || !this.isBucketMissingError(error)) {
        throw error;
      }

      await this.createAvatarBucket(bucket);
      await this.uploadObject(bucket, key, input.mimeType, body);
    }

    return {
      driver: "SUPABASE",
      tenantId: input.tenantId,
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      key,
      fileUrl: this.objectUrl(bucket, key, bucketKind),
      bucket,
      size: buffer.byteLength
    };
  }

  private async uploadObject(
    bucket: string,
    key: string,
    mimeType: string,
    body: BodyInit
  ): Promise<void> {
    await this.fetchJson(
      `${this.storageBaseUrl()}/object/${encodeURIComponent(bucket)}/${this.encodeObjectKey(key)}`,
      {
        method: "POST",
        headers: {
          ...this.headers(mimeType),
          "cache-control": "3600",
          "x-upsert": "true"
        },
        body
      }
    );
  }

  private async createAvatarBucket(bucket: string): Promise<void> {
    await this.fetchOptionalJson(
      `${this.storageBaseUrl()}/bucket`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          name: bucket,
          public: this.avatarsArePublic(),
          file_size_limit: this.avatarMaxBytes(),
          allowed_mime_types: ["image/jpeg", "image/png", "image/webp"]
        })
      },
      [409]
    );
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

  private headers(contentType = "application/json"): Record<string, string> {
    const serviceRoleKey = this.requiredConfig("SUPABASE_SERVICE_ROLE_KEY");
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType
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

  private objectUrl(bucket: string, key: string, bucketKind: StorageBucketKind): string {
    if (bucketKind === "avatars" && this.avatarsArePublic()) {
      return `${this.storageBaseUrl()}/object/public/${encodeURIComponent(bucket)}/${this.encodeObjectKey(key)}`;
    }
    return this.authenticatedObjectUrl(bucket, key);
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

  private async fetchOptionalJson(
    url: string,
    init: RequestInit,
    optionalStatuses: number[]
  ): Promise<JsonObject | null> {
    const response = await this.fetchStorage(url, init);
    if (response.ok) {
      return response.parsed;
    }
    if (optionalStatuses.includes(response.status)) {
      return null;
    }
    throw this.createStorageError(response);
  }

  private async fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
    const response = await this.fetchStorage(url, init);
    if (!response.ok) {
      throw this.createStorageError(response);
    }
    return response.parsed;
  }

  private async fetchStorage(
    url: string,
    init: RequestInit
  ): Promise<{ ok: boolean; parsed: JsonObject; raw: string; status: number }> {
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
      return { ok: response.ok, parsed, raw, status: response.status };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private createStorageError(response: {
    parsed: JsonObject;
    raw: string;
    status: number;
  }): SupabaseStorageRequestError {
    const safeText = this.safeErrorText(response.parsed, response.raw);
    return new SupabaseStorageRequestError(
      `Supabase Storage request failed (${response.status}): ${safeText}`,
      response.status,
      response.parsed,
      response.raw
    );
  }

  private isBucketMissingError(error: unknown): boolean {
    if (!(error instanceof SupabaseStorageRequestError)) {
      return false;
    }

    const text = `${this.safeErrorText(error.response, error.raw)} ${error.message}`.toLowerCase();
    return (
      error.status === 404 ||
      text.includes("bucket not found") ||
      text.includes("bucket_not_found") ||
      text.includes("not found")
    );
  }

  private avatarsArePublic(): boolean {
    return this.configService
      .get<string>("SUPABASE_STORAGE_AVATARS_PUBLIC", "true")
      .trim()
      .toLowerCase() !== "false";
  }

  private avatarMaxBytes(): number {
    const raw = Number(this.configService.get<string>("USER_AVATAR_MAX_BYTES", `${2 * 1024 * 1024}`));
    return Number.isFinite(raw) && raw > 0 ? raw : 2 * 1024 * 1024;
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

  private safeErrorText(value: JsonObject, raw = ""): string {
    const jsonText = JSON.stringify({
      statusCode: value.statusCode,
      error: value.error,
      message: value.message
    });
    if (jsonText !== "{}") {
      return jsonText.slice(0, 500);
    }
    return raw.trim().slice(0, 500) || "{}";
  }

}
