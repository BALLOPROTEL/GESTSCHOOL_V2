import { createHash } from "node:crypto";

import {
  type UploadCategory,
  type ValidatedUpload,
} from "./file-validation.service";

export const LEGACY_STORAGE_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const CANONICAL_STORAGE_TENANT_ID =
  "00000000-0000-4000-8000-000000000001";

export type LegacyStorageKind =
  | "avatar"
  | "teacher-document"
  | "attendance-attachment";

export type LegacyStorageMetadata = {
  driver: string | null;
  bucket: string | null;
  key: string | null;
  mimeType: string | null;
  size: number | null;
};

export type LegacyStorageRecord = {
  kind: LegacyStorageKind;
  id: string;
  tenantId: string;
  parentId: string;
  sourceReference: string;
  originalName: string;
  declaredMimeType: string | null;
  declaredSize: number | null;
  parentExists: boolean;
  metadata: LegacyStorageMetadata;
};

export type LegacySourceFile = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
};

export type MigrationObjectReference = {
  bucket: string;
  key: string;
};

export type LegacyMigrationManifestEntry = {
  kind: LegacyStorageKind;
  recordId: string;
  tenantId: string;
  sourceFingerprint: string;
  checksum: string;
  size: number;
  mimeType: string;
  destinationBucket: string;
  destinationKey: string;
  status: "ready" | "object-present";
};

export type LegacyMigrationStatus =
  | "ready"
  | "migrated"
  | "already-migrated"
  | "object-present"
  | "missing"
  | "orphan"
  | "blocked"
  | "error";

export type LegacyMigrationResult = {
  kind: LegacyStorageKind;
  recordId: string;
  recordFingerprint: string;
  sourceFingerprint: string;
  status: LegacyMigrationStatus;
  checksum?: string;
  size?: number;
  mimeType?: string;
  destinationBucket?: string;
  destinationKey?: string;
  reason?: string;
  uploaded?: boolean;
  compensated?: boolean;
};

export type LegacyMigrationReport = {
  mode: "dry-run" | "apply";
  total: number;
  counts: Record<LegacyMigrationStatus, number>;
  results: LegacyMigrationResult[];
};

export type LegacyMigrationJournalEvent = {
  operationId: string;
  recordFingerprint: string;
  sourceFingerprint: string;
  status: LegacyMigrationStatus;
  attempt: number;
  checksum?: string;
  destinationFingerprint?: string;
  timestamp: string;
};

export interface LegacyStorageSource {
  read(record: LegacyStorageRecord): Promise<LegacySourceFile | null>;
}

export interface LegacyStorageTarget {
  exists(reference: MigrationObjectReference): Promise<boolean>;
  upload(
    reference: MigrationObjectReference,
    file: Pick<ValidatedUpload, "buffer" | "mimeType">,
  ): Promise<void>;
  download(reference: MigrationObjectReference): Promise<Buffer>;
  delete(reference: MigrationObjectReference): Promise<void>;
  createSignedUrl(
    reference: MigrationObjectReference,
    expiresInSeconds: number,
  ): Promise<string>;
}

export interface LegacyStorageMetadataRepository {
  updateMetadata(input: {
    record: LegacyStorageRecord;
    destination: MigrationObjectReference;
    validated: ValidatedUpload;
  }): Promise<void>;
}

export interface LegacyStorageFileValidator {
  validate(
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    category: UploadCategory,
  ): Promise<ValidatedUpload>;
}

export interface LegacyMigrationJournal {
  append(event: LegacyMigrationJournalEvent): Promise<void>;
}

export type RunLegacyStorageMigrationOptions = {
  mode: "dry-run" | "apply";
  operationId: string;
  approvedManifest?: ReadonlyMap<string, LegacyMigrationManifestEntry>;
  completedRecordFingerprints?: ReadonlySet<string>;
};

const EMPTY_COUNTS = (): Record<LegacyMigrationStatus, number> => ({
  ready: 0,
  migrated: 0,
  "already-migrated": 0,
  "object-present": 0,
  missing: 0,
  orphan: 0,
  blocked: 0,
  error: 0,
});

export class LegacyStorageMigrationEngine {
  constructor(
    private readonly source: LegacyStorageSource,
    private readonly target: LegacyStorageTarget,
    private readonly repository: LegacyStorageMetadataRepository,
    private readonly validator: LegacyStorageFileValidator,
    private readonly journal: LegacyMigrationJournal,
  ) {}

  async run(
    records: readonly LegacyStorageRecord[],
    options: RunLegacyStorageMigrationOptions,
  ): Promise<LegacyMigrationReport> {
    if (options.mode === "apply" && !options.approvedManifest) {
      throw new Error("Apply mode requires an approved dry-run manifest.");
    }

    const results: LegacyMigrationResult[] = [];
    for (const record of records) {
      results.push(await this.processRecord(record, options));
    }

    const counts = EMPTY_COUNTS();
    for (const result of results) counts[result.status] += 1;
    return { mode: options.mode, total: records.length, counts, results };
  }

  private async processRecord(
    record: LegacyStorageRecord,
    options: RunLegacyStorageMigrationOptions,
  ): Promise<LegacyMigrationResult> {
    const recordFingerprint = fingerprint(`${record.kind}:${record.id}`);
    const sourceFingerprint = fingerprint(record.sourceReference);
    const base: LegacyMigrationResult = {
      kind: record.kind,
      recordId: record.id,
      recordFingerprint,
      sourceFingerprint,
      status: "error",
    };

    if (!this.isExpectedTenant(record.tenantId)) {
      return this.finish(base, options, "error", "tenant-isolation");
    }
    if (
      options.mode === "apply" &&
      record.tenantId !== CANONICAL_STORAGE_TENANT_ID
    ) {
      return this.finish(
        base,
        options,
        "blocked",
        "canonical-tenant-required-before-apply",
      );
    }
    if (!record.parentExists) {
      return this.finish(base, options, "orphan", "missing-parent-resource");
    }
    if (!record.sourceReference.trim()) {
      return this.finish(base, options, "missing", "empty-source-reference");
    }
    if (this.hasCanonicalMetadata(record)) {
      return this.finish(base, options, "already-migrated");
    }
    if (options.completedRecordFingerprints?.has(recordFingerprint)) {
      return this.finish(
        base,
        options,
        "blocked",
        "completed-journal-without-database-metadata",
      );
    }

    let sourceFile: LegacySourceFile | null;
    try {
      sourceFile = await this.source.read(record);
    } catch (error) {
      return this.finish(
        base,
        options,
        "blocked",
        safeReason(error, "source-read-failed"),
      );
    }
    if (!sourceFile) {
      return this.finish(base, options, "missing", "source-object-not-found");
    }

    let validated: ValidatedUpload;
    try {
      validated = await this.validator.validate(
        {
          originalname: sourceFile.originalName,
          mimetype: sourceFile.mimeType,
          size: sourceFile.buffer.byteLength,
          buffer: sourceFile.buffer,
        },
        categoryFor(record.kind),
      );
    } catch (error) {
      return this.finish(
        base,
        options,
        "error",
        safeReason(error, "file-validation-failed"),
      );
    }

    const checksum = sha256(validated.buffer);
    const destination = this.destination(record, validated.extension, checksum);
    Object.assign(base, {
      checksum,
      size: validated.size,
      mimeType: validated.mimeType,
      destinationBucket: destination.bucket,
      destinationKey: destination.key,
    });

    const approved = options.approvedManifest?.get(recordFingerprint);
    if (options.mode === "apply" && !manifestMatches(approved, base)) {
      return this.finish(base, options, "blocked", "dry-run-manifest-mismatch");
    }

    let objectExists: boolean;
    try {
      objectExists = await this.target.exists(destination);
      if (objectExists) {
        const targetBytes = await this.target.download(destination);
        if (
          targetBytes.byteLength !== validated.size ||
          sha256(targetBytes) !== checksum
        ) {
          return this.finish(
            base,
            options,
            "error",
            "destination-content-mismatch",
          );
        }
      }
    } catch (error) {
      return this.finish(
        base,
        options,
        "error",
        safeReason(error, "target-verification-failed"),
      );
    }

    if (options.mode === "dry-run") {
      return this.finish(
        base,
        options,
        objectExists ? "object-present" : "ready",
      );
    }

    let uploaded = false;
    try {
      if (!objectExists) {
        await this.target.upload(destination, validated);
        uploaded = true;
        base.uploaded = true;
        const storedBytes = await this.target.download(destination);
        if (
          storedBytes.byteLength !== validated.size ||
          sha256(storedBytes) !== checksum
        ) {
          throw new Error("uploaded-object-verification-failed");
        }
      }

      const signedUrl = await this.target.createSignedUrl(destination, 300);
      assertSafeSignedUrl(signedUrl);
      await this.repository.updateMetadata({ record, destination, validated });
      return this.finish(base, options, "migrated");
    } catch (error) {
      if (uploaded) {
        try {
          await this.target.delete(destination);
          base.compensated = true;
        } catch {
          base.compensated = false;
          return this.finish(
            base,
            options,
            "error",
            "database-failed-compensation-failed",
          );
        }
      }
      return this.finish(
        base,
        options,
        "error",
        safeReason(error, "migration-write-failed"),
      );
    }
  }

  private destination(
    record: LegacyStorageRecord,
    extension: string,
    checksum: string,
  ): MigrationObjectReference {
    const bucket =
      record.kind === "avatar" ? "gestschool-avatars" : "gestschool-documents";
    const scope =
      record.kind === "avatar"
        ? `avatars/${safeUuid(record.parentId)}`
        : record.kind === "teacher-document"
          ? `teachers/${safeUuid(record.parentId)}/documents/${safeUuid(record.id)}`
          : `attendance/${safeUuid(record.parentId)}/attachments/${safeUuid(record.id)}`;
    return {
      bucket,
      key: `tenants/${CANONICAL_STORAGE_TENANT_ID}/${scope}/legacy-${checksum}${extension}`,
    };
  }

  private hasCanonicalMetadata(record: LegacyStorageRecord): boolean {
    const expectedBucket =
      record.kind === "avatar" ? "gestschool-avatars" : "gestschool-documents";
    return (
      record.metadata.driver === "SUPABASE" &&
      record.metadata.bucket === expectedBucket &&
      Boolean(
        record.metadata.key?.startsWith(
          `tenants/${CANONICAL_STORAGE_TENANT_ID}/`,
        ),
      )
    );
  }

  private isExpectedTenant(tenantId: string): boolean {
    return (
      tenantId === LEGACY_STORAGE_TENANT_ID ||
      tenantId === CANONICAL_STORAGE_TENANT_ID
    );
  }

  private async finish(
    result: LegacyMigrationResult,
    options: RunLegacyStorageMigrationOptions,
    status: LegacyMigrationStatus,
    reason?: string,
  ): Promise<LegacyMigrationResult> {
    result.status = status;
    result.reason = reason;
    await this.journal.append({
      operationId: options.operationId,
      recordFingerprint: result.recordFingerprint,
      sourceFingerprint: result.sourceFingerprint,
      status,
      attempt: 1,
      checksum: result.checksum,
      destinationFingerprint: result.destinationKey
        ? fingerprint(`${result.destinationBucket}:${result.destinationKey}`)
        : undefined,
      timestamp: new Date().toISOString(),
    });
    return result;
  }
}

export function createMigrationManifest(
  report: LegacyMigrationReport,
): LegacyMigrationManifestEntry[] {
  if (report.mode !== "dry-run") {
    throw new Error("Only a dry-run report can become an apply manifest.");
  }
  return report.results
    .filter(
      (
        result,
      ): result is LegacyMigrationResult & {
        status: "ready" | "object-present";
      } & Required<
          Pick<
            LegacyMigrationResult,
            | "checksum"
            | "size"
            | "mimeType"
            | "destinationBucket"
            | "destinationKey"
          >
        > => result.status === "ready" || result.status === "object-present",
    )
    .map((result) => ({
      kind: result.kind,
      recordId: result.recordId,
      tenantId: CANONICAL_STORAGE_TENANT_ID,
      sourceFingerprint: result.sourceFingerprint,
      checksum: result.checksum,
      size: result.size,
      mimeType: result.mimeType,
      destinationBucket: result.destinationBucket,
      destinationKey: result.destinationKey,
      status: result.status,
    }));
}

export function manifestEntryKey(
  entry: Pick<LegacyMigrationResult, "kind" | "recordId">,
): string {
  return fingerprint(`${entry.kind}:${entry.recordId}`);
}

export function findObjectOrphans(
  objectKeys: readonly string[],
  knownKeys: ReadonlySet<string>,
): { orphanCount: number; orphanFingerprints: string[] } {
  const orphanFingerprints = objectKeys
    .filter((key) => !knownKeys.has(key))
    .map((key) => fingerprint(key))
    .sort();
  return { orphanCount: orphanFingerprints.length, orphanFingerprints };
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function categoryFor(kind: LegacyStorageKind): UploadCategory {
  if (kind === "avatar") return "avatar";
  if (kind === "teacher-document") return "teacher-document";
  return "attendance-attachment";
}

function safeUuid(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Migration record contains an invalid technical identifier.",
    );
  }
  return normalized;
}

function manifestMatches(
  approved: LegacyMigrationManifestEntry | undefined,
  result: LegacyMigrationResult,
): boolean {
  return Boolean(
    approved &&
    approved.tenantId === CANONICAL_STORAGE_TENANT_ID &&
    (approved.status === "ready" || approved.status === "object-present") &&
    approved.kind === result.kind &&
    approved.recordId === result.recordId &&
    approved.sourceFingerprint === result.sourceFingerprint &&
    approved.checksum === result.checksum &&
    approved.size === result.size &&
    approved.mimeType === result.mimeType &&
    approved.destinationBucket === result.destinationBucket &&
    approved.destinationKey === result.destinationKey,
  );
}

function assertSafeSignedUrl(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !url.pathname.includes("/storage/v1/object/sign/")
  ) {
    throw new Error("signed-url-verification-failed");
  }
}

function safeReason(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("source-read-disabled"))
    return "source-read-disabled";
  if (normalized.includes("not found") || normalized.includes("404"))
    return "source-object-not-found";
  if (normalized.includes("timeout") || normalized.includes("abort"))
    return "provider-timeout";
  if (normalized.includes("validation")) return "file-validation-failed";
  if (normalized.includes("verification")) return "object-verification-failed";
  if (normalized.includes("conflict")) return "database-concurrency-conflict";
  return fallback;
}
