import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  __dirname,
  "../../prisma/migrations/20260822220000_admission_transactional_finalization/migration.sql",
);

describe("AdmissionCase I3 migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is transactional and changes only the admission aggregate", () => {
    expect(sql.trimStart()).toContain("BEGIN;");
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain('ALTER TABLE "admission_cases"');
    expect(sql).not.toMatch(
      /ALTER TABLE "(students|parents|parent_student_links|student_track_placements|enrollments|invoices)"/,
    );
  });

  it("persists a lease, stable result and sanitized failure metadata", () => {
    for (const column of [
      "finalization_result",
      "finalization_started_at",
      "finalization_lease_token",
      "finalization_lease_expires_at",
      "confirmed_at",
      "failed_at",
      "failure_code",
      "failure_message",
    ]) {
      expect(sql).toContain(`"${column}"`);
    }
    expect(sql).toContain('jsonb_typeof("finalization_result") = \'object\'');
    expect(sql).toContain('"admission_cases_finalizing_lease_check"');
    expect(sql).toContain('"admission_cases_confirmed_result_check"');
    expect(sql).toContain('"admission_cases_failed_diagnostic_check"');
  });

  it("does not introduce external delivery, finance or document writes", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
    expect(sql).not.toMatch(/\b(notifications|invoices|storage_objects)\b/i);
  });
});
