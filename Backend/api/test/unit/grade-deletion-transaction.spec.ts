import { GradesEntryService } from "../../src/grades/grades-entry.service";

describe("grade deletion transaction", () => {
  it("deletes the grade and synchronizes report cards through one transaction", async () => {
    const transaction = {
      gradeEntry: {
        delete: jest.fn().mockResolvedValue({ id: "grade-id" })
      }
    };
    const prisma = {
      gradeEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: "grade-id",
          classId: "class-id",
          academicPeriodId: "period-id"
        })
      },
      $transaction: jest.fn(async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
      )
    };
    const reportCards = {
      syncReportCardsForClassPeriod: jest.fn().mockResolvedValue(undefined)
    };
    const service = new GradesEntryService(
      {} as never,
      prisma as never,
      {} as never,
      reportCards as never
    );

    await expect(service.deleteGrade("tenant-id", "grade-id")).resolves.toEqual({
      deleted: true
    });

    expect(transaction.gradeEntry.delete).toHaveBeenCalledWith({ where: { id: "grade-id" } });
    expect(reportCards.syncReportCardsForClassPeriod).toHaveBeenCalledWith(
      "tenant-id",
      "class-id",
      "period-id",
      transaction
    );
  });

  it("propagates report-card failures so the transaction can roll back the grade", async () => {
    const expected = new Error("report-card sync failed");
    const transaction = {
      gradeEntry: {
        delete: jest.fn().mockResolvedValue({ id: "grade-id" })
      }
    };
    const prisma = {
      gradeEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: "grade-id",
          classId: "class-id",
          academicPeriodId: "period-id"
        })
      },
      $transaction: jest.fn(async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction)
      )
    };
    const reportCards = {
      syncReportCardsForClassPeriod: jest.fn().mockRejectedValue(expected)
    };
    const service = new GradesEntryService(
      {} as never,
      prisma as never,
      {} as never,
      reportCards as never
    );

    await expect(service.deleteGrade("tenant-id", "grade-id")).rejects.toBe(expected);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
