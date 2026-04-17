import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { inspectRequiredSchema, type RequiredSchema } from "./schema-preflight";

const prisma = new PrismaClient();

const REQUIRED_SCHEMA: RequiredSchema = {
  classes: ["id", "tenant_id", "main_room"],
  enrollments: ["id", "tenant_id", "student_id", "school_year_id", "track"],
  parent_student_links: ["id", "tenant_id", "parent_id", "parent_user_id", "student_id"],
  parents: ["id", "tenant_id", "user_id", "status", "archived_at"],
  rooms: ["id", "tenant_id", "code", "name", "status", "archived_at"],
  student_track_placements: ["id", "tenant_id", "student_id", "school_year_id", "track"],
  students: ["id", "tenant_id", "user_id", "matricule"],
  teacher_assignments: [
    "id",
    "tenant_id",
    "teacher_id",
    "school_year_id",
    "class_id",
    "subject_id",
    "track",
    "status"
  ],
  teacher_class_assignments: ["id", "tenant_id", "user_id", "class_id", "school_year_id"],
  teachers: ["id", "tenant_id", "user_id", "first_name", "last_name", "status", "archived_at"],
  timetable_slots: [
    "id",
    "tenant_id",
    "school_year_id",
    "class_id",
    "subject_id",
    "track",
    "room",
    "room_id",
    "teacher_name",
    "teacher_assignment_id"
  ],
  users: ["id", "tenant_id", "username", "account_type", "deleted_at"]
};

type RoomReference = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: string;
  archivedAt: Date | null;
};

type TeacherAssignmentReference = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  classId: string;
  subjectId: string;
  track: string;
  status: string;
  teacher: {
    firstName: string;
    lastName: string;
    status: string;
    archivedAt: Date | null;
  };
};

type TimetableSlotReference = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  classId: string;
  subjectId: string;
  track: string;
  room: string | null;
  roomId: string | null;
  teacherName: string | null;
  teacherAssignmentId: string | null;
};

function normalize(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roomKeys(room: RoomReference): string[] {
  return [
    room.code,
    room.name,
    `${room.code} - ${room.name}`,
    `${room.name} - ${room.code}`,
    `${room.name} (${room.code})`
  ].map(normalize);
}

function teacherKeys(assignment: TeacherAssignmentReference): string[] {
  const { firstName, lastName } = assignment.teacher;
  return [
    `${firstName} ${lastName}`,
    `${lastName} ${firstName}`,
    `${firstName.charAt(0)} ${lastName}`,
    `${lastName} ${firstName.charAt(0)}`
  ].map(normalize);
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function parseOutPath(): string | undefined {
  const arg = process.argv.find((value) => value.startsWith("--out="));
  return arg ? arg.slice("--out=".length) : undefined;
}

function emitReport(report: unknown): void {
  const serialized = JSON.stringify(report, null, 2);
  console.log(serialized);

  const outPath = parseOutPath();
  if (outPath) {
    const absolutePath = resolve(process.cwd(), outPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, `${serialized}\n`, "utf8");
  }
}

function sample<T>(rows: T[], size = 25): T[] {
  return rows.slice(0, size);
}

function compatibilityLevel(metrics: {
  orphanAccounts: number;
  parentLinksWithoutParentProfile: number;
  legacyTeacherAssignments: number;
  timetableLegacyOnly: number;
  unmatchedTimetableRooms: number;
  unmatchedTimetableTeachers: number;
}): "BLOCKED" | "NEEDS_MANUAL_REVIEW" | "READY_CANDIDATE" {
  if (
    metrics.orphanAccounts > 0 ||
    metrics.parentLinksWithoutParentProfile > 0 ||
    metrics.unmatchedTimetableRooms > 0 ||
    metrics.unmatchedTimetableTeachers > 0
  ) {
    return "BLOCKED";
  }

  if (metrics.legacyTeacherAssignments > 0 || metrics.timetableLegacyOnly > 0) {
    return "NEEDS_MANUAL_REVIEW";
  }

  return "READY_CANDIDATE";
}

function matchRoomIds(slot: TimetableSlotReference, rooms: RoomReference[]): string[] {
  const text = normalize(slot.room);
  if (!text) {
    return [];
  }

  return uniqueIds(
    rooms
      .filter(
        (room) =>
          room.tenantId === slot.tenantId &&
          room.status === "ACTIVE" &&
          !room.archivedAt &&
          roomKeys(room).includes(text)
      )
      .map((room) => room.id)
  );
}

function matchTeacherAssignmentIds(
  slot: TimetableSlotReference,
  assignments: TeacherAssignmentReference[]
): string[] {
  const text = normalize(slot.teacherName);
  if (!text) {
    return [];
  }

  return uniqueIds(
    assignments
      .filter(
        (assignment) =>
          assignment.tenantId === slot.tenantId &&
          assignment.schoolYearId === slot.schoolYearId &&
          assignment.classId === slot.classId &&
          assignment.subjectId === slot.subjectId &&
          assignment.track === slot.track &&
          assignment.status === "ACTIVE" &&
          assignment.teacher.status === "ACTIVE" &&
          !assignment.teacher.archivedAt &&
          teacherKeys(assignment).includes(text)
      )
      .map((assignment) => assignment.id)
  );
}

async function main(): Promise<void> {
  const schemaCompatibility = await inspectRequiredSchema(prisma, REQUIRED_SCHEMA);
  if (!schemaCompatibility.isCompatible) {
    emitReport({
      generatedAt: new Date().toISOString(),
      mode: "READ_ONLY_PRE_CUTOVER_SCHEMA_AUDIT",
      safety:
        "This command only inspected information_schema. It did not update, delete, migrate, or backfill data.",
      compatibilityLevel: "SCHEMA_INCOMPATIBLE",
      schemaCompatibility,
      blockers: [
        "The connected PostgreSQL database is not yet on the GestSchool_V2 Prisma schema.",
        "Run this only on a staging clone, then apply Prisma migrations before data audits/backfills.",
        "Do not run e2e or timetable apply against this database until the schema compatibility report is clean."
      ],
      recommendedNextCommands: [
        "Create or restore a staging clone of the legacy GESTSCHOOL database.",
        "Point DATABASE_URL and DIRECT_URL to the staging clone.",
        "pnpm --filter @gestschool/api db:migrate:deploy",
        "pnpm --filter @gestschool/api audit:precutover"
      ]
    });
    return;
  }

  const [
    totals,
    orphanTeacherAccounts,
    orphanParentAccounts,
    orphanStudentAccounts,
    teacherClassAssignments,
    parentLinksWithoutParentProfile,
    parentLinksWithLegacyOnly,
    enrollmentsWithoutPlacement,
    placementsWithoutLegacyEnrollment,
    timetableSlots,
    rooms,
    teacherAssignments,
    classroomsWithMainRoomText
  ] = await Promise.all([
    Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.parent.count(),
      prisma.parentStudentLink.count(),
      prisma.teacher.count(),
      prisma.teacherAssignment.count(),
      prisma.teacherClassAssignment.count(),
      prisma.room.count(),
      prisma.timetableSlot.count(),
      prisma.enrollment.count(),
      prisma.studentTrackPlacement.count(),
      prisma.classroom.count()
    ]).then(
      ([
        users,
        students,
        parents,
        parentStudentLinks,
        teachers,
        teacherAssignments,
        teacherClassAssignments,
        rooms,
        timetableSlots,
        enrollments,
        studentTrackPlacements,
        classrooms
      ]) => ({
        users,
        students,
        parents,
        parentStudentLinks,
        teachers,
        teacherAssignments,
        teacherClassAssignments,
        rooms,
        timetableSlots,
        enrollments,
        studentTrackPlacements,
        classrooms
      })
    ),
    prisma.user.findMany({
      where: { accountType: "TEACHER", deletedAt: null, teacherProfile: null },
      select: { id: true, username: true, email: true, role: true, accountType: true, isActive: true },
      orderBy: { username: "asc" }
    }),
    prisma.user.findMany({
      where: { accountType: "PARENT", deletedAt: null, parentProfile: null },
      select: { id: true, username: true, email: true, role: true, accountType: true, isActive: true },
      orderBy: { username: "asc" }
    }),
    prisma.user.findMany({
      where: { accountType: "STUDENT", deletedAt: null, studentProfile: null },
      select: { id: true, username: true, email: true, role: true, accountType: true, isActive: true },
      orderBy: { username: "asc" }
    }),
    prisma.teacherClassAssignment.findMany({
      select: {
        id: true,
        tenantId: true,
        userId: true,
        classId: true,
        schoolYearId: true,
        subjectId: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.parentStudentLink.findMany({
      where: { parentId: null },
      select: {
        id: true,
        tenantId: true,
        parentUserId: true,
        studentId: true,
        relationship: true,
        relationType: true,
        status: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.parentStudentLink.findMany({
      where: { parentId: null, parentUserId: { not: null } },
      select: {
        id: true,
        tenantId: true,
        parentUserId: true,
        studentId: true,
        relationship: true,
        relationType: true,
        status: true
      },
      orderBy: { createdAt: "asc" }
    }),
    prisma.enrollment.findMany({
      where: { placement: { is: null } },
      select: { id: true, tenantId: true, studentId: true, schoolYearId: true, classId: true, track: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.studentTrackPlacement.findMany({
      where: { legacyEnrollmentId: null },
      select: { id: true, tenantId: true, studentId: true, schoolYearId: true, classId: true, track: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.timetableSlot.findMany({
      select: {
        id: true,
        tenantId: true,
        schoolYearId: true,
        classId: true,
        subjectId: true,
        track: true,
        room: true,
        roomId: true,
        teacherName: true,
        teacherAssignmentId: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    }),
    prisma.room.findMany({
      select: { id: true, tenantId: true, code: true, name: true, status: true, archivedAt: true }
    }),
    prisma.teacherAssignment.findMany({
      select: {
        id: true,
        tenantId: true,
        schoolYearId: true,
        classId: true,
        subjectId: true,
        track: true,
        status: true,
        teacher: {
          select: {
            firstName: true,
            lastName: true,
            status: true,
            archivedAt: true
          }
        }
      }
    }),
    prisma.classroom.findMany({
      where: { mainRoom: { not: null } },
      select: { id: true, tenantId: true, code: true, label: true, mainRoom: true }
    })
  ]);

  const roomAudit = timetableSlots
    .filter((slot) => !slot.roomId && Boolean(slot.room?.trim()))
    .map((slot) => ({
      slotId: slot.id,
      roomText: slot.room,
      candidateRoomIds: matchRoomIds(slot, rooms)
    }));
  const teacherAudit = timetableSlots
    .filter((slot) => !slot.teacherAssignmentId && Boolean(slot.teacherName?.trim()))
    .map((slot) => ({
      slotId: slot.id,
      teacherName: slot.teacherName,
      candidateTeacherAssignmentIds: matchTeacherAssignmentIds(slot, teacherAssignments)
    }));

  const timetableLegacyOnly =
    timetableSlots.filter((slot) => !slot.roomId || !slot.teacherAssignmentId).length;
  const metrics = {
    orphanAccounts:
      orphanTeacherAccounts.length + orphanParentAccounts.length + orphanStudentAccounts.length,
    parentLinksWithoutParentProfile: parentLinksWithoutParentProfile.length,
    legacyTeacherAssignments: teacherClassAssignments.length,
    timetableLegacyOnly,
    unmatchedTimetableRooms: roomAudit.filter((row) => row.candidateRoomIds.length !== 1).length,
    unmatchedTimetableTeachers: teacherAudit.filter(
      (row) => row.candidateTeacherAssignmentIds.length !== 1
    ).length
  };

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY_PRE_CUTOVER_AUDIT",
    safety:
      "This command only reads through Prisma. It does not update, delete, migrate, or backfill data.",
    compatibilityLevel: compatibilityLevel(metrics),
    volumes: totals,
    sourceOfTruthTargets: {
      teacherPortal: "Teacher.userId -> TeacherAssignment",
      parentPortal: "Parent.userId -> ParentStudentLink.parentId",
      studentCurriculum: "StudentTrackPlacement, with Enrollment kept only as compatibility",
      timetableRoom: "TimetableSlot.roomId -> Room",
      timetableTeacher: "TimetableSlot.teacherAssignmentId -> TeacherAssignment"
    },
    anomalies: {
      orphanAccounts: {
        teacher: orphanTeacherAccounts.length,
        parent: orphanParentAccounts.length,
        student: orphanStudentAccounts.length,
        samples: {
          teacher: sample(orphanTeacherAccounts),
          parent: sample(orphanParentAccounts),
          student: sample(orphanStudentAccounts)
        }
      },
      legacyIamTeacherAssignments: {
        count: teacherClassAssignments.length,
        samples: sample(teacherClassAssignments)
      },
      parentLinksWithoutParentProfile: {
        count: parentLinksWithoutParentProfile.length,
        legacyOnlyCount: parentLinksWithLegacyOnly.length,
        samples: sample(parentLinksWithoutParentProfile)
      },
      enrollmentPlacementDrift: {
        enrollmentsWithoutPlacement: enrollmentsWithoutPlacement.length,
        placementsWithoutLegacyEnrollment: placementsWithoutLegacyEnrollment.length,
        samples: {
          enrollmentsWithoutPlacement: sample(enrollmentsWithoutPlacement),
          placementsWithoutLegacyEnrollment: sample(placementsWithoutLegacyEnrollment)
        }
      },
      timetableCanonicalCoverage: {
        slotsTotal: timetableSlots.length,
        slotsWithRoomId: timetableSlots.filter((slot) => slot.roomId).length,
        slotsWithTeacherAssignmentId: timetableSlots.filter((slot) => slot.teacherAssignmentId).length,
        slotsWithoutRoomIdButWithText: roomAudit.length,
        slotsWithoutTeacherAssignmentIdButWithText: teacherAudit.length,
        roomBackfillUniqueMatches: roomAudit.filter((row) => row.candidateRoomIds.length === 1).length,
        roomBackfillAmbiguousOrUnmatched: roomAudit.filter((row) => row.candidateRoomIds.length !== 1)
          .length,
        teacherBackfillUniqueMatches: teacherAudit.filter(
          (row) => row.candidateTeacherAssignmentIds.length === 1
        ).length,
        teacherBackfillAmbiguousOrUnmatched: teacherAudit.filter(
          (row) => row.candidateTeacherAssignmentIds.length !== 1
        ).length,
        roomSamplesToReview: sample(roomAudit.filter((row) => row.candidateRoomIds.length !== 1)),
        teacherSamplesToReview: sample(
          teacherAudit.filter((row) => row.candidateTeacherAssignmentIds.length !== 1)
        )
      },
      classroomMainRoomTextStillPresent: {
        count: classroomsWithMainRoomText.length,
        samples: sample(classroomsWithMainRoomText)
      }
    },
    recommendedNextCommands: [
      "pnpm --filter @gestschool/api migrate:timetable:dry-run",
      "Review unique matches and ambiguous rows.",
      "pnpm --filter @gestschool/api migrate:timetable:apply",
      "pnpm --filter @gestschool/api audit:precutover",
      "Only then consider TIMETABLE_REQUIRE_CANONICAL_REFS=true on staging."
    ]
  };

  emitReport(report);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
