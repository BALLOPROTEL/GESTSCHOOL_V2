import { buildNotificationIdempotencyKey } from "../../src/notifications/notification-idempotency";
import type { PublishNotificationRequestInput } from "../../src/notifications/notification-request.contract";

const request = (): PublishNotificationRequestInput => ({
  tenantId: "00000000-0000-4000-8000-000000000001",
  kind: "PAYMENT_RECEIVED",
  channel: "EMAIL",
  recipient: {
    studentId: "11111111-1111-4111-8111-111111111111",
    audienceRole: "PARENT",
    targetAddress: "parent@example.com"
  },
  content: {
    templateKey: "payment.received",
    templateVersion: "v2",
    title: "Paiement reçu",
    message: "Votre paiement a été enregistré."
  },
  source: {
    domain: "finance",
    action: "payment.recorded",
    referenceType: "payment",
    referenceId: "22222222-2222-4222-8222-222222222222"
  },
  idempotencyKey: "finance.payment-recorded:22222222-2222-4222-8222-222222222222"
});

describe("notification idempotency key", () => {
  it("is stable for the same business delivery", () => {
    expect(buildNotificationIdempotencyKey(request(), "request-a")).toBe(
      buildNotificationIdempotencyKey(request(), "request-b")
    );
  });

  it.each([
    ["tenant", (value: PublishNotificationRequestInput) => (value.tenantId = "00000000-0000-4000-8000-000000000002")],
    ["resource", (value: PublishNotificationRequestInput) => (value.source.referenceId = "33333333-3333-4333-8333-333333333333")],
    ["recipient", (value: PublishNotificationRequestInput) => (value.recipient.targetAddress = "other@example.com")],
    ["channel", (value: PublishNotificationRequestInput) => (value.channel = "SMS")],
    ["template version", (value: PublishNotificationRequestInput) => (value.content.templateVersion = "v3")]
  ])("changes when the %s dimension changes", (_name, mutate) => {
    const baseline = request();
    const changed = request();
    mutate(changed);

    expect(buildNotificationIdempotencyKey(changed, "request-a")).not.toBe(
      buildNotificationIdempotencyKey(baseline, "request-a")
    );
  });
});
