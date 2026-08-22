import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migrationPath = resolve(
  __dirname,
  "../../prisma/migrations/20260814120000_deletion_referential_integrity/migration.sql"
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("deletion referential integrity migration", () => {
  it("is transactionally bounded and changes constraints only", () => {
    expect(migrationSql.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
    expect(migrationSql).not.toMatch(/\b(?:DELETE|UPDATE|INSERT)\s+(?:FROM|INTO)?\s*"/i);
  });

  it.each([
    ["refresh_tokens_user_id_fkey", "CASCADE"],
    ["notifications_student_id_fkey", "SET NULL"],
    ["student_track_placements_student_id_fkey", "RESTRICT"],
    ["student_track_placements_school_year_id_fkey", "RESTRICT"],
    ["pedagogical_rules_school_year_id_fkey", "SET NULL"],
    ["pedagogical_rules_cycle_id_fkey", "SET NULL"],
    ["pedagogical_rules_level_id_fkey", "SET NULL"],
    ["pedagogical_rules_class_id_fkey", "SET NULL"],
    ["teacher_documents_teacher_id_fkey", "RESTRICT"],
    ["attendance_attachments_attendance_id_fkey", "RESTRICT"],
    ["parent_student_links_parent_id_fkey", "RESTRICT"],
    ["parent_student_links_student_id_fkey", "RESTRICT"]
  ])("sets %s to ON DELETE %s", (constraint, action) => {
    expect(migrationSql).toContain(`DROP CONSTRAINT "${constraint}"`);
    const clause = migrationSql
      .split(`ADD CONSTRAINT "${constraint}"`)[1]
      ?.split(/,\n\s*DROP CONSTRAINT|;\n/)[0];
    expect(clause).toContain(`ON DELETE ${action}`);
  });
});
