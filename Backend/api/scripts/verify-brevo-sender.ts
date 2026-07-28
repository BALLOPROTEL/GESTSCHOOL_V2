import { ConfigService } from "@nestjs/config";

import { NotificationGatewayService } from "../src/notifications/notification-gateway.service";

async function main(): Promise<void> {
  const gateway = new NotificationGatewayService(
    new ConfigService<Record<string, string | undefined>>(process.env)
  );
  const result = await gateway.verifyBrevoEmailSender();
  // The command intentionally prints no sender address or provider credential.
  console.log(
    JSON.stringify({
      active: result.active,
      configured: result.configured,
      provider: result.provider
    })
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Brevo sender verification failed.";
  console.error(message);
  process.exit(1);
});
