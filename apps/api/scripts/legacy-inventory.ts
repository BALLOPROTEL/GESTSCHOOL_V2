import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { inspectRequiredSchema, type RequiredSchema } from "./schema-preflight";

const prisma = new PrismaClient();

const REQUIRED_SCHEMA: RequiredSchema = {
  classes: ["id", "main_room"],
  enrollments: ["id", "tenant_id", "student_id", "school_year_id", "track"],
  parent_student_links: ["id", "parent_id", "parent_user_id", "student_id"],
  parents: ["id", "user_id"],
  rooms: ["id", "code", "name", "status"],
  student_track_placements: ["id", "legacy_enrollment_id"],
  teacher_assignments: ["id"],
  teacher_class_assignments: ["id", "user_id", "class_id", "school_year_id"],
  teachers: ["id", "user_id", "status"],
  timetable_slots: ["id", "room", "room_id", "teacher_name", "teacher_assignment_id"],
  users: ["id", "role", "account_type", "deleted_at"]
};

type RoomReference = {
  code: string;
  id: string;
  name: string;
  status: string;
};

function normalizeRoomKey(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function summarizeTextReferences(
  values: Array<string | null>,
  rooms: RoomReference[]
): { totalNonEmpty: number; matched: number; unknown: string[] } {
  const roomKeys = new Set<string>();
  for (const room of rooms) {
    roomKeys.add(normalizeRoomKey(room.code));
    roomKeys.add(normalizeRoomKey(room.name));
  }

  const normalized = values
    .map((value) => value?.trim() || "")
    .filter((value) => value.length > 0);
  const unknown = [...new Set(normalized.filter((value) => !roomKeys.has(normalizeRoomKey(value))))].sort();

  return {
    totalNonEmpty: normalized.length,
    matched: normalized.length - unknown.length,
    unknown
  };
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

async function main(): Promise<void> {
  const schemaCompatibility = await inspectRequiredSchema(prisma, REQUIRED_SCHEMA);
  if (!schemaCompatibility.isCompatible) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          purpose:
            "Lot 0 guardrail inventory could not run because the connected database is not on the required GestSchool_V2 schema.",
          safety:
            "This preflight only inspected information_schema. It did not update, delete, migrate, or backfill data.",
          compatibilityLevel: "SCHEMA_INCOMPATIBLE",
          schemaCompatibility,
          recommendedNextCommands: [
            "Use a staging clone of the legacy database.",
            "Point DATABASE_URL and DIRECT_URL to staging.",
            "pnpm --filter @gestschool/api db:migrate:deploy",
            "pnpm --filter @gestschool/api audit:legacy"
          ]
        },
        null,
        2
      )
    );
    return;
  }

  const [
    teacherClassAssignments,
    parentStudentLinksCount,
    teacherAssignmentsCount,
    teachersWithUserCount,
    enrollmentsCount,
    placementsCount,
    enrollmentsWithoutPlacementCount,
    placementsWithLegacyCount,
    orphanTeacherAccountsCount,
    orphanParentAccountsCount,
    orphanStudentAccountsCount,
    parentLinksWithoutParentProfileCount,
    timetableSlotsWithoutRoomIdCount,
    timetableSlotsWithoutTeacherAssignmentIdCount,
    timetableSlots,
    classrooms,
    rooms
  ] = await Promise.all([
    prisma.teacherClassAssignment.findMany({
      select: {
        id: true,
        subjectId: true,
        user: {
          select: {
            id: true,
            role: true,
            deletedAt: true,
            teacherProfile: { select: { id: true, status: true, archivedAt: true } }
          }
        }
      }
    }),
    prisma.parentStudentLink.count(),
    prisma.teacherAssignment.count(),
    prisma.teacher.count({ where: { userId: { not: null } } }),
    prisma.enrollment.count(),
    prisma.studentTrackPlacement.count(),
    prisma.enrollment.count({ where: { placement: { is: null } } }),
    prisma.studentTrackPlacement.count({ where: { legacyEnrollmentId: { not: null } } }),
    prisma.user.count({
      where: {
        accountType: "TEACHER",
        deletedAt: null,
        teacherProfile: null
      }
    }),
    prisma.user.count({
      where: {
        accountType: "PARENT",
        deletedAt: null,
        parentProfile: null
      }
    }),
    prisma.user.count({
      where: {
        accountType: "STUDENT",
        deletedAt: null,
        studentProfile: null
      }
    }),
    prisma.parentStudentLink.count({ where: { parentId: null } }),
    prisma.timetableSlot.count({ where: { roomId: null } }),
    prisma.timetableSlot.count({ where: { teacherAssignmentId: null } }),
    prisma.timetableSlot.findMany({ select: { room: true, teacherName: true } }),
    prisma.classroom.findMany({ select: { mainRoom: true } }),
    prisma.room.findMany({ select: { id: true, code: true, name: true, status: true } })
  ]);

  const portalTeacherAssignmentsWithTeacherProfile = teacherClassAssignments.filter(
    (assignment) => assignment.user.teacherProfile
  ).length;
  const portalTeacherAssignmentsWithoutTeacherProfile = teacherClassAssignments.filter(
    (assignment) => !assignment.user.teacherProfile
  ).length;
  const portalTeacherAssignmentsWithInactiveUser = teacherClassAssignments.filter(
    (assignment) => assignment.user.deletedAt || assignment.user.role !== "ENSEIGNANT"
  ).length;

  const timetableRooms = summarizeTextReferences(
    timetableSlots.map((slot) => slot.room),
    rooms
  );
  const classroomMainRooms = summarizeTextReferences(
    classrooms.map((classroom) => classroom.mainRoom),
    rooms
  );

  const report = {
    generatedAt: new Date().toISOString(),
    purpose:
      "Lot 0 guardrail inventory. This script does not migrate data; it counts legacy records before source-of-truth changes.",
    sourceOfTruthTargets: {
      teachers: "Teacher + TeacherAssignment",
      parents: "Parent + ParentStudentLink.parentId; parentUserId is only a temporary portal compatibility bridge",
      enrollments: "StudentTrackPlacement",
      rooms: "Room + RoomAssignment + TimetableSlot.roomId",
      timetableTeachers: "TeacherAssignment + TimetableSlot.teacherAssignmentId"
    },
    legacyCounts: {
      teacherClassAssignments: teacherClassAssignments.length,
      teacherAssignments: teacherAssignmentsCount,
      teacherProfilesLinkedToUsers: teachersWithUserCount,
      teacherClassAssignmentsWithTeacherProfile: portalTeacherAssignmentsWithTeacherProfile,
      teacherClassAssignmentsWithoutTeacherProfile: portalTeacherAssignmentsWithoutTeacherProfile,
      teacherClassAssignmentsWithInactiveOrNonTeacherUser: portalTeacherAssignmentsWithInactiveUser,
      parentStudentLinks: parentStudentLinksCount,
      parentStudentLinksWithoutParentProfile: parentLinksWithoutParentProfileCount,
      enrollments: enrollmentsCount,
      studentTrackPlacements: placementsCount,
      enrollmentsWithoutPlacement: enrollmentsWithoutPlacementCount,
      placementsLinkedToLegacyEnrollment: placementsWithLegacyCount,
      orphanTeacherAccounts: orphanTeacherAccountsCount,
      orphanParentAccounts: orphanParentAccountsCount,
      orphanStudentAccounts: orphanStudentAccountsCount,
      timetableSlotsWithoutRoomId: timetableSlotsWithoutRoomIdCount,
      timetableSlotsWithoutTeacherAssignmentId: timetableSlotsWithoutTeacherAssignmentIdCount,
      timetableSlotsWithRoomText: timetableRooms.totalNonEmpty,
      timetableRoomTextsMatchedToRoom: timetableRooms.matched,
      classroomMainRoomTexts: classroomMainRooms.totalNonEmpty,
      classroomMainRoomTextsMatchedToRoom: classroomMainRooms.matched
    },
    cleanupCandidates: {
      timetableRoomTextsNotMatchedToRoom: timetableRooms.unknown,
      classroomMainRoomTextsNotMatchedToRoom: classroomMainRooms.unknown
    },
    migrationNotes: [
      "Teacher portal should read TeacherAssignment only; TeacherClassAssignment is legacy inventory material.",
      "Parent portal should resolve Parent.userId first and then read ParentStudentLink.parentId.",
      "Do not remove Enrollment writes until every downstream consumer is confirmed on StudentTrackPlacement.",
      "TimetableSlot.room and teacherName are compatibility display fields; new writes should prefer roomId and teacherAssignmentId.",
      "Manual arbitration is required for orphan TEACHER/PARENT/STUDENT accounts and unmatched room texts."
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
