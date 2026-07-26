import {
  CANONICAL_DEFAULT_TENANT_ID,
  isAllowedTenantId
} from "../../src/common/tenant-id.validator";

describe("tenant id validator", () => {
  it("accepts versioned UUIDs", () => {
    expect(isAllowedTenantId(CANONICAL_DEFAULT_TENANT_ID)).toBe(true);
  });

  it("rejects non-versioned UUIDs without a compatibility exception", () => {
    expect(isAllowedTenantId("00000000-0000-0000-0000-000000000001")).toBe(false);
    expect(isAllowedTenantId("11111111-1111-0111-8111-111111111111")).toBe(false);
  });
});
