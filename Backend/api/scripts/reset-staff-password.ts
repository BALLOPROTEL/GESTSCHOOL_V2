import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;

const readRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
};

const readBooleanEnv = (key: string, fallback = false): boolean => {
  const value = process.env[key]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
};

async function main(): Promise<void> {
  const tenantId = process.env.RESET_TENANT_ID?.trim() || DEFAULT_TENANT_ID;
  const username = readRequiredEnv("RESET_USERNAME");
  const password = readRequiredEnv("RESET_PASSWORD");
  const mustChangePasswordAtFirstLogin = readBooleanEnv(
    "RESET_MUST_CHANGE_PASSWORD_AT_FIRST_LOGIN",
    false
  );

  if (!STRONG_PASSWORD_REGEX.test(password)) {
    throw new Error(
      "RESET_PASSWORD must be 12-128 chars and include upper, lower, digit and special char."
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId,
      username,
      accountType: "STAFF"
    },
    select: {
      id: true,
      tenantId: true,
      username: true,
      role: true,
      accountType: true
    }
  });

  if (!user) {
    throw new Error(`Active or inactive STAFF user not found for ${username}.`);
  }

  const passwordHash = await hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePasswordAtFirstLogin,
        isActive: true,
        deletedAt: null,
        updatedAt: new Date()
      }
    }),
    prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    })
  ]);

  // Do not print the password. This script is safe to keep in CI/deploy logs.
  // eslint-disable-next-line no-console
  console.log(
    `Password reset completed for ${user.username} (${user.role}/${user.accountType}). Existing sessions revoked.`
  );
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("reset-staff-password failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
