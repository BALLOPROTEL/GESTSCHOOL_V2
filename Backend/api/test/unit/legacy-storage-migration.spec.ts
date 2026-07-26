import {
  CANONICAL_STORAGE_TENANT_ID,
  createMigrationManifest,
  findObjectOrphans,
  LegacyStorageMigrationEngine,
  LEGACY_STORAGE_TENANT_ID,
  manifestEntryKey,
  type LegacyMigrationJournalEvent,
  type LegacyStorageRecord,
  type LegacyStorageTarget,
  type MigrationObjectReference,
} from "../../src/storage/legacy-storage-migration";

const USER_ID = "00000000-0000-4000-8000-000000000002";
const TEACHER_ID = "00000000-0000-4000-8000-000000000003";
const DOCUMENT_ID = "00000000-0000-4000-8000-000000000004";
const PNG = Buffer.from("validated-image-content");

function avatarRecord(
  overrides: Partial<LegacyStorageRecord> = {},
): LegacyStorageRecord {
  return {
    kind: "avatar",
    id: USER_ID,
    tenantId: LEGACY_STORAGE_TENANT_ID,
    parentId: USER_ID,
    sourceReference:
      "https://project-ref.supabase.co/storage/v1/object/public/gestschool-avatars/tenants/legacy/avatar.png",
    originalName: "legacy-avatar.png",
    declaredMimeType: "image/png",
    declaredSize: PNG.byteLength,
    parentExists: true,
    metadata: {
      driver: null,
      bucket: null,
      key: null,
      mimeType: null,
      size: null,
    },
    ...overrides,
  };
}

function documentRecord(
  overrides: Partial<LegacyStorageRecord> = {},
): LegacyStorageRecord {
  return {
    kind: "teacher-document",
    id: DOCUMENT_ID,
    tenantId: CANONICAL_STORAGE_TENANT_ID,
    parentId: TEACHER_ID,
    sourceReference: "legacy/teacher-document.pdf",
    originalName: "teacher-document.pdf",
    declaredMimeType: "application/pdf",
    declaredSize: PNG.byteLength,
    parentExists: true,
    metadata: {
      driver: null,
      bucket: null,
      key: null,
      mimeType: null,
      size: null,
    },
    ...overrides,
  };
}

class MemoryTarget implements LegacyStorageTarget {
  readonly objects = new Map<string, Buffer>();
  readonly uploaded: string[] = [];
  readonly deleted: string[] = [];
  readonly signed: string[] = [];
  failUpload = false;
  failDelete = false;
  failSignedUrl = false;

  key(reference: MigrationObjectReference): string {
    return `${reference.bucket}/${reference.key}`;
  }

  async exists(reference: MigrationObjectReference): Promise<boolean> {
    return this.objects.has(this.key(reference));
  }

  async upload(
    reference: MigrationObjectReference,
    file: { buffer: Buffer },
  ): Promise<void> {
    if (this.failUpload) throw new Error("provider-upload-failed");
    const key = this.key(reference);
    this.uploaded.push(key);
    this.objects.set(key, Buffer.from(file.buffer));
  }

  async download(reference: MigrationObjectReference): Promise<Buffer> {
    const value = this.objects.get(this.key(reference));
    if (!value) throw new Error("object-not-found");
    return Buffer.from(value);
  }

  async delete(reference: MigrationObjectReference): Promise<void> {
    if (this.failDelete) throw new Error("provider-delete-failed");
    const key = this.key(reference);
    this.deleted.push(key);
    this.objects.delete(key);
  }

  async createSignedUrl(reference: MigrationObjectReference): Promise<string> {
    if (this.failSignedUrl) throw new Error("signed-url-verification-failed");
    this.signed.push(this.key(reference));
    return `https://project-ref.supabase.co/storage/v1/object/sign/${reference.bucket}/${reference.key}?token=test-only`;
  }
}

function harness(
  options: { source?: Buffer | null; databaseFailure?: boolean } = {},
) {
  const target = new MemoryTarget();
  const journal: LegacyMigrationJournalEvent[] = [];
  const repository = {
    updateMetadata: jest.fn(async ({ record, destination, validated }) => {
      if (options.databaseFailure) throw new Error("database-write-failed");
      record.metadata = {
        driver: "SUPABASE",
        bucket: destination.bucket,
        key: destination.key,
        mimeType: validated.mimeType,
        size: validated.size,
      };
    }),
  };
  const source = {
    read: jest.fn(async () =>
      options.source === null
        ? null
        : {
            buffer: Buffer.from(options.source || PNG),
            originalName: "legacy-avatar.png",
            mimeType: "image/png",
          },
    ),
  };
  const validator = {
    validate: jest.fn(
      async (file: { buffer: Buffer; originalname: string }) => ({
        originalName: file.originalname,
        extension: ".png",
        mimeType: "image/png",
        size: file.buffer.byteLength,
        buffer: Buffer.from(file.buffer),
        width: 32,
        height: 32,
      }),
    ),
  };
  const engine = new LegacyStorageMigrationEngine(
    source,
    target,
    repository,
    validator,
    { append: async (event) => void journal.push(event) },
  );
  return { engine, source, target, repository, validator, journal };
}

async function approvedApply(
  engine: LegacyStorageMigrationEngine,
  record: LegacyStorageRecord,
) {
  const dryRun = await engine.run([record], {
    mode: "dry-run",
    operationId: "dry-run",
  });
  const manifest = createMigrationManifest(dryRun);
  record.tenantId = CANONICAL_STORAGE_TENANT_ID;
  return {
    dryRun,
    manifest: new Map(
      manifest.map((entry) => [manifestEntryKey(entry), entry]),
    ),
  };
}

describe("legacy storage migration", () => {
  it("defaults to a side-effect-free dry-run and migrates idempotently from its manifest", async () => {
    const record = avatarRecord();
    const { engine, target, repository } = harness();
    const { dryRun, manifest } = await approvedApply(engine, record);

    expect(dryRun.counts.ready).toBe(1);
    expect(target.uploaded).toHaveLength(0);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
    expect(dryRun.results[0].destinationKey).toContain(
      `tenants/${CANONICAL_STORAGE_TENANT_ID}/avatars/${USER_ID}/legacy-`,
    );

    const applied = await engine.run([record], {
      mode: "apply",
      operationId: "apply",
      approvedManifest: manifest,
    });
    expect(applied.counts.migrated).toBe(1);
    expect(target.uploaded).toHaveLength(1);
    expect(target.signed).toHaveLength(1);
    expect(repository.updateMetadata).toHaveBeenCalledTimes(1);

    const replay = await engine.run([record], {
      mode: "apply",
      operationId: "replay",
      approvedManifest: manifest,
    });
    expect(replay.counts["already-migrated"]).toBe(1);
    expect(target.uploaded).toHaveLength(1);
    expect(repository.updateMetadata).toHaveBeenCalledTimes(1);
  });

  it("reports a missing source without uploading or updating metadata", async () => {
    const { engine, target, repository } = harness({ source: null });
    const report = await engine.run([avatarRecord()], {
      mode: "dry-run",
      operationId: "missing",
    });

    expect(report.counts.missing).toBe(1);
    expect(target.uploaded).toHaveLength(0);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it("recognizes an already present deterministic object and does not upload it again", async () => {
    const record = avatarRecord();
    const { engine, target } = harness();
    const first = await engine.run([record], {
      mode: "dry-run",
      operationId: "first",
    });
    const destination = {
      bucket: first.results[0].destinationBucket!,
      key: first.results[0].destinationKey!,
    };
    target.objects.set(target.key(destination), PNG);

    const second = await engine.run([record], {
      mode: "dry-run",
      operationId: "second",
    });
    expect(second.counts["object-present"]).toBe(1);
    expect(target.uploaded).toHaveLength(0);
  });

  it("reports an upload failure without modifying PostgreSQL", async () => {
    const record = avatarRecord();
    const { engine, target, repository } = harness();
    const { manifest } = await approvedApply(engine, record);
    target.failUpload = true;

    const report = await engine.run([record], {
      mode: "apply",
      operationId: "upload-failure",
      approvedManifest: manifest,
    });

    expect(report.counts.error).toBe(1);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it("deletes the new object when the PostgreSQL metadata update fails", async () => {
    const record = avatarRecord();
    const { engine, target } = harness({ databaseFailure: true });
    const { manifest } = await approvedApply(engine, record);

    const report = await engine.run([record], {
      mode: "apply",
      operationId: "database-failure",
      approvedManifest: manifest,
    });

    expect(report.counts.error).toBe(1);
    expect(report.results[0].compensated).toBe(true);
    expect(target.deleted).toHaveLength(1);
    expect(target.objects).toHaveProperty("size", 0);
  });

  it("verifies signed access before writing PostgreSQL metadata", async () => {
    const record = avatarRecord();
    const { engine, target, repository } = harness();
    const { manifest } = await approvedApply(engine, record);
    target.failSignedUrl = true;

    const report = await engine.run([record], {
      mode: "apply",
      operationId: "signed-url-failure",
      approvedManifest: manifest,
    });

    expect(report.counts.error).toBe(1);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
    expect(report.results[0].compensated).toBe(true);
    expect(target.deleted).toHaveLength(1);
  });

  it("surfaces a failed compensation without deleting any legacy source", async () => {
    const record = avatarRecord();
    const { engine, source, target } = harness({ databaseFailure: true });
    const { manifest } = await approvedApply(engine, record);
    target.failDelete = true;

    const report = await engine.run([record], {
      mode: "apply",
      operationId: "compensation-failure",
      approvedManifest: manifest,
    });

    expect(report.results[0]).toMatchObject({
      status: "error",
      reason: "database-failed-compensation-failed",
      compensated: false,
    });
    expect(source.read).toHaveBeenCalled();
  });

  it("rejects another tenant before reading the source", async () => {
    const { engine, source } = harness();
    const report = await engine.run(
      [
        avatarRecord({
          tenantId: "10000000-0000-4000-8000-000000000001",
        }),
      ],
      { mode: "dry-run", operationId: "cross-tenant" },
    );

    expect(report.results[0]).toMatchObject({
      status: "error",
      reason: "tenant-isolation",
    });
    expect(source.read).not.toHaveBeenCalled();
  });

  it("reports a parent-resource orphan and never reads its file", async () => {
    const { engine, source } = harness();
    const report = await engine.run([documentRecord({ parentExists: false })], {
      mode: "dry-run",
      operationId: "orphan",
    });

    expect(report.counts.orphan).toBe(1);
    expect(source.read).not.toHaveBeenCalled();
  });

  it("does not place source URLs or secrets in its technical journal", async () => {
    const secret = "service-role-secret-that-must-never-appear";
    const record = avatarRecord({
      sourceReference: `${avatarRecord().sourceReference}?token=${secret}`,
    });
    const { engine, journal } = harness({ source: null });
    await engine.run([record], { mode: "dry-run", operationId: "safe-log" });

    const serialized = JSON.stringify(journal);
    expect(serialized).not.toContain(record.sourceReference);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain(USER_ID);
  });

  it("detects target objects without matching metadata using fingerprints only", () => {
    const known = new Set(["tenants/canonical/avatars/known.png"]);
    expect(
      findObjectOrphans(
        [
          "tenants/canonical/avatars/known.png",
          "tenants/canonical/avatars/orphan.png",
        ],
        known,
      ),
    ).toMatchObject({
      orphanCount: 1,
      orphanFingerprints: [expect.stringMatching(/^[0-9a-f]{16}$/)],
    });
  });

  it("requires an approved manifest before apply mode", async () => {
    const { engine } = harness();
    await expect(
      engine.run([avatarRecord()], {
        mode: "apply",
        operationId: "unsafe-apply",
      }),
    ).rejects.toThrow("approved dry-run manifest");
  });

  it("blocks apply until the database row uses the canonical tenant", async () => {
    const record = avatarRecord();
    const { engine, source, target, repository } = harness();
    const dryRun = await engine.run([record], {
      mode: "dry-run",
      operationId: "legacy-dry-run",
    });
    const manifest = createMigrationManifest(dryRun);

    const report = await engine.run([record], {
      mode: "apply",
      operationId: "legacy-apply",
      approvedManifest: new Map(
        manifest.map((entry) => [manifestEntryKey(entry), entry]),
      ),
    });

    expect(report.results[0]).toMatchObject({
      status: "blocked",
      reason: "canonical-tenant-required-before-apply",
    });
    expect(source.read).toHaveBeenCalledTimes(1);
    expect(target.uploaded).toHaveLength(0);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it("blocks a stale completed journal when database metadata is absent", async () => {
    const record = avatarRecord();
    const { engine, source } = harness();
    const first = await engine.run([record], {
      mode: "dry-run",
      operationId: "first",
    });

    const replay = await engine.run([record], {
      mode: "dry-run",
      operationId: "replay",
      completedRecordFingerprints: new Set([
        first.results[0].recordFingerprint,
      ]),
    });

    expect(replay.results[0]).toMatchObject({
      status: "blocked",
      reason: "completed-journal-without-database-metadata",
    });
    expect(source.read).toHaveBeenCalledTimes(1);
  });
});
