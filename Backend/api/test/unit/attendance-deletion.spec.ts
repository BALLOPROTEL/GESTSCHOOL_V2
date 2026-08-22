import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { SchoolLifeAttendanceService } from "../../src/school-life/school-life-attendance.service";

const createService = (attachmentCount: number, deleteError?: Error) => {
  const prisma = {
    attendance: {
      findFirst: jest.fn().mockResolvedValue({ id: "attendance-id" }),
      delete: deleteError
        ? jest.fn().mockRejectedValue(deleteError)
        : jest.fn().mockResolvedValue({ id: "attendance-id" })
    },
    attendanceAttachment: {
      count: jest.fn().mockResolvedValue(attachmentCount)
    }
  };
  const service = new SchoolLifeAttendanceService(
    {} as never,
    {} as never,
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never
  );
  return { prisma, service };
};

const expectRestrictedConflict = async (operation: Promise<void>): Promise<void> => {
  try {
    await operation;
    throw new Error("Expected the deletion to be rejected.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: "ENTITY_DELETE_RESTRICTED"
    });
  }
};

describe("attendance deletion", () => {
  it("returns a stable 409 while attachments exist", async () => {
    const { prisma, service } = createService(1);

    await expectRestrictedConflict(service.deleteAttendance("tenant-id", "attendance-id"));

    expect(prisma.attendance.delete).not.toHaveBeenCalled();
  });

  it("maps a concurrent attachment foreign-key race to the same stable 409", async () => {
    const race = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "6.19.3"
    });
    const { prisma, service } = createService(0, race);

    await expectRestrictedConflict(service.deleteAttendance("tenant-id", "attendance-id"));

    expect(prisma.attendance.delete).toHaveBeenCalledWith({ where: { id: "attendance-id" } });
  });
});
