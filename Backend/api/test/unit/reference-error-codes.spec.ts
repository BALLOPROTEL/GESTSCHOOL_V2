import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../src/database/prisma.service";
import { ReferenceHierarchyService } from "../../src/reference/reference-hierarchy.service";
import { ReferenceSchoolYearsService } from "../../src/reference/reference-school-years.service";

const foreignKeyConflict = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
    code: "P2003",
    clientVersion: "6.19.3"
  });

const expectStableConflict = async (
  operation: Promise<void>,
  expectedCode: string
): Promise<void> => {
  try {
    await operation;
    throw new Error("Expected the operation to fail");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ code: expectedCode });
  }
};

describe("reference API error codes", () => {
  it("returns a stable code when a school year is still referenced", async () => {
    const prisma = {
      schoolYear: {
        delete: jest.fn().mockRejectedValue(foreignKeyConflict()),
        findFirst: jest.fn().mockResolvedValue({ id: "school-year-id" })
      }
    } as unknown as PrismaService;
    const service = new ReferenceSchoolYearsService(prisma);

    await expectStableConflict(
      service.deleteSchoolYear("tenant-id", "school-year-id"),
      "REFERENCE_SCHOOL_YEAR_IN_USE"
    );
  });

  it("returns a stable code when a class is still referenced", async () => {
    const prisma = {
      classroom: {
        delete: jest.fn().mockRejectedValue(foreignKeyConflict()),
        findFirst: jest.fn().mockResolvedValue({ id: "class-id" })
      }
    } as unknown as PrismaService;
    const service = new ReferenceHierarchyService({} as never, prisma, {} as never);

    await expectStableConflict(
      service.deleteClassroom("tenant-id", "class-id"),
      "REFERENCE_CLASS_IN_USE"
    );
  });
});
