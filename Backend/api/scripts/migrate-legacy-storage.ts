import { createHash, randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

import { FileValidationService } from "../src/storage/file-validation.service";
import {
  CANONICAL_STORAGE_TENANT_ID,
  createMigrationManifest,
  findObjectOrphans,
  fingerprint,
  LegacyStorageMigrationEngine,
  LEGACY_STORAGE_TENANT_ID,
  manifestEntryKey,
  type LegacyMigrationJournal,
  type LegacyMigrationJournalEvent,
  type LegacyMigrationManifestEntry,
  type LegacyStorageMetadataRepository,
  type LegacyStorageRecord,
  type LegacyStorageSource,
  type LegacyStorageTarget,
  type MigrationObjectReference,
} from "../src/storage/legacy-storage-migration";
import { SupabaseStorageProvider } from "../src/storage/supabase-storage.provider";

type SchemaColumn = { table_name: string; column_name: string };
type InventoryRow = {
  kind: LegacyStorageRecord["kind"];
  id: string;
  tenantId: string;
  parentId: string;
  sourceReference: string;
  originalName: string;
  declaredMimeType: string | null;
  declaredSize: number | null;
  parentExists: boolean;
  storageDriver: string | null;
  storageBucket: string | null;
  storageKey: string | null;
  storageMimeType: string | null;
  storageSize: number | null;
};

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const allowSourceRead = argv.includes("--allow-source-read");
const listTargetObjects = argv.includes("--list-target-objects");
const operationId = safeOperationId(argument("operation-id") || randomUUID());
const manifestIn = argument("manifest");
const manifestOut = argument("manifest-out");
const journalPath = argument("journal");
const reportPath = argument("report");

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function safeOperationId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    throw new Error("--operation-id must be a versioned UUID.");
  }
  return normalized;
}

function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function migrationDatabaseUrl(): string {
  if (apply) {
    const value = requiredEnv("STORAGE_MIGRATION_DATABASE_URL");
    const environment = requiredEnv(
      "STORAGE_MIGRATION_ENVIRONMENT",
    ).toLowerCase();
    if (environment !== "staging" && environment !== "production") {
      throw new Error(
        "STORAGE_MIGRATION_ENVIRONMENT must be staging or production.",
      );
    }
    if (value === String(process.env.PROD_SNAPSHOT_DATABASE_URL || "")) {
      throw new Error("Apply mode refuses PROD_SNAPSHOT_DATABASE_URL.");
    }
    if (
      process.env.STORAGE_MIGRATION_ALLOW_WRITES !== "true" ||
      argument("confirm") !== `LOT4-PROD-${environment.toUpperCase()}`
    ) {
      throw new Error(
        `Apply mode requires STORAGE_MIGRATION_ALLOW_WRITES=true and --confirm=LOT4-PROD-${environment.toUpperCase()}.`,
      );
    }
    if (!manifestIn || !journalPath) {
      throw new Error("Apply mode requires --manifest and --journal.");
    }
    return value;
  }
  return requiredEnv("PROD_SNAPSHOT_DATABASE_URL");
}

function validateSupabaseMigrationConfig(): void {
  if (!allowSourceRead && !listTargetObjects && !apply) return;
  const provider = requiredEnv("STORAGE_PROVIDER").toLowerCase();
  const driver = requiredEnv("FILE_STORAGE_DRIVER").toUpperCase();
  if (provider !== "supabase" || driver !== "SUPABASE") {
    throw new Error(
      "Migration requires STORAGE_PROVIDER=supabase and FILE_STORAGE_DRIVER=SUPABASE.",
    );
  }
  const url = new URL(requiredEnv("SUPABASE_URL"));
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("SUPABASE_URL must be a credential-free HTTPS origin.");
  }
  if (requiredEnv("SUPABASE_SERVICE_ROLE_KEY").length < 32) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is invalid.");
  }
  if (
    requiredEnv("SUPABASE_STORAGE_BUCKET_DOCUMENTS") !== "gestschool-documents"
  ) {
    throw new Error("Unexpected documents bucket.");
  }
  if (requiredEnv("SUPABASE_STORAGE_BUCKET_AVATARS") !== "gestschool-avatars") {
    throw new Error("Unexpected avatars bucket.");
  }
  if (
    String(process.env.SUPABASE_STORAGE_AVATARS_PUBLIC || "").toLowerCase() !==
    "false"
  ) {
    throw new Error("SUPABASE_STORAGE_AVATARS_PUBLIC must be false.");
  }
  const ttl = Number(requiredEnv("SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS"));
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 900) {
    throw new Error(
      "Supabase signed URL TTL must be between 60 and 900 seconds.",
    );
  }
}

class SafeJournal implements LegacyMigrationJournal {
  constructor(private readonly filePath?: string) {}

  async append(event: LegacyMigrationJournalEvent): Promise<void> {
    if (!this.filePath) return;
    const absolute = resolve(this.filePath);
    await mkdir(resolve(absolute, ".."), { recursive: true });
    await appendFile(absolute, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

class ControlledLegacySource implements LegacyStorageSource {
  private readonly roots = String(process.env.LEGACY_STORAGE_ROOT || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => resolve(value));
  private readonly allowedOrigins = new Set(
    String(process.env.STORAGE_MIGRATION_ALLOWED_SOURCE_ORIGINS || "")
      .split(",")
      .map((value) => value.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );

  constructor(private readonly supabaseProvider: SupabaseStorageProvider) {}

  async read(record: LegacyStorageRecord) {
    if (!allowSourceRead) throw new Error("source-read-disabled");
    if (/^https:\/\//i.test(record.sourceReference)) {
      return this.readHttps(record);
    }
    return this.readLocal(record);
  }

  private async readHttps(record: LegacyStorageRecord) {
    const url = new URL(record.sourceReference);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !this.allowedOrigins.has(url.origin)
    ) {
      throw new Error("source-origin-not-allowed");
    }
    const supabaseReference = parseSupabaseObjectReference(
      record.sourceReference,
    );
    if (supabaseReference) {
      try {
        const downloaded = await this.supabaseProvider.read(supabaseReference);
        this.assertBounded(record, downloaded.buffer);
        return {
          buffer: downloaded.buffer,
          originalName: safeFileName(
            record.originalName || basename(url.pathname),
          ),
          mimeType:
            downloaded.mimeType ||
            record.declaredMimeType ||
            "application/octet-stream",
        };
      } catch (error) {
        if (String(error).includes("(404)")) return null;
        throw error;
      }
    }
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`source-read-failed-${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    this.assertBounded(record, buffer);
    return {
      buffer,
      originalName: safeFileName(record.originalName || basename(url.pathname)),
      mimeType:
        response.headers.get("content-type")?.split(";", 1)[0] ||
        record.declaredMimeType ||
        "application/octet-stream",
    };
  }

  private async readLocal(record: LegacyStorageRecord) {
    if (this.roots.length === 0)
      throw new Error("legacy-storage-root-not-configured");
    const source = record.sourceReference.replace(/^file:\/\//i, "");
    if (isAbsolute(source)) throw new Error("absolute-legacy-path-refused");
    for (const root of this.roots) {
      const candidate = resolve(root, source.replace(/^\/+/, ""));
      if (relative(root, candidate).startsWith("..")) continue;
      try {
        const [resolvedRoot, resolvedFile] = await Promise.all([
          realpath(root),
          realpath(candidate),
        ]);
        if (relative(resolvedRoot, resolvedFile).startsWith("..")) continue;
        const metadata = await stat(resolvedFile);
        if (!metadata.isFile()) continue;
        const buffer = await readFile(resolvedFile);
        this.assertBounded(record, buffer);
        return {
          buffer,
          originalName: safeFileName(
            record.originalName || basename(resolvedFile),
          ),
          mimeType: record.declaredMimeType || "application/octet-stream",
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    return null;
  }

  private assertBounded(record: LegacyStorageRecord, buffer: Buffer): void {
    const max =
      record.kind === "avatar"
        ? 2 * 1024 * 1024
        : record.kind === "teacher-document"
          ? 10 * 1024 * 1024
          : 5 * 1024 * 1024;
    if (buffer.byteLength === 0 || buffer.byteLength > max) {
      throw new Error("source-size-out-of-bounds");
    }
  }
}

class SupabaseMigrationTarget implements LegacyStorageTarget {
  constructor(private readonly provider: SupabaseStorageProvider) {}

  async exists(reference: MigrationObjectReference): Promise<boolean> {
    try {
      await this.provider.read(reference);
      return true;
    } catch (error) {
      if (String(error).includes("(404)")) return false;
      throw error;
    }
  }

  async upload(
    reference: MigrationObjectReference,
    file: { buffer: Buffer; mimeType: string },
  ): Promise<void> {
    const bucketKind =
      reference.bucket === "gestschool-avatars" ? "avatars" : "documents";
    const result = await this.provider.store({
      bucketKind,
      key: reference.key,
      buffer: file.buffer,
      mimeType: file.mimeType,
    });
    if (result.bucket !== reference.bucket) {
      throw new Error("configured-target-bucket-mismatch");
    }
  }

  async download(reference: MigrationObjectReference): Promise<Buffer> {
    return (await this.provider.read(reference)).buffer;
  }

  async delete(reference: MigrationObjectReference): Promise<void> {
    await this.provider.delete(reference);
  }

  async createSignedUrl(
    reference: MigrationObjectReference,
    expiresInSeconds: number,
  ): Promise<string> {
    return this.provider.createSignedUrl(reference, expiresInSeconds);
  }

  async listKeys(bucket: string, prefix: string): Promise<string[]> {
    const url = `${requiredEnv("SUPABASE_URL").replace(/\/+$/, "")}/storage/v1/object/list/${encodeURIComponent(bucket)}`;
    const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const keys: string[] = [];
    const pending = [prefix.replace(/\/+$/, "")];
    while (pending.length > 0) {
      const currentPrefix = pending.shift()!;
      for (let offset = 0; ; offset += 1000) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            apikey: serviceRole,
            Authorization: `Bearer ${serviceRole}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefix: currentPrefix,
            limit: 1000,
            offset,
            sortBy: { column: "name", order: "asc" },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok)
          throw new Error(`target-list-failed-${response.status}`);
        const entries = (await response.json()) as Array<{
          name?: unknown;
          id?: unknown;
          metadata?: unknown;
        }>;
        for (const entry of entries) {
          if (typeof entry.name !== "string" || !entry.name) continue;
          const key = `${currentPrefix}/${entry.name}`.replace(/^\/+/, "");
          if (entry.id || entry.metadata) keys.push(key);
          else pending.push(key);
        }
        if (entries.length < 1000) break;
      }
    }
    return keys;
  }
}

class PrismaStorageRepository implements LegacyStorageMetadataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async updateMetadata(input: {
    record: LegacyStorageRecord;
    destination: MigrationObjectReference;
    validated: { mimeType: string; size: number };
  }): Promise<void> {
    const { record, destination, validated } = input;
    let count = 0;
    if (record.kind === "avatar") {
      count = await this.prisma.$executeRawUnsafe(
        `UPDATE public.users
         SET avatar_storage_driver = 'SUPABASE',
             avatar_storage_bucket = $1,
             avatar_storage_key = $2,
             avatar_mime_type = $3,
             avatar_size = $4,
             updated_at = now()
         WHERE id = $5::uuid
           AND tenant_id = $6::uuid
           AND avatar_url IS NOT DISTINCT FROM $7
           AND avatar_storage_key IS NULL`,
        destination.bucket,
        destination.key,
        validated.mimeType,
        validated.size,
        record.id,
        record.tenantId,
        record.sourceReference,
      );
    } else if (record.kind === "teacher-document") {
      count = await this.prisma.$executeRawUnsafe(
        `UPDATE public.teacher_documents
         SET storage_driver = 'SUPABASE',
             storage_bucket = $1,
             storage_key = $2,
             mime_type = $3,
             size = $4
         WHERE id = $5::uuid
           AND tenant_id = $6::uuid
           AND file_url IS NOT DISTINCT FROM $7
           AND storage_key IS NULL`,
        destination.bucket,
        destination.key,
        validated.mimeType,
        validated.size,
        record.id,
        record.tenantId,
        record.sourceReference,
      );
    } else {
      count = await this.prisma.$executeRawUnsafe(
        `UPDATE public.attendance_attachments
         SET storage_driver = 'SUPABASE',
             storage_bucket = $1,
             storage_key = $2,
             mime_type = $3,
             size = $4,
             updated_at = now()
         WHERE id = $5::uuid
           AND tenant_id = $6::uuid
           AND file_url IS NOT DISTINCT FROM $7
           AND storage_key IS NULL`,
        destination.bucket,
        destination.key,
        validated.mimeType,
        validated.size,
        record.id,
        record.tenantId,
        record.sourceReference,
      );
    }
    if (count !== 1) throw new Error("database-concurrency-conflict");
  }
}

async function inventory(prisma: PrismaClient): Promise<LegacyStorageRecord[]> {
  const columns = await prisma.$queryRaw<SchemaColumn[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('users', 'teacher_documents', 'attendance_attachments')
  `;
  const available = new Set(
    columns.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const column = (table: string, name: string, fallback: string) =>
    available.has(`${table}.${name}`) ? `"${name}"` : fallback;

  const userRows = await prisma.$queryRawUnsafe<InventoryRow[]>(`
    SELECT 'avatar' AS kind,
           id::text AS "id",
           tenant_id::text AS "tenantId",
           id::text AS "parentId",
           avatar_url AS "sourceReference",
           ('legacy-avatar' || COALESCE(NULLIF(substring(avatar_url from '\\.[A-Za-z0-9]{2,5}(?:\\?|$)'), ''), '.png')) AS "originalName",
           ${column("users", "avatar_mime_type", "NULL::text")} AS "declaredMimeType",
           ${column("users", "avatar_size", "NULL::integer")} AS "declaredSize",
           true AS "parentExists",
           ${column("users", "avatar_storage_driver", "NULL::text")} AS "storageDriver",
           ${column("users", "avatar_storage_bucket", "NULL::text")} AS "storageBucket",
           ${column("users", "avatar_storage_key", "NULL::text")} AS "storageKey",
           ${column("users", "avatar_mime_type", "NULL::text")} AS "storageMimeType",
           ${column("users", "avatar_size", "NULL::integer")} AS "storageSize"
    FROM public.users
    WHERE NULLIF(BTRIM(avatar_url), '') IS NOT NULL
       OR ${column("users", "avatar_storage_key", "NULL::text")} IS NOT NULL
    ORDER BY id
  `);

  const teacherRows = await prisma.$queryRawUnsafe<InventoryRow[]>(`
    SELECT 'teacher-document' AS kind,
           d.id::text AS "id",
           d.tenant_id::text AS "tenantId",
           d.teacher_id::text AS "parentId",
           d.file_url AS "sourceReference",
           d.original_name AS "originalName",
           d.mime_type AS "declaredMimeType",
           d.size AS "declaredSize",
           (t.id IS NOT NULL) AS "parentExists",
           ${qualifiedColumn(available, "teacher_documents", "d", "storage_driver", "NULL::text")} AS "storageDriver",
           ${qualifiedColumn(available, "teacher_documents", "d", "storage_bucket", "NULL::text")} AS "storageBucket",
           ${qualifiedColumn(available, "teacher_documents", "d", "storage_key", "NULL::text")} AS "storageKey",
           d.mime_type AS "storageMimeType",
           d.size AS "storageSize"
    FROM public.teacher_documents d
    LEFT JOIN public.teachers t
      ON t.id = d.teacher_id AND t.tenant_id = d.tenant_id
    ORDER BY d.id
  `);

  const attendanceRows = await prisma.$queryRawUnsafe<InventoryRow[]>(`
    SELECT 'attendance-attachment' AS kind,
           a.id::text AS "id",
           a.tenant_id::text AS "tenantId",
           a.attendance_id::text AS "parentId",
           a.file_url AS "sourceReference",
           a.file_name AS "originalName",
           a.mime_type AS "declaredMimeType",
           ${qualifiedColumn(available, "attendance_attachments", "a", "size", "NULL::integer")} AS "declaredSize",
           (p.id IS NOT NULL) AS "parentExists",
           ${qualifiedColumn(available, "attendance_attachments", "a", "storage_driver", "NULL::text")} AS "storageDriver",
           ${qualifiedColumn(available, "attendance_attachments", "a", "storage_bucket", "NULL::text")} AS "storageBucket",
           ${qualifiedColumn(available, "attendance_attachments", "a", "storage_key", "NULL::text")} AS "storageKey",
           a.mime_type AS "storageMimeType",
           ${qualifiedColumn(available, "attendance_attachments", "a", "size", "NULL::integer")} AS "storageSize"
    FROM public.attendance_attachments a
    LEFT JOIN public.attendance p
      ON p.id = a.attendance_id AND p.tenant_id = a.tenant_id
    ORDER BY a.id
  `);

  return [...userRows, ...teacherRows, ...attendanceRows].map((row) => ({
    kind: row.kind,
    id: row.id,
    tenantId: row.tenantId,
    parentId: row.parentId,
    sourceReference: row.sourceReference,
    originalName: row.originalName,
    declaredMimeType: row.declaredMimeType,
    declaredSize: row.declaredSize,
    parentExists: row.parentExists,
    metadata: {
      driver: row.storageDriver,
      bucket: row.storageBucket,
      key: row.storageKey,
      mimeType: row.storageMimeType,
      size: row.storageSize,
    },
  }));
}

function qualifiedColumn(
  columns: ReadonlySet<string>,
  table: string,
  alias: string,
  name: string,
  fallback: string,
): string {
  return columns.has(`${table}.${name}`) ? `${alias}."${name}"` : fallback;
}

async function approvedManifest(): Promise<
  ReadonlyMap<string, LegacyMigrationManifestEntry> | undefined
> {
  if (!manifestIn) return undefined;
  const payload = JSON.parse(await readFile(resolve(manifestIn), "utf8")) as {
    entries?: LegacyMigrationManifestEntry[];
  };
  if (!Array.isArray(payload.entries))
    throw new Error("Invalid migration manifest.");
  return new Map(
    payload.entries.map((entry) => [manifestEntryKey(entry), entry]),
  );
}

async function completedFromJournal(): Promise<ReadonlySet<string>> {
  if (!journalPath) return new Set();
  try {
    const lines = (await readFile(resolve(journalPath), "utf8"))
      .split(/\r?\n/)
      .filter(Boolean);
    return new Set(
      lines
        .map((line) => JSON.parse(line) as LegacyMigrationJournalEvent)
        .filter(
          (entry) =>
            entry.status === "migrated" || entry.status === "already-migrated",
        )
        .map((entry) => entry.recordFingerprint),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const absolute = resolve(path);
  await mkdir(resolve(absolute, ".."), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function objectOrphanReport(
  target: SupabaseMigrationTarget,
  records: readonly LegacyStorageRecord[],
  manifest: readonly LegacyMigrationManifestEntry[],
) {
  if (!listTargetObjects) return undefined;
  if (!allowSourceRead)
    throw new Error("--list-target-objects requires --allow-source-read.");
  const known = new Set(
    records
      .map((record) => record.metadata.key)
      .filter((value): value is string => Boolean(value)),
  );
  for (const record of records) {
    const parsed = parseSupabaseObjectReference(record.sourceReference);
    if (parsed) known.add(parsed.key);
  }
  for (const entry of manifest) known.add(entry.destinationKey);

  const summaries = [];
  for (const bucket of ["gestschool-avatars", "gestschool-documents"]) {
    const keys = [
      ...(await target.listKeys(bucket, `tenants/${LEGACY_STORAGE_TENANT_ID}`)),
      ...(await target.listKeys(
        bucket,
        `tenants/${CANONICAL_STORAGE_TENANT_ID}`,
      )),
    ];
    summaries.push({
      bucket,
      ...findObjectOrphans(keys, known),
      objectCount: keys.length,
    });
  }
  return summaries;
}

function parseSupabaseObjectReference(
  reference: string,
): MigrationObjectReference | null {
  try {
    const url = new URL(reference);
    const marker = "/storage/v1/object/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const parts = url.pathname
      .slice(index + marker.length)
      .split("/")
      .map(decodeURIComponent);
    if (["public", "authenticated", "sign"].includes(parts[0])) parts.shift();
    const bucket = parts.shift();
    if (
      (bucket !== "gestschool-avatars" && bucket !== "gestschool-documents") ||
      parts.length === 0
    ) {
      return null;
    }
    const key = parts.join("/");
    if (!key.startsWith("tenants/") || key.includes("..")) return null;
    return { bucket, key };
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  const name = basename(value.split("?", 1)[0]).normalize("NFC").trim();
  const extension = extname(name).toLowerCase();
  if (!name || !extension || name.length > 180 || /[\\/\0]/.test(name)) {
    throw new Error("invalid-legacy-file-name");
  }
  return name;
}

function publicReport(
  report: Awaited<ReturnType<LegacyStorageMigrationEngine["run"]>>,
) {
  return {
    mode: report.mode,
    total: report.total,
    counts: report.counts,
    categories: report.results.reduce<Record<string, number>>(
      (counts, result) => {
        counts[result.kind] = (counts[result.kind] || 0) + 1;
        return counts;
      },
      {},
    ),
    checksum: createHash("sha256")
      .update(
        report.results
          .map(
            (result) =>
              `${result.recordFingerprint}:${result.status}:${result.checksum || ""}`,
          )
          .sort()
          .join("\n"),
      )
      .digest("hex"),
  };
}

async function main(): Promise<void> {
  const databaseUrl = migrationDatabaseUrl();
  validateSupabaseMigrationConfig();
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    const records = await inventory(prisma);
    const supabaseProvider = new SupabaseStorageProvider(
      new ConfigService(process.env),
    );
    const target = new SupabaseMigrationTarget(supabaseProvider);
    const engine = new LegacyStorageMigrationEngine(
      new ControlledLegacySource(supabaseProvider),
      target,
      new PrismaStorageRepository(prisma),
      new FileValidationService(),
      new SafeJournal(journalPath),
    );
    const report = await engine.run(records, {
      mode: apply ? "apply" : "dry-run",
      operationId,
      approvedManifest: await approvedManifest(),
      completedRecordFingerprints: await completedFromJournal(),
    });
    const manifest = createMigrationManifest(
      report.mode === "dry-run" ? report : { ...report, mode: "dry-run" },
    );
    const orphanReport = await objectOrphanReport(target, records, manifest);
    const output = {
      generatedAt: new Date().toISOString(),
      safety: {
        dryRunDefault: !apply,
        sourceReadsEnabled: allowSourceRead,
        sourceDeletionSupported: false,
        database: apply ? "explicit-staging-target" : "read-only-snapshot",
      },
      report: publicReport(report),
      exceptions: report.results
        .filter(
          (result) =>
            result.status === "missing" ||
            result.status === "orphan" ||
            result.status === "blocked" ||
            result.status === "error",
        )
        .map((result) => ({
          kind: result.kind,
          recordId: result.recordId,
          recordFingerprint: result.recordFingerprint,
          status: result.status,
          reason: result.reason,
        })),
      objectInventory: orphanReport?.map((row) => ({
        bucket: row.bucket,
        objectCount: row.objectCount,
        orphanCount: row.orphanCount,
        orphanFingerprints: row.orphanFingerprints,
      })),
    };
    if (manifestOut && report.mode === "dry-run") {
      await writeJson(manifestOut, {
        version: 1,
        operationId,
        canonicalTenantId: CANONICAL_STORAGE_TENANT_ID,
        generatedAt: new Date().toISOString(),
        reportChecksum: output.report.checksum,
        entries: manifest,
      });
    }
    if (reportPath) await writeJson(reportPath, output);
    console.log(JSON.stringify(output, null, 2));
    if (report.counts.error > 0 || report.counts.orphan > 0)
      process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown-error";
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
  console.error(
    JSON.stringify({
      status: "failed",
      errorClass:
        error instanceof Error ? error.constructor.name : "UnknownError",
      code,
      reason: fingerprint(message),
      hint: "Review configuration and the private migration report; no source URL or secret is logged.",
    }),
  );
  process.exitCode = 1;
});
