export type StorageDriver = "LOCAL" | "S3" | "WEBHOOK" | "SUPABASE";

export type StorageBucketKind = "documents" | "receipts" | "report-cards" | "avatars";

export type CreateStorageUploadDescriptorInput = {
  tenantId: string;
  driver: StorageDriver;
  fileName: string;
  mimeType: string;
  folder?: string;
  bucketKind?: StorageBucketKind;
  studentId?: string;
  schoolYearId?: string;
  invoiceId?: string;
  userId?: string;
};

export type UploadDescriptorView = {
  driver: StorageDriver;
  tenantId: string;
  fileName: string;
  mimeType: string;
  key: string;
  uploadUrl: string;
  fileUrl: string;
  expiresAt: string;
  bucket?: string;
  token?: string;
};

export interface StorageProvider {
  createUploadDescriptor(
    input: CreateStorageUploadDescriptorInput
  ): Promise<UploadDescriptorView> | UploadDescriptorView;
}
