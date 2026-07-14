import {
  isAllowedTenantId,
  LEGACY_DEFAULT_TENANT_ID
} from "../../src/common/tenant-id.validator";

describe("tenant id validator", () => {
  it("accepts versioned UUIDs", () => {
    expect(isAllowedTenantId("00000000-0000-4000-8000-000000000001", {})).toBe(true);
  });

  it("accepts only the exact historical tenant when explicitly enabled", () => {
    const env = { ALLOW_LEGACY_DEFAULT_TENANT_ID: "true" };
    expect(isAllowedTenantId(LEGACY_DEFAULT_TENANT_ID, env)).toBe(true);
    expect(isAllowedTenantId("11111111-1111-0111-8111-111111111111", env)).toBe(false);
  });

  it("rejects the historical tenant by default", () => {
    expect(isAllowedTenantId(LEGACY_DEFAULT_TENANT_ID, {})).toBe(false);
  });
});
