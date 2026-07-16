import { outboxRetryDelayMs } from "../../src/outbox/outbox-retry-policy";

describe("outboxRetryDelayMs", () => {
  it("applies exponential backoff with bounded jitter", () => {
    expect(outboxRetryDelayMs(1, 15, 600, () => 0)).toBe(15_000);
    expect(outboxRetryDelayMs(3, 15, 600, () => 0)).toBe(60_000);
    expect(outboxRetryDelayMs(3, 15, 600, () => 1)).toBe(72_000);
  });

  it("never exceeds the configured cap", () => {
    expect(outboxRetryDelayMs(20, 15, 600, () => 1)).toBe(600_000);
  });
});
