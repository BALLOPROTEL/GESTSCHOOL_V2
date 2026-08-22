import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  __dirname,
  "../../prisma/migrations/20260822130000_admission_case_drafts/migration.sql",
);

describe("AdmissionCase I2 migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("is transactional and creates only the draft aggregate", () => {
    expect(sql.trimStart()).toContain("BEGIN;");
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain('CREATE TABLE "admission_cases"');
    expect(sql).not.toMatch(/ALTER TABLE "(students|parents|enrollments|student_track_placements|invoices)"/);
  });

  it("keeps every optional business or actor relation non-blocking on delete", () => {
    const setNullClauses = sql.match(/ON DELETE SET NULL ON UPDATE CASCADE/g) ?? [];
    expect(setNullClauses).toHaveLength(4);
    expect(sql).toContain('REFERENCES "students"("id")');
    expect(sql).toContain('REFERENCES "school_years"("id")');
    expect(sql).toContain('REFERENCES "users"("id")');
    expect(sql).not.toContain("ON DELETE CASCADE");
  });

  it("enforces payload shape, versions and tenant-scoped future idempotence", () => {
    expect(sql).toContain('CHECK ("version" >= 1)');
    expect(sql).toContain('CHECK ("payload_version" = 1)');
    expect(sql).toContain('CHECK (jsonb_typeof("draft_data") = \'object\')');
    expect(sql).toContain('"uq_admission_cases_tenant_finalize_key"');
    expect(sql).toContain('("tenant_id", "finalization_idempotency_key")');
  });
});
