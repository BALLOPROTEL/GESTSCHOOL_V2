import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigService } from "@nestjs/config";

import { LocalStorageProvider } from "../../src/storage/local-storage.provider";
import { StorageService } from "../../src/storage/storage.service";
import { type StorageProvider } from "../../src/storage/storage-provider";
import { SupabaseStorageProvider } from "../../src/storage/supabase-storage.provider";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";

const configService = (values: Record<string, string | undefined>): ConfigService =>
  ({
    get: jest.fn((key: string, defaultValue = "") => values[key] ?? defaultValue)
  }) as unknown as ConfigService;

const validatedPng = {
  originalName: "avatar.png",
  extension: ".png",
  mimeType: "image/png",
  size: 4,
  buffer: Buffer.from("safe")
};

describe("storage production policy", () => {
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), "gestschool-storage-test-"));
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("stores private local files under a server-generated tenant key", async () => {
    const config = configService({
      FILE_STORAGE_DRIVER: "LOCAL",
      FILE_STORAGE_LOCAL_ROOT: storageRoot,
      NODE_ENV: "test"
    });
    const local = new LocalStorageProvider(config);
    const service = new StorageService(config, local, {} as SupabaseStorageProvider);

    const stored = await service.storeValidatedFile({
      tenantId: TENANT_ID,
      bucketKind: "avatars",
      scope: ["avatars", "user-1"],
      file: validatedPng
    });

    expect(stored.key).toMatch(
      new RegExp(`^tenants/${TENANT_ID}/avatars/user-1/[0-9a-f-]+\\.png$`)
    );
    expect(stored.key).not.toContain(stored.originalName);
    await expect(readFile(join(storageRoot, "avatars", stored.key))).resolves.toEqual(
      validatedPng.buffer
    );
    await expect(service.createTemporaryAccessUrl(stored, "image/png")).resolves.toBe(
      `data:image/png;base64,${validatedPng.buffer.toString("base64")}`
    );
    expect((await readdir(storageRoot, { recursive: true })).some((name) => name.endsWith(".tmp")))
      .toBe(false);

    await service.deleteFile(stored);
    await expect(readFile(join(storageRoot, "avatars", stored.key))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("creates unique keys for concurrent uploads", async () => {
    const config = configService({
      FILE_STORAGE_DRIVER: "LOCAL",
      FILE_STORAGE_LOCAL_ROOT: storageRoot,
      NODE_ENV: "test"
    });
    const service = new StorageService(
      config,
      new LocalStorageProvider(config),
      {} as SupabaseStorageProvider
    );

    const stored = await Promise.all(
      Array.from({ length: 12 }, () =>
        service.storeValidatedFile({
          tenantId: TENANT_ID,
          bucketKind: "documents",
          scope: ["teachers", "teacher-1", "documents"],
          file: validatedPng
        })
      )
    );

    expect(new Set(stored.map((item) => item.key))).toHaveProperty("size", 12);
  });

  it("rejects cross-tenant and traversal references before provider access", async () => {
    const local = {
      read: jest.fn(),
      delete: jest.fn(),
      store: jest.fn()
    } satisfies StorageProvider;
    const config = configService({ FILE_STORAGE_DRIVER: "LOCAL", NODE_ENV: "test" });
    const service = new StorageService(
      config,
      local as unknown as LocalStorageProvider,
      {} as SupabaseStorageProvider
    );

    await expect(
      service.readFile({
        tenantId: TENANT_ID,
        driver: "LOCAL",
        bucket: "documents",
        key: "tenants/other-tenant/documents/file.pdf"
      })
    ).rejects.toThrow("does not belong");
    await expect(
      service.deleteFile({
        tenantId: TENANT_ID,
        driver: "LOCAL",
        bucket: "documents",
        key: `tenants/${TENANT_ID}/../file.pdf`
      })
    ).rejects.toThrow("does not belong");
    expect(local.read).not.toHaveBeenCalled();
    expect(local.delete).not.toHaveBeenCalled();
  });

  it.each(["S3", "WEBHOOK"])("fails startup explicitly for unimplemented %s storage", (driver) => {
    const config = configService({ FILE_STORAGE_DRIVER: driver, NODE_ENV: "production" });
    const service = new StorageService(
      config,
      {} as LocalStorageProvider,
      {} as SupabaseStorageProvider
    );

    expect(() => service.onModuleInit()).toThrow(`${driver} storage is not implemented`);
  });

  it("rejects LOCAL storage in production without an override", async () => {
    const config = configService({
      FILE_STORAGE_DRIVER: "LOCAL",
      FILE_STORAGE_LOCAL_ROOT: storageRoot,
      NODE_ENV: "production"
    });
    const service = new StorageService(
      config,
      new LocalStorageProvider(config),
      {} as SupabaseStorageProvider
    );

    await expect(
      service.storeValidatedFile({
        tenantId: TENANT_ID,
        bucketKind: "documents",
        scope: ["teachers", "teacher-1", "documents"],
        file: validatedPng
      })
    ).rejects.toThrow("LOCAL is disabled in production");
  });
});

describe("SupabaseStorageProvider", () => {
  const serviceRoleKey = "server-only-service-role-key-with-safe-test-length";
  const config = configService({
    SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_STORAGE_BUCKET_DOCUMENTS: "gestschool-documents",
    SUPABASE_STORAGE_BUCKET_AVATARS: "gestschool-avatars",
    SUPABASE_STORAGE_TIMEOUT_MS: "1000"
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uploads, reads, signs and deletes private objects without exposing the service role", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url.includes("/object/sign/") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            signedURL:
              "/storage/v1/object/sign/gestschool-avatars/avatar.png?token=short-lived-token"
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (url.includes("/object/authenticated/") && init?.method === "GET") {
        return new Response(new Uint8Array(Buffer.from("private-content")), {
          status: 200,
          headers: { "content-type": "image/png" }
        });
      }
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({ message: "deleted" }), { status: 200 });
      }
      return new Response(JSON.stringify({ Key: "stored" }), { status: 200 });
    });
    const provider = new SupabaseStorageProvider(config);
    const key = `tenants/${TENANT_ID}/avatars/user-1/avatar.png`;

    await expect(
      provider.store({ bucketKind: "avatars", key, mimeType: "image/png", buffer: Buffer.from("safe") })
    ).resolves.toEqual({ bucket: "gestschool-avatars" });
    await expect(provider.read({ bucket: "gestschool-avatars", key })).resolves.toEqual({
      buffer: Buffer.from("private-content"),
      mimeType: "image/png"
    });
    const signedUrl = await provider.createSignedUrl(
      { bucket: "gestschool-avatars", key },
      300
    );
    expect(signedUrl).toBe(
      "https://project-ref.supabase.co/storage/v1/object/sign/gestschool-avatars/avatar.png?token=short-lived-token"
    );
    expect(signedUrl).not.toContain(serviceRoleKey);
    await expect(provider.delete({ bucket: "gestschool-avatars", key })).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    const signCall = fetchSpy.mock.calls.find(([input]) => input.toString().includes("/object/sign/"));
    expect(signCall?.[0].toString()).toContain(
      `tenants/${TENANT_ID}/avatars/user-1/avatar.png`
    );
    expect(signCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expiresIn: 300 })
      })
    );
  });

  it("fails closed when Supabase does not return a signed URL", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const provider = new SupabaseStorageProvider(config);

    await expect(
      provider.createSignedUrl(
        {
          bucket: "gestschool-avatars",
          key: `tenants/${TENANT_ID}/avatars/user-1/avatar.png`
        },
        300
      )
    ).rejects.toThrow("returned no URL");
  });
});
