import { ConfigService } from "@nestjs/config";

import { LocalStorageProvider } from "../../src/storage/local-storage.provider";
import { StorageService } from "../../src/storage/storage.service";
import {
  type CreateStorageUploadDescriptorInput,
  type StoredFileView
} from "../../src/storage/storage-provider";
import { SupabaseStorageProvider } from "../../src/storage/supabase-storage.provider";

const configService = (values: Record<string, string | undefined>): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => values[key] ?? defaultValue)
  }) as unknown as ConfigService;

const avatarInput = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  userId: "user-1",
  fileName: "avatar.png",
  mimeType: "image/png",
  buffer: Buffer.from("avatar")
};

const storedAvatar = (driver: "LOCAL" | "SUPABASE"): StoredFileView => ({
  driver,
  tenantId: avatarInput.tenantId,
  fileName: avatarInput.fileName,
  mimeType: avatarInput.mimeType,
  key: `avatars/${avatarInput.fileName}`,
  fileUrl: `https://storage.example/${driver.toLowerCase()}/avatar.png`,
  size: avatarInput.buffer.byteLength
});

describe("storage production policy", () => {
  it("rejects LOCAL storage in production unless explicitly allowed", async () => {
    const provider = new LocalStorageProvider(
      configService({
        FILE_STORAGE_ALLOW_LOCAL_IN_PROD: "false",
        NODE_ENV: "production"
      })
    );

    await expect(
      provider.uploadBuffer(
        {
          driver: "LOCAL",
          tenantId: avatarInput.tenantId,
          userId: avatarInput.userId,
          fileName: avatarInput.fileName,
          mimeType: avatarInput.mimeType,
          bucketKind: "avatars",
          folder: "avatars"
        } satisfies CreateStorageUploadDescriptorInput,
        avatarInput.buffer
      )
    ).rejects.toThrow(
      "FILE_STORAGE_DRIVER=LOCAL is disabled in production. Use FILE_STORAGE_DRIVER=SUPABASE."
    );
  });

  it("routes avatar uploads to Supabase in production when Supabase runtime config exists", async () => {
    const localProvider = {
      createUploadDescriptor: jest.fn(),
      uploadBuffer: jest.fn().mockResolvedValue(storedAvatar("LOCAL"))
    } as unknown as LocalStorageProvider;
    const supabaseProvider = {
      createUploadDescriptor: jest.fn(),
      uploadBuffer: jest.fn().mockResolvedValue(storedAvatar("SUPABASE"))
    } as unknown as SupabaseStorageProvider;
    const service = new StorageService(
      configService({
        FILE_STORAGE_DRIVER: "LOCAL",
        NODE_ENV: "production",
        STORAGE_PROVIDER: "",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_URL: "https://gestschool.supabase.co"
      }),
      localProvider,
      supabaseProvider
    );

    await expect(service.uploadUserAvatar(avatarInput)).resolves.toMatchObject({
      driver: "SUPABASE",
      fileUrl: "https://storage.example/supabase/avatar.png"
    });
    expect(supabaseProvider.uploadBuffer).toHaveBeenCalledTimes(1);
    expect(localProvider.uploadBuffer).not.toHaveBeenCalled();
  });

  it("keeps production LOCAL blocked when Supabase is not configured", async () => {
    const service = new StorageService(
      configService({
        FILE_STORAGE_ALLOW_LOCAL_IN_PROD: "false",
        FILE_STORAGE_DRIVER: "LOCAL",
        NODE_ENV: "production",
        STORAGE_PROVIDER: ""
      }),
      new LocalStorageProvider(
        configService({
          FILE_STORAGE_ALLOW_LOCAL_IN_PROD: "false",
          NODE_ENV: "production"
        })
      ),
      {
        createUploadDescriptor: jest.fn(),
        uploadBuffer: jest.fn()
      } as unknown as SupabaseStorageProvider
    );

    await expect(service.uploadUserAvatar(avatarInput)).rejects.toThrow(
      "FILE_STORAGE_DRIVER=LOCAL is disabled in production. Use FILE_STORAGE_DRIVER=SUPABASE."
    );
  });
});
