import {
  findPasswordPolicyViolation,
  PASSWORD_POLICY_MESSAGE
} from "../../src/common/password-policy";

describe("findPasswordPolicyViolation", () => {
  it("accepts a strong password that does not contain the identifier", () => {
    expect(findPasswordPolicyViolation("Securite!2026-ok", "admin@example.com")).toBeNull();
  });

  it("rejects a weak password with the public policy message", () => {
    expect(findPasswordPolicyViolation("short", "admin@example.com")).toBe(PASSWORD_POLICY_MESSAGE);
  });

  it("rejects a strong password containing a long username token", () => {
    expect(findPasswordPolicyViolation("Admin!2026example", "admin@example.com")).toBe(
      "Le mot de passe ne doit pas contenir votre identifiant."
    );
  });
});
