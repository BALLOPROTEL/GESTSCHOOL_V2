import { ConflictException } from "@nestjs/common";

import { UsersService } from "../../src/users/users.service";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";

describe("UsersService avatar storage concurrency", () => {
  it("cleans the new object when optimistic avatar replacement loses a race", async () => {
    const existing = {
      id: USER_ID,
      tenantId: TENANT_ID,
      updatedAt: new Date("2026-07-14T10:00:00.000Z"),
      deletedAt: null,
      avatarUrl: null,
      avatarStorageDriver: null,
      avatarStorageBucket: null,
      avatarStorageKey: null,
      avatarMimeType: null,
      avatarSize: null
    };
    const stored = {
      tenantId: TENANT_ID,
      driver: "LOCAL" as const,
      bucket: "avatars",
      key: `tenants/${TENANT_ID}/avatars/${USER_ID}/replacement.png`,
      originalName: "replacement.png",
      mimeType: "image/png",
      size: 4
    };
    const transaction = {
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(existing)
      },
      $transaction: jest.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction)
      )
    };
    const storage = {
      storeValidatedFile: jest.fn().mockResolvedValue(stored),
      deleteFile: jest.fn().mockResolvedValue(undefined)
    };
    const validator = {
      validate: jest.fn().mockResolvedValue({
        originalName: stored.originalName,
        extension: ".png",
        mimeType: stored.mimeType,
        size: stored.size,
        buffer: Buffer.from("safe")
      })
    };

    const service = new UsersService(
      {} as never,
      {} as never,
      prisma as never,
      storage as never,
      validator as never
    );

    await expect(
      service.uploadMyAvatar(TENANT_ID, USER_ID, {
        originalname: "replacement.png",
        mimetype: "image/png",
        size: 4,
        buffer: Buffer.from("safe")
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: USER_ID,
        tenantId: TENANT_ID,
        updatedAt: existing.updatedAt,
        avatarStorageKey: null
      }),
      data: expect.objectContaining({ avatarStorageKey: stored.key })
    });
    expect(storage.deleteFile).toHaveBeenCalledWith(stored);
  });
});
