import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  __dirname,
  "../../prisma/migrations/20260726120000_canonical_default_tenant_id/migration.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8");

const expectedTables = [
  "academic_periods",
  "attendance",
  "attendance_attachments",
  "classes",
  "cycles",
  "enrollments",
  "fee_plans",
  "grades",
  "iam_audit_logs",
  "invoices",
  "levels",
  "mosque_activities",
  "mosque_donations",
  "mosque_members",
  "notification_delivery_attempts",
  "notification_provider_callbacks",
  "notifications",
  "outbox_events",
  "parent_student_links",
  "parents",
  "payment_provider_attempts",
  "payments",
  "pedagogical_rules",
  "refresh_tokens",
  "report_cards",
  "role_permissions",
  "room_assignments",
  "room_availabilities",
  "room_types",
  "rooms",
  "school_years",
  "student_track_placements",
  "students",
  "subject_level_scopes",
  "subjects",
  "teacher_assignments",
  "teacher_documents",
  "teacher_skills",
  "teachers",
  "timetable_slots",
  "user_security_tokens",
  "users"
] as const;

describe("canonical tenant migration", () => {
  it("declares the exact 42-table tenant inventory", () => {
    const declaredTables = [
      ...migrationSql.matchAll(/^\s*\('([a-z_]+)'\)[,;]$/gm)
    ].map((match) => match[1]);

    expect(declaredTables).toEqual(expectedTables);
  });

  it("is transactional and uses the reviewed legacy and canonical UUIDs", () => {
    expect(migrationSql.trimStart()).toMatch(/^BEGIN;/);
    expect(migrationSql.trimEnd()).toMatch(/COMMIT;$/);
    expect(migrationSql).toContain("00000000-0000-0000-0000-000000000001");
    expect(migrationSql).toContain("00000000-0000-4000-8000-000000000001");
    expect(migrationSql).toContain("LOT1C_CANONICAL_TENANT_COLLISION");
    expect(migrationSql).toContain("LOT1C_ALREADY_MIGRATED");
  });

  it("updates only tenant_id and leaves payloads and file URLs untouched", () => {
    const setClauses = [...migrationSql.matchAll(/\bSET\s+([a-z_]+)\s*=/gi)].map(
      (match) => match[1].toLowerCase()
    );

    expect(setClauses).toEqual(["tenant_id"]);
    expect(migrationSql).not.toMatch(/\bUPDATE\s+public\.iam_audit_logs\b/i);
    expect(migrationSql).not.toMatch(/\bUPDATE\s+public\.outbox_events\b/i);
    expect(migrationSql).not.toMatch(/\bSET\s+(payload|avatar_url|storage_key|storage_bucket)\b/i);
  });
});
