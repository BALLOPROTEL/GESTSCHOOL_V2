import { EnrollmentsService } from "../../src/enrollments/enrollments.service";

describe("enrollment deletion transaction", () => {
  it("passes one Prisma transaction through the placement and legacy enrollment deletion", async () => {
    const transaction = { marker: "transaction" };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
      )
    };
    const academicStructure = {
      deleteTrackPlacement: jest.fn().mockResolvedValue(undefined)
    };
    const service = new EnrollmentsService(
      prisma as never,
      {} as never,
      academicStructure as never
    );

    await service.removePlacement("tenant-id", "placement-id");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(academicStructure.deleteTrackPlacement).toHaveBeenCalledWith(
      "tenant-id",
      "placement-id",
      {
        transaction,
        deleteLegacyEnrollment: true
      }
    );
  });

  it("propagates a child deletion failure through the transaction boundary", async () => {
    const expected = new Error("legacy enrollment delete failed");
    const transaction = { marker: "transaction" };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
      )
    };
    const academicStructure = {
      deleteTrackPlacement: jest.fn().mockRejectedValue(expected)
    };
    const service = new EnrollmentsService(
      prisma as never,
      {} as never,
      academicStructure as never
    );

    await expect(service.removePlacement("tenant-id", "placement-id")).rejects.toBe(expected);
  });
});
