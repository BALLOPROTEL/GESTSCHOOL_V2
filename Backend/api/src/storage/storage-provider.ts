export type StorageDriver = "LOCAL" | "SUPABASE";

export type StorageBucketKind = "documents" | "avatars";

export type StoreObjectInput = {
  bucketKind: StorageBucketKind;
  key: string;
  mimeType: string;
  buffer: Buffer;
};

export type StoredObjectReference = {
  driver: StorageDriver;
  bucket: string;
  key: string;
  tenantId: string;
};

export type StoredFileView = StoredObjectReference & {
  originalName: string;
  mimeType: string;
  size: number;
};

export type DownloadedStoredFile = {
  buffer: Buffer;
  mimeType: string;
};

export interface StorageProvider {
  store(input: StoreObjectInput): Promise<{ bucket: string }>;
  read(reference: Pick<StoredObjectReference, "bucket" | "key">): Promise<DownloadedStoredFile>;
  delete(reference: Pick<StoredObjectReference, "bucket" | "key">): Promise<void>;
}
