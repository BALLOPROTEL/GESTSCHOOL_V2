import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type DownloadedStoredFile,
  type StorageBucketKind,
  type StorageProvider,
  type StoreObjectInput,
  type StoredObjectReference
} from "./storage-provider";

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async store(input: StoreObjectInput): Promise<{ bucket: string }> {
    const bucket = this.bucketName(input.bucketKind);
    const response = await this.request(
      `/object/${encodeURIComponent(bucket)}/${this.encodeObjectKey(input.key)}`,
      {
        method: "POST",
        headers: {
          ...this.headers(input.mimeType),
          "cache-control": input.bucketKind === "avatars" ? "3600" : "no-store",
          "x-upsert": "false"
        },
        body: new Uint8Array(input.buffer)
      }
    );
    await this.assertSuccess(response, "upload");
    return { bucket };
  }

  async createSignedUrl(
    reference: Pick<StoredObjectReference, "bucket" | "key">,
    expiresInSeconds: number
  ): Promise<string> {
    const response = await this.request(
      `/object/sign/${encodeURIComponent(reference.bucket)}/${this.encodeObjectKey(reference.key)}`,
      {
        method: "POST",
        headers: this.headers("application/json"),
        body: JSON.stringify({ expiresIn: expiresInSeconds })
      }
    );
    await this.assertSuccess(response, "signed URL creation");
    const payload = (await response.json()) as { signedURL?: unknown; signedUrl?: unknown };
    const signedPath =
      typeof payload.signedURL === "string"
        ? payload.signedURL
        : typeof payload.signedUrl === "string"
          ? payload.signedUrl
          : "";
    if (!signedPath) {
      throw new Error("Supabase Storage signed URL creation returned no URL.");
    }
    if (/^https:\/\//i.test(signedPath)) return signedPath;
    const supabaseOrigin = this.requiredConfig("SUPABASE_URL").replace(/\/+$/, "");
    return signedPath.startsWith("/storage/v1/")
      ? `${supabaseOrigin}${signedPath}`
      : `${this.storageBaseUrl()}/${signedPath.replace(/^\/+/, "")}`;
  }

  async read(
    reference: Pick<StoredObjectReference, "bucket" | "key">
  ): Promise<DownloadedStoredFile> {
    const response = await this.request(
      `/object/authenticated/${encodeURIComponent(reference.bucket)}/${this.encodeObjectKey(reference.key)}`,
      { method: "GET", headers: this.headers(undefined) }
    );
    await this.assertSuccess(response, "download");
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type")?.split(";", 1)[0] || "application/octet-stream"
    };
  }

  async delete(reference: Pick<StoredObjectReference, "bucket" | "key">): Promise<void> {
    const response = await this.request(`/object/${encodeURIComponent(reference.bucket)}`, {
      method: "DELETE",
      headers: this.headers("application/json"),
      body: JSON.stringify({ prefixes: [reference.key] })
    });
    if (response.status === 404) return;
    await this.assertSuccess(response, "delete");
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const configured = Number(
      this.configService.get<string>("SUPABASE_STORAGE_TIMEOUT_MS", "10000")
    );
    const timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : 10_000;
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${this.storageBaseUrl()}${path}`, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(handle);
    }
  }

  private async assertSuccess(response: Response, operation: string): Promise<void> {
    if (response.ok) return;
    const raw = (await response.text()).slice(0, 500);
    const safe = raw
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, "[redacted]");
    throw new Error(`Supabase Storage ${operation} failed (${response.status}): ${safe || "unknown error"}`);
  }

  private headers(contentType?: string): Record<string, string> {
    const serviceRoleKey = this.requiredConfig("SUPABASE_SERVICE_ROLE_KEY");
    return {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(contentType ? { "Content-Type": contentType } : {})
    };
  }

  private bucketName(kind: StorageBucketKind): string {
    const key =
      kind === "avatars"
        ? "SUPABASE_STORAGE_BUCKET_AVATARS"
        : "SUPABASE_STORAGE_BUCKET_DOCUMENTS";
    const fallback = kind === "avatars" ? "gestschool-avatars" : "gestschool-documents";
    const value = this.configService.get<string>(key, fallback).trim();
    if (!/^[a-z0-9][a-z0-9._-]{1,80}$/.test(value)) {
      throw new Error(`${key} is invalid.`);
    }
    return value;
  }

  private storageBaseUrl(): string {
    return `${this.requiredConfig("SUPABASE_URL").replace(/\/+$/, "")}/storage/v1`;
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key, "").trim();
    if (!value) throw new Error(`${key} is required for Supabase Storage integration.`);
    return value;
  }

  private encodeObjectKey(key: string): string {
    return key.split("/").map((part) => encodeURIComponent(part)).join("/");
  }
}
