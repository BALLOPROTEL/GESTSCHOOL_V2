import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  type DownloadedStoredFile,
  type StorageProvider,
  type StoreObjectInput,
  type StoredObjectReference
} from "./storage-provider";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  async store(input: StoreObjectInput): Promise<{ bucket: string }> {
    this.assertLocalAllowed();
    const path = this.absolutePath(input.bucketKind, input.key);
    const temporaryPath = `${path}.${randomUUID()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(temporaryPath, input.buffer, { flag: "wx", mode: 0o600 });
      await rename(temporaryPath, path);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
    return { bucket: input.bucketKind };
  }

  async read(
    reference: Pick<StoredObjectReference, "bucket" | "key">
  ): Promise<DownloadedStoredFile> {
    this.assertLocalAllowed();
    const path = this.absolutePath(reference.bucket, reference.key);
    return {
      buffer: await readFile(path),
      mimeType: "application/octet-stream"
    };
  }

  async delete(reference: Pick<StoredObjectReference, "bucket" | "key">): Promise<void> {
    this.assertLocalAllowed();
    const path = this.absolutePath(reference.bucket, reference.key);
    await rm(path, { force: true });
  }

  private absolutePath(bucket: string, key: string): string {
    if (!/^[a-z][a-z-]{1,40}$/.test(bucket)) {
      throw new Error("Invalid local storage bucket.");
    }
    const root = resolve(
      this.configService.get<string>("FILE_STORAGE_LOCAL_ROOT", "/tmp/gestschool-storage").trim()
    );
    const bucketRoot = resolve(root, bucket);
    const path = resolve(bucketRoot, key);
    if (path !== bucketRoot && !path.startsWith(`${bucketRoot}${sep}`)) {
      throw new Error("Storage path escapes the configured root.");
    }
    return path;
  }

  private assertLocalAllowed(): void {
    if (this.configService.get<string>("NODE_ENV", "").trim().toLowerCase() === "production") {
      throw new Error("FILE_STORAGE_DRIVER=LOCAL is disabled in production.");
    }
  }
}
