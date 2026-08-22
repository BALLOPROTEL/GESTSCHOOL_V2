import { ConflictException } from "@nestjs/common";

import { AdmissionAcademicPolicyService } from "../../src/academic-structure/admission-academic-policy.service";
import { PrismaService } from "../../src/database/prisma.service";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const YEAR_ID = "10000000-0000-4000-8000-000000000001";
const CYCLE_ID = "20000000-0000-4000-8000-000000000001";
const LEVEL_ID = "30000000-0000-4000-8000-000000000001";
const CLASS_ID = "40000000-0000-4000-8000-000000000001";

const year = {
  id: YEAR_ID,
  code: "2026-2027",
  label: "2026-2027",
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2027-06-30T00:00:00.000Z"),
};
const level = {
  id: LEVEL_ID,
  cycleId: CYCLE_ID,
  code: "CP1",
  label: "CP1",
  track: "FRANCOPHONE" as const,
  sortOrder: 1,
  cycle: { code: "PRIMARY", label: "Primaire" },
};
const classroom = {
  id: CLASS_ID,
  schoolYearId: YEAR_ID,
  levelId: LEVEL_ID,
  code: "CP1-A",
  label: "CP1 A",
  track: "FRANCOPHONE" as const,
  capacity: 30,
  actualCapacity: 18,
  _count: { trackPlacements: 22 },
};

const selection = {
  schoolYearId: YEAR_ID,
  cycleId: CYCLE_ID,
  track: "FRANCOPHONE" as const,
  levelId: LEVEL_ID,
  classId: CLASS_ID,
};

const createPrisma = () => ({
  schoolYear: { findMany: jest.fn().mockResolvedValue([year]) },
  level: { findMany: jest.fn().mockResolvedValue([level]) },
  classroom: {
    findMany: jest.fn().mockResolvedValue([classroom]),
    findFirst: jest.fn().mockResolvedValue({
      id: CLASS_ID,
      schoolYearId: YEAR_ID,
      levelId: LEVEL_ID,
      track: "FRANCOPHONE",
    }),
  },
});

describe("AdmissionAcademicPolicyService", () => {
  it("returns progressive options without selecting a class or student", async () => {
    const prisma = createPrisma();
    const service = new AdmissionAcademicPolicyService(
      prisma as unknown as PrismaService,
    );

    const initial = await service.getOptions(TENANT_ID, {});
    expect(initial).toMatchObject({
      contractVersion: "1",
      selectionPolicy: {
        schoolYear: "SINGLE_ACTIVE",
        classCapacity: "INFORMATIONAL",
        automaticClassSelection: false,
        automaticStudentSelection: false,
      },
      tracks: [],
      levels: [],
      classes: [],
    });
    expect(prisma.level.findMany).not.toHaveBeenCalled();

    const complete = await service.getOptions(TENANT_ID, selection);
    expect(complete.tracks).toEqual(["FRANCOPHONE"]);
    expect(complete.levels).toEqual([
      expect.objectContaining({ id: LEVEL_ID, cycleId: CYCLE_ID }),
    ]);
    expect(complete.classes).toEqual([
      expect.objectContaining({
        id: CLASS_ID,
        currentEnrollmentCount: 22,
        placesRemaining: 8,
        capacityStatus: "AVAILABLE",
      }),
    ]);
  });

  it("validates each progressive dependency with stable non-leaking codes", async () => {
    const prisma = createPrisma();
    const service = new AdmissionAcademicPolicyService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.assertDraftSelection(TENANT_ID, { levelId: LEVEL_ID }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "ACADEMIC_CONTEXT_INVALID" },
    });

    prisma.schoolYear.findMany.mockResolvedValueOnce([]);
    await expect(
      service.assertDraftSelection(TENANT_ID, { schoolYearId: YEAR_ID }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "SCHOOL_YEAR_NOT_AVAILABLE" },
    });

    prisma.level.findMany.mockResolvedValueOnce([]);
    await expect(
      service.assertDraftSelection(TENANT_ID, {
        schoolYearId: YEAR_ID,
        track: "ARABOPHONE",
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "TRACK_NOT_AVAILABLE" },
    });

    prisma.level.findMany.mockResolvedValueOnce([level]);
    await expect(
      service.assertDraftSelection(TENANT_ID, {
        ...selection,
        levelId: "30000000-0000-4000-8000-000000000099",
        classId: undefined,
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "LEVEL_NOT_AVAILABLE" },
    });

    prisma.level.findMany.mockResolvedValueOnce([level]);
    prisma.classroom.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertDraftSelection(TENANT_ID, selection),
    ).rejects.toMatchObject({
      status: 400,
      response: { code: "CLASS_NOT_AVAILABLE" },
    });
  });

  it("revalidates the complete hierarchy transactionally at finalize", async () => {
    const prisma = createPrisma();
    const service = new AdmissionAcademicPolicyService(
      prisma as unknown as PrismaService,
    );

    await expect(
      service.assertCompleteSelection(TENANT_ID, selection, prisma as never),
    ).resolves.toMatchObject({ selection, classroom: { id: CLASS_ID } });

    prisma.classroom.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.assertCompleteSelection(TENANT_ID, selection, prisma as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("derives readiness from the same canonical catalog", () => {
    const prisma = createPrisma();
    const service = new AdmissionAcademicPolicyService(
      prisma as unknown as PrismaService,
    );
    const catalog = {
      schoolYear: {
        id: YEAR_ID,
        code: year.code,
        label: year.label,
        startDate: "2026-09-01",
        endDate: "2027-06-30",
      },
      levels: [
        {
          ...level,
          cycleCode: level.cycle.code,
          cycleLabel: level.cycle.label,
        },
      ],
      classes: [
        {
          ...classroom,
          cycleId: CYCLE_ID,
          currentEnrollmentCount: 22,
          placesRemaining: 8,
          capacityStatus: "AVAILABLE" as const,
        },
      ],
    };

    expect(service.isCompleteSelectionAvailable(selection, catalog)).toBe(true);
    expect(
      service.isCompleteSelectionAvailable(
        { ...selection, classId: "40000000-0000-4000-8000-000000000099" },
        catalog,
      ),
    ).toBe(false);
  });
});
