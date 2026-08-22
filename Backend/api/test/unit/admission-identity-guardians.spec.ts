import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  maskEmail,
  maskIdentifier,
  maskPhone,
  normalizeEmail,
  normalizeIdentityText,
  normalizeMatricule,
  normalizePhone,
} from "../../src/common/identity-normalization";

const migrationPath = resolve(
  __dirname,
  "../../prisma/migrations/20260822230000_admission_identity_guardians/migration.sql",
);

describe("Admission identity and guardian safeguards", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("normalizes comparison values without stripping meaningful accents", () => {
    expect(normalizeIdentityText("  Awa   Traore  ")).toBe("awa traore");
    expect(normalizeIdentityText("  Aminata   Traore  ")).toBe(
      "aminata traore",
    );
    expect(normalizeEmail("  USER@Example.Test ")).toBe("user@example.test");
    expect(normalizePhone("+223 70-12-34-56")).toBe("22370123456");
    expect(normalizeMatricule(" gst-2026-000001 ")).toBe("GST-2026-000001");
  });

  it("masks identity hints before they leave the search API", () => {
    expect(maskPhone("+223 70 12 34 56")).toBe("******3456");
    expect(maskEmail("guardian@example.test")).toBe("gu***@example.test");
    expect(maskIdentifier("DOCUMENT-12345678")).toBe("********5678");
    expect(maskEmail(null)).toBeNull();
  });

  it("uses a transactional, preflighted, tenant-scoped PostgreSQL migration", () => {
    expect(sql.trimStart()).toContain("BEGIN;");
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain("I4_DUPLICATE_NORMALIZED_STUDENT_MATRICULE");
    expect(sql).toContain("GROUP BY tenant_id, upper(btrim(matricule))");
    expect(sql).toContain('"uq_students_tenant_matricule_normalized"');
    expect(sql).toContain('("tenant_id", upper(btrim("matricule")))');
    expect(sql).toContain('ADD COLUMN "reserved_matricule" VARCHAR(30)');
    expect(sql).toContain('"uq_admission_cases_tenant_reserved_matricule"');
    expect(sql).toContain('CREATE TABLE "student_matricule_counters"');
    expect(sql).toContain('PRIMARY KEY ("tenant_id", "academic_year")');
  });

  it("seeds counters from existing generated matricules without rewriting identities", () => {
    expect(sql).toContain("^GST-[0-9]{4}-[0-9]{6}$");
    expect(sql).toContain('MAX(substring(upper(btrim("matricule"))');
    expect(sql).not.toMatch(/UPDATE\s+"students"/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"parents"/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+"parent_student_links"/i);
  });
});
