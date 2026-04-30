import { hash } from "bcryptjs";
import { AcademicStage, AcademicTrack, PrismaClient } from "@prisma/client";

import { getDefaultDevUsers } from "../src/database/dev-default-users";

const prisma = new PrismaClient();

const tenantId =
  process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

const schoolYearCode = process.env.SEED_SCHOOL_YEAR_CODE || "2025-2026";
const schoolYearLabel = process.env.SEED_SCHOOL_YEAR_LABEL || "Annee 2025-2026";
const schoolYearStart = new Date(process.env.SEED_SCHOOL_YEAR_START || "2025-09-01");
const schoolYearEnd = new Date(process.env.SEED_SCHOOL_YEAR_END || "2026-07-31");

async function seedUsers(): Promise<void> {
  const includePortalUsers = process.env.DEV_BOOTSTRAP_PORTAL_USERS === "true";
  const users = getDefaultDevUsers({ includePortalUsers });

  for (const user of users) {
    const passwordHash = await hash(user.password, 10);
    const email = user.username.includes("@") ? user.username : null;
    await prisma.user.upsert({
      where: {
        tenantId_username: {
          tenantId,
          username: user.username
        }
      },
      create: {
        tenantId,
        username: user.username,
        email,
        displayName: user.username,
        accountType: user.accountType,
        passwordHash,
        role: user.role,
        mustChangePasswordAtFirstLogin: true,
        isActive: true
      },
      update: {
        email,
        displayName: user.username,
        accountType: user.accountType,
        role: user.role,
        passwordHash,
        mustChangePasswordAtFirstLogin: true,
        isActive: true,
        deletedAt: null,
        updatedAt: new Date()
      }
    });
  }
}

async function seedAcademicBaseline(): Promise<void> {
  const schoolYear = await prisma.schoolYear.upsert({
    where: {
      tenantId_code: {
        tenantId,
        code: schoolYearCode
      }
    },
    create: {
      tenantId,
      code: schoolYearCode,
      label: schoolYearLabel,
      startDate: schoolYearStart,
      endDate: schoolYearEnd,
      status: "ACTIVE",
      isActive: true,
      isDefault: true,
      sortOrder: 1
    },
    update: {
      label: schoolYearLabel,
      startDate: schoolYearStart,
      endDate: schoolYearEnd,
      status: "ACTIVE",
      isActive: true,
      isDefault: true,
      updatedAt: new Date()
    }
  });

  const primary = await prisma.cycle.upsert({
    where: {
      tenantId_schoolYearId_code: {
        tenantId,
        schoolYearId: schoolYear.id,
        code: "PRIMARY"
      }
    },
    create: {
      tenantId,
      schoolYearId: schoolYear.id,
      code: "PRIMARY",
      label: "Primaire",
      academicStage: AcademicStage.PRIMARY,
      sortOrder: 1,
      status: "ACTIVE"
    },
    update: { label: "Primaire", academicStage: AcademicStage.PRIMARY, status: "ACTIVE" }
  });

  const secondary = await prisma.cycle.upsert({
    where: {
      tenantId_schoolYearId_code: {
        tenantId,
        schoolYearId: schoolYear.id,
        code: "SECONDARY"
      }
    },
    create: {
      tenantId,
      schoolYearId: schoolYear.id,
      code: "SECONDARY",
      label: "Secondaire",
      academicStage: AcademicStage.SECONDARY,
      sortOrder: 2,
      status: "ACTIVE"
    },
    update: { label: "Secondaire", academicStage: AcademicStage.SECONDARY, status: "ACTIVE" }
  });

  const levels = [
    {
      cycleId: primary.id,
      track: AcademicTrack.FRANCOPHONE,
      code: "FR_CP1",
      label: "CP1 francophone",
      sortOrder: 1
    },
    {
      cycleId: primary.id,
      track: AcademicTrack.ARABOPHONE,
      code: "AR_CP1",
      label: "CP1 arabophone",
      sortOrder: 2
    },
    {
      cycleId: secondary.id,
      track: AcademicTrack.FRANCOPHONE,
      code: "FR_6E",
      label: "6e francophone",
      sortOrder: 10
    },
    {
      cycleId: secondary.id,
      track: AcademicTrack.ARABOPHONE,
      code: "AR_6E",
      label: "6e arabophone",
      sortOrder: 11
    }
  ];

  for (const level of levels) {
    await prisma.level.upsert({
      where: {
        tenantId_cycleId_code: {
          tenantId,
          cycleId: level.cycleId,
          code: level.code
        }
      },
      create: {
        tenantId,
        cycleId: level.cycleId,
        track: level.track,
        code: level.code,
        label: level.label,
        sortOrder: level.sortOrder,
        status: "ACTIVE"
      },
      update: {
        track: level.track,
        label: level.label,
        sortOrder: level.sortOrder,
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });
  }

  const periods = [
    { code: "T1", label: "Trimestre 1", startDate: "2025-09-01", endDate: "2025-12-20" },
    { code: "T2", label: "Trimestre 2", startDate: "2026-01-06", endDate: "2026-03-31" },
    { code: "T3", label: "Trimestre 3", startDate: "2026-04-01", endDate: "2026-07-15" }
  ];

  for (const period of periods) {
    await prisma.academicPeriod.upsert({
      where: {
        tenantId_schoolYearId_code: {
          tenantId,
          schoolYearId: schoolYear.id,
          code: period.code
        }
      },
      create: {
        tenantId,
        schoolYearId: schoolYear.id,
        code: period.code,
        label: period.label,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        periodType: "TRIMESTER",
        sortOrder: Number(period.code.slice(1)),
        status: "ACTIVE"
      },
      update: {
        label: period.label,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate),
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });
  }

  const subjects = [
    { code: "FR", label: "Francais", nature: "FRANCOPHONE", isArabic: false },
    { code: "MATH", label: "Mathematiques", nature: "FRANCOPHONE", isArabic: false },
    { code: "AR", label: "Arabe", nature: "ARABOPHONE", isArabic: true },
    { code: "EDI", label: "Etudes islamiques", nature: "ARABOPHONE", isArabic: true }
  ];

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: subject.code
        }
      },
      create: {
        tenantId,
        code: subject.code,
        label: subject.label,
        nature: subject.nature,
        isArabic: subject.isArabic,
        status: "ACTIVE"
      },
      update: {
        label: subject.label,
        nature: subject.nature,
        isArabic: subject.isArabic,
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });
  }

  const roomTypes = [
    { code: "CLASSROOM", name: "Salle de classe" },
    { code: "LAB", name: "Laboratoire" },
    { code: "LIBRARY", name: "Bibliotheque" }
  ];

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: {
        tenantId_code: {
          tenantId,
          code: roomType.code
        }
      },
      create: {
        tenantId,
        code: roomType.code,
        name: roomType.name,
        status: "ACTIVE"
      },
      update: {
        name: roomType.name,
        status: "ACTIVE",
        updatedAt: new Date()
      }
    });
  }
}

async function main(): Promise<void> {
  await seedUsers();
  await seedAcademicBaseline();
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("seed:minimal failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
