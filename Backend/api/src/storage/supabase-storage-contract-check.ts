import { ConfigService } from "@nestjs/config";

import { LocalStorageProvider } from "./local-storage.provider";
import { StorageService } from "./storage.service";
import { type StoredFileView } from "./storage-provider";
import { SupabaseStorageProvider } from "./supabase-storage.provider";

const TENANT_A = "00000000-0000-4000-8000-000000000001";
const TENANT_B = "00000000-0000-4000-8000-000000000002";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=",
  "base64"
);

type CheckResult = {
  bucketsPrivate: boolean;
  avatarUploaded: boolean;
  documentUploaded: boolean;
  anonymousAccessDenied: boolean;
  signedUrlReadable: boolean;
  signedUrlExpired: boolean;
  tenantIsolationEnforced: boolean;
  missingObjectRejected: boolean;
  deletionVerified: boolean;
  compensationVerified: boolean;
};

const required = (config: ConfigService, key: string): string => {
  const value = config.get<string>(key, "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const storageBaseUrl = (config: ConfigService): string =>
  `${required(config, "SUPABASE_URL").replace(/\/+$/u, "")}/storage/v1`;

const serviceHeaders = (config: ConfigService): Record<string, string> => {
  const serviceRoleKey = required(config, "SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
};

const isMissingBucketResponse = async (response: Response): Promise<boolean> => {
  if (response.status === 404) return true;
  if (response.status !== 400) return false;
  try {
    const payload = (await response.clone().json()) as { statusCode?: unknown };
    return payload.statusCode === 404 || payload.statusCode === "404";
  } catch {
    return false;
  }
};

const ensurePrivateBucket = async (config: ConfigService, bucket: string): Promise<void> => {
  const baseUrl = storageBaseUrl(config);
  const headers = serviceHeaders(config);
  let response = await fetch(`${baseUrl}/bucket/${encodeURIComponent(bucket)}`, { headers });
  if (await isMissingBucketResponse(response)) {
    response = await fetch(`${baseUrl}/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: false,
        file_size_limit: 10 * 1024 * 1024
      })
    });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Private bucket creation failed (${response.status}).`);
    }
    response = await fetch(`${baseUrl}/bucket/${encodeURIComponent(bucket)}`, { headers });
  }
  if (!response.ok) throw new Error(`Private bucket lookup failed (${response.status}).`);
  const payload = (await response.json()) as { public?: unknown };
  if (payload.public !== false) throw new Error("Storage contract requires private buckets.");
};

const expectProviderReadFailure = async (
  provider: SupabaseStorageProvider,
  reference: Pick<StoredFileView, "bucket" | "key">
): Promise<void> => {
  try {
    await provider.read(reference);
  } catch {
    return;
  }
  throw new Error("Expected Supabase Storage read to fail.");
};

const publicObjectStatus = async (
  config: ConfigService,
  reference: Pick<StoredFileView, "bucket" | "key">
): Promise<number> =>
  (
    await fetch(
      `${storageBaseUrl(config)}/object/public/${encodeURIComponent(reference.bucket)}/${reference.key
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")}`
    )
  ).status;

const technicalUpload = (name: string) => ({
  originalName: name,
  extension: ".png",
  mimeType: "image/png",
  size: PNG_1X1.byteLength,
  buffer: PNG_1X1,
  width: 1,
  height: 1
});

const run = async (): Promise<CheckResult> => {
  const config = new ConfigService(process.env);
  const avatarBucket = required(config, "SUPABASE_STORAGE_BUCKET_AVATARS");
  const documentBucket = required(config, "SUPABASE_STORAGE_BUCKET_DOCUMENTS");
  await ensurePrivateBucket(config, avatarBucket);
  await ensurePrivateBucket(config, documentBucket);

  const provider = new SupabaseStorageProvider(config);
  const storage = new StorageService(
    config,
    new LocalStorageProvider(config),
    provider
  );
  storage.onModuleInit();

  const avatar = await storage.storeValidatedFile({
    tenantId: TENANT_A,
    bucketKind: "avatars",
    scope: ["rc-contract", "avatar"],
    file: technicalUpload("technical-avatar.png")
  });
  const document = await storage.storeValidatedFile({
    tenantId: TENANT_A,
    bucketKind: "documents",
    scope: ["rc-contract", "document"],
    file: technicalUpload("technical-document.png")
  });

  const result: CheckResult = {
    bucketsPrivate: true,
    avatarUploaded: avatar.bucket === avatarBucket,
    documentUploaded: document.bucket === documentBucket,
    anonymousAccessDenied: false,
    signedUrlReadable: false,
    signedUrlExpired: false,
    tenantIsolationEnforced: false,
    missingObjectRejected: false,
    deletionVerified: false,
    compensationVerified: false
  };

  try {
    result.anonymousAccessDenied =
      (await publicObjectStatus(config, avatar)) !== 200 &&
      (await publicObjectStatus(config, document)) !== 200;

    const signedUrl = await provider.createSignedUrl(avatar, 1);
    const signedResponse = await fetch(signedUrl);
    result.signedUrlReadable =
      signedResponse.ok && Buffer.from(await signedResponse.arrayBuffer()).equals(PNG_1X1);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    result.signedUrlExpired = !(await fetch(signedUrl)).ok;

    try {
      await storage.readFile({ ...avatar, tenantId: TENANT_B });
    } catch {
      result.tenantIsolationEnforced = true;
    }

    await expectProviderReadFailure(provider, {
      bucket: documentBucket,
      key: `tenants/${TENANT_A}/rc-contract/missing/object.png`
    });
    result.missingObjectRejected = true;

    await storage.deleteFile(document);
    await expectProviderReadFailure(provider, document);
    result.deletionVerified = true;

    const compensationObject = await storage.storeValidatedFile({
      tenantId: TENANT_A,
      bucketKind: "documents",
      scope: ["rc-contract", "compensation"],
      file: technicalUpload("technical-compensation.png")
    });
    try {
      throw new Error("simulated database failure");
    } catch {
      await storage.deleteFile(compensationObject);
    }
    await expectProviderReadFailure(provider, compensationObject);
    result.compensationVerified = true;
  } finally {
    await Promise.allSettled([storage.deleteFile(avatar), storage.deleteFile(document)]);
  }

  const failedChecks = Object.entries(result)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedChecks.length > 0) {
    throw new Error(`Supabase Storage contract checks failed: ${failedChecks.join(", ")}.`);
  }
  return result;
};

if (require.main === module) {
  void run()
    .then((result) => {
      process.stdout.write(
        `${JSON.stringify({ status: "pass", checks: Object.keys(result).length })}\n`
      );
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "unknown error";
      process.stderr.write(
        `${JSON.stringify({
          status: "fail",
          error: message
            .replace(/Bearer\s+\S+/giu, "Bearer [redacted]")
            .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, "[redacted]")
        })}\n`
      );
      process.exitCode = 1;
    });
}

export { run as runSupabaseStorageContractCheck };
