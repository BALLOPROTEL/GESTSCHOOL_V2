import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { PrismaClient, Prisma } from "@prisma/client";
import { inspectRequiredSchema, type RequiredSchema } from "./schema-preflight";

const prisma = new PrismaClient();

const REQUIRED_SCHEMA: RequiredSchema = {
  rooms: ["id", "tenant_id", "code", "name", "status", "archived_at"],
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
  teachers: ["id", "first_name", "last_name", "status", "archived_at"],
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
  ]
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

type SlotReference = {
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

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
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

function teacherDisplayName(assignment: TeacherAssignmentReference): string {
  return `${assignment.teacher.firstName} ${assignment.teacher.lastName}`.trim();
}

function roomDisplayName(room: RoomReference): string {
  return `${room.code} - ${room.name}`;
}

function matchRoom(slot: SlotReference, rooms: RoomReference[]): RoomReference[] {
  const text = normalize(slot.room);
  if (!text) {
    return [];
  }

  return unique(
    rooms.filter(
      (room) =>
        room.tenantId === slot.tenantId &&
        room.status === "ACTIVE" &&
        !room.archivedAt &&
        roomKeys(room).includes(text)
    )
  );
}

function matchTeacherAssignment(
  slot: SlotReference,
  assignments: TeacherAssignmentReference[]
): TeacherAssignmentReference[] {
  const text = normalize(slot.teacherName);
  if (!text) {
    return [];
  }

  return unique(
    assignments.filter(
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
  );
}

function sample<T>(rows: T[], size = 30): T[] {
  return rows.slice(0, size);
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
  const apply = process.argv.includes("--apply");
  const schemaCompatibility = await inspectRequiredSchema(prisma, REQUIRED_SCHEMA);
  if (!schemaCompatibility.isCompatible) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode: apply ? "APPLY_BLOCKED_SCHEMA_INCOMPATIBLE" : "DRY_RUN_BLOCKED_SCHEMA_INCOMPATIBLE",
          safety:
            "No timetable row was read or written because the connected database is not on the GestSchool_V2 timetable schema.",
          schemaCompatibility,
          recommendedNextCommands: [
            "Use a staging clone, not the legacy production database.",
            "Point DATABASE_URL and DIRECT_URL to staging.",
            "pnpm --filter @gestschool/api db:migrate:deploy",
            "pnpm --filter @gestschool/api migrate:timetable:dry-run"
          ]
        },
        null,
        2
      )
    );
    return;
  }

  const [slots, rooms, assignments] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: {
        OR: [
          { roomId: null, room: { not: null } },
          { teacherAssignmentId: null, teacherName: { not: null } }
        ]
      },
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
    })
  ]);

  const ambiguousRooms: Array<{ slotId: string; room: string | null; candidates: string[] }> = [];
  const unmatchedRooms: Array<{ slotId: string; room: string | null }> = [];
  const ambiguousTeachers: Array<{ slotId: string; teacherName: string | null; candidates: string[] }> = [];
  const unmatchedTeachers: Array<{ slotId: string; teacherName: string | null }> = [];
  const plannedUpdates: Array<{
    slotId: string;
    roomId?: string;
    teacherAssignmentId?: string;
  }> = [];

  let updated = 0;
  let roomBackfillable = 0;
  let teacherBackfillable = 0;

  for (const slot of slots) {
    const update: Prisma.TimetableSlotUpdateInput = {};
    const updateSummary: { slotId: string; roomId?: string; teacherAssignmentId?: string } = {
      slotId: slot.id
    };

    if (!slot.roomId && slot.room?.trim()) {
      const matches = matchRoom(slot, rooms);
      if (matches.length === 1) {
        roomBackfillable += 1;
        update.roomRef = { connect: { id: matches[0].id } };
        update.room = roomDisplayName(matches[0]);
        updateSummary.roomId = matches[0].id;
      } else if (matches.length > 1) {
        ambiguousRooms.push({
          slotId: slot.id,
          room: slot.room,
          candidates: matches.map((room) => room.id)
        });
      } else {
        unmatchedRooms.push({ slotId: slot.id, room: slot.room });
      }
    }

    if (!slot.teacherAssignmentId && slot.teacherName?.trim()) {
      const matches = matchTeacherAssignment(slot, assignments);
      if (matches.length === 1) {
        teacherBackfillable += 1;
        update.teacherAssignment = { connect: { id: matches[0].id } };
        update.teacherName = teacherDisplayName(matches[0]);
        updateSummary.teacherAssignmentId = matches[0].id;
      } else if (matches.length > 1) {
        ambiguousTeachers.push({
          slotId: slot.id,
          teacherName: slot.teacherName,
          candidates: matches.map((assignment) => assignment.id)
        });
      } else {
        unmatchedTeachers.push({ slotId: slot.id, teacherName: slot.teacherName });
      }
    }

    if (updateSummary.roomId || updateSummary.teacherAssignmentId) {
      plannedUpdates.push(updateSummary);

      if (apply) {
        await prisma.timetableSlot.update({
          where: { id: slot.id },
          data: {
            ...update,
            updatedAt: new Date()
          }
        });
        updated += 1;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY_RUN",
    safety: apply
      ? "Only unique room/teacher matches were written. No destructive operation was executed."
      : "No data was written. Re-run with --apply only after reviewing plannedUpdates and ambiguous rows.",
    scannedSlots: slots.length,
    roomBackfillable,
    teacherBackfillable,
    rowsPlannedForUpdate: plannedUpdates.length,
    rowsUpdated: updated,
    unresolved: {
      unmatchedRooms: unmatchedRooms.length,
      ambiguousRooms: ambiguousRooms.length,
      unmatchedTeachers: unmatchedTeachers.length,
      ambiguousTeachers: ambiguousTeachers.length
    },
    samples: {
      plannedUpdates: sample(plannedUpdates),
      unmatchedRooms: sample(unmatchedRooms),
      ambiguousRooms: sample(ambiguousRooms),
      unmatchedTeachers: sample(unmatchedTeachers),
      ambiguousTeachers: sample(ambiguousTeachers)
    }
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
