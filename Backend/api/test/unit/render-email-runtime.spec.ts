import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const blueprint = readFileSync(resolve(__dirname, "../../../../render.yaml"), "utf8");

const envValue = (key: string): string | undefined => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = blueprint.match(
    new RegExp(`- key: ${escapedKey}\\n\\s+value: ["']?([^"'\\n]+)["']?`, "u")
  );
  return match?.[1]?.trim();
};

describe("Render authentication email runtime", () => {
  it("keeps synchronous Brevo email enabled without an API outbox processor", () => {
    expect(envValue("GESTSCHOOL_PROCESS_ROLE")).toBe("api");
    expect(envValue("NOTIFICATIONS_WORKER_ENABLED")).toBe("false");
    expect(envValue("OUTBOX_IN_PROCESS_ENABLED")).toBe("false");
    expect(envValue("ALLOW_IN_PROCESS_OUTBOX_FOR_EMPTY_SANDBOX")).toBe("false");
    expect(envValue("NOTIFICATIONS_EMAIL_ENABLED")).toBe("true");
    expect(envValue("NOTIFICATIONS_EMAIL_PROVIDER")).toBe("BREVO");
  });

  it("does not enable SMS or Brevo callbacks while authentication email is restored", () => {
    expect(envValue("NOTIFICATIONS_SMS_ENABLED")).toBe("false");
    expect(envValue("NOTIFICATIONS_SMS_PROVIDER")).toBe("mock");
    expect(envValue("BREVO_WEBHOOK_ENABLED")).toBe("false");
    expect(envValue("BREVO_SMS_DRY_RUN")).toBe("true");
    expect(envValue("ALLOW_REAL_SMS")).toBe("false");
  });
});
