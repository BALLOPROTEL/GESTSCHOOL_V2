import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AcademicTrack, Prisma } from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  CreateTimetableSlotDto,
  UpdateTimetableSlotDto
} from "./dto/school-life.dto";
import {
  DAY_LABELS,
  type TimetableGridView,
  type TimetableSlotView,
  type TimetableSlotWithRelations
} from "./school-life.types";

@Injectable()
export class SchoolLifeTimetableService {
  constructor(
    private readonly academicStructureService: AcademicStructureService,
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly configService: ConfigService
  ) {}

  async listTimetableSlots(
    tenantId: string,
    filters: {
      classId?: string;
      schoolYearId?: string;
      dayOfWeek?: number;
      track?: AcademicTrack;
    }
  ): Promise<TimetableSlotView[]> {
    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        classId: filters.classId,
        schoolYearId: filters.schoolYearId,
        dayOfWeek: filters.dayOfWeek,
        track: filters.track
      },
      include: {
        classroom: true,
        subject: true,
        schoolYear: true,
        roomRef: true,
        teacherAssignment: {
          include: {
            teacher: true
          }
        }
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });

    return rows.map((row) => this.timetableSlotView(row));
  }

  async getTimetableGrid(
    tenantId: string,
    filters: { classId?: string; schoolYearId?: string; track?: AcademicTrack }
  ): Promise<TimetableGridView> {
    const slots = await this.listTimetableSlots(tenantId, {
      classId: filters.classId,
      schoolYearId: filters.schoolYearId,
      track: filters.track
    });

    const days = Array.from({ length: 7 }, (_, index) => {
      const dayOfWeek = index + 1;
      return {
        dayOfWeek,
        dayLabel: DAY_LABELS.get(dayOfWeek) || `Jour ${dayOfWeek}`,
        slots: [] as TimetableSlotView[]
      };
    });

    for (const slot of slots) {
      const day = days[slot.dayOfWeek - 1];
      if (day) {
        day.slots.push(slot);
      }
    }

    return {
      classId: filters.classId,
      schoolYearId: filters.schoolYearId,
      days
    };
  }

  async createTimetableSlot(
    tenantId: string,
    payload: CreateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);
    await this.referenceService.requireSubject(tenantId, payload.subjectId);

    this.validateTimes(payload.startTime, payload.endTime);

    const ruleContext =
      await this.academicStructureService.validateTimetableSlotAgainstPedagogicalRules(tenantId, {
        classId: classroom.id,
        dayOfWeek: payload.dayOfWeek,
        startTime: payload.startTime,
        track: payload.track,
        rotationGroup: payload.rotationGroup
      });
    const room = payload.roomId ? await this.requireRoom(tenantId, payload.roomId) : null;
    const teacherAssignment = payload.teacherAssignmentId
      ? await this.requireTeacherAssignmentForSlot(tenantId, payload.teacherAssignmentId, {
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          subjectId: payload.subjectId,
          track: ruleContext.track
        })
      : null;
    const teacherName = teacherAssignment
      ? this.teacherDisplayName(teacherAssignment.teacher)
      : payload.teacherName?.trim();
    const roomLabel = room ? `${room.code} - ${room.name}` : payload.room?.trim();
    this.assertCanonicalTimetableRefs(room?.id, teacherAssignment?.id);

    await this.ensureNoTimetableConflict(tenantId, {
      classId: classroom.id,
      schoolYearId: classroom.schoolYearId,
      dayOfWeek: payload.dayOfWeek,
      startTime: payload.startTime,
      endTime: payload.endTime,
      roomId: room?.id,
      teacherAssignmentId: teacherAssignment?.id,
      teacherName
    });

    try {
      const created = await this.prisma.timetableSlot.create({
        data: {
          tenantId,
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          track: ruleContext.track,
          rotationGroup: ruleContext.rotationGroup || null,
          subjectId: payload.subjectId,
          dayOfWeek: payload.dayOfWeek,
          startTime: payload.startTime,
          endTime: payload.endTime,
          roomId: room?.id,
          teacherAssignmentId: teacherAssignment?.id,
          room: roomLabel,
          teacherName,
          updatedAt: new Date()
        },
        include: {
          classroom: true,
          subject: true,
          schoolYear: true,
          roomRef: true,
          teacherAssignment: {
            include: {
              teacher: true
            }
          }
        }
      });

      return this.timetableSlotView(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A slot already exists for this class, day and start time."
        );
      }
      throw error;
    }
  }

  async updateTimetableSlot(
    tenantId: string,
    id: string,
    payload: UpdateTimetableSlotDto
  ): Promise<TimetableSlotView> {
    const existing = await this.requireTimetableSlot(tenantId, id);

    const classId = payload.classId || existing.classId;
    const classroom = await this.referenceService.requireClassroom(tenantId, classId);

    if (payload.subjectId) {
      await this.referenceService.requireSubject(tenantId, payload.subjectId);
    }

    const startTime = payload.startTime || existing.startTime;
    const endTime = payload.endTime || existing.endTime;
    const dayOfWeek = payload.dayOfWeek || existing.dayOfWeek;

    this.validateTimes(startTime, endTime);

    const ruleContext =
      await this.academicStructureService.validateTimetableSlotAgainstPedagogicalRules(tenantId, {
        classId: classroom.id,
        dayOfWeek,
        startTime,
        track: payload.track || existing.track,
        rotationGroup: payload.rotationGroup || existing.rotationGroup || undefined
      });
    const roomId = payload.roomId ?? existing.roomId ?? undefined;
    const teacherAssignmentId =
      payload.teacherAssignmentId ?? existing.teacherAssignmentId ?? undefined;
    const room = roomId ? await this.requireRoom(tenantId, roomId) : null;
    const teacherAssignment = teacherAssignmentId
      ? await this.requireTeacherAssignmentForSlot(tenantId, teacherAssignmentId, {
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          subjectId: payload.subjectId || existing.subjectId,
          track: ruleContext.track
        })
      : null;
    const teacherName = teacherAssignment
      ? this.teacherDisplayName(teacherAssignment.teacher)
      : payload.teacherName ?? existing.teacherName ?? undefined;
    const roomLabel = room
      ? `${room.code} - ${room.name}`
      : payload.room ?? existing.room ?? undefined;
    this.assertCanonicalTimetableRefs(roomId, teacherAssignmentId);

    await this.ensureNoTimetableConflict(tenantId, {
      classId: classroom.id,
      schoolYearId: classroom.schoolYearId,
      dayOfWeek,
      startTime,
      endTime,
      roomId,
      teacherAssignmentId,
      teacherName,
      excludeId: existing.id
    });

    try {
      const updated = await this.prisma.timetableSlot.update({
        where: { id: existing.id },
        data: {
          classId: classroom.id,
          schoolYearId: classroom.schoolYearId,
          track: ruleContext.track,
          rotationGroup: ruleContext.rotationGroup || null,
          subjectId: payload.subjectId,
          dayOfWeek: payload.dayOfWeek,
          startTime: payload.startTime,
          endTime: payload.endTime,
          roomId: payload.roomId,
          teacherAssignmentId: payload.teacherAssignmentId,
          room: payload.roomId ? roomLabel : payload.room,
          teacherName: payload.teacherAssignmentId ? teacherName : payload.teacherName,
          updatedAt: new Date()
        },
        include: {
          classroom: true,
          subject: true,
          schoolYear: true,
          roomRef: true,
          teacherAssignment: {
            include: {
              teacher: true
            }
          }
        }
      });

      return this.timetableSlotView(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A slot already exists for this class, day and start time."
        );
      }
      throw error;
    }
  }

  async deleteTimetableSlot(tenantId: string, id: string): Promise<void> {
    await this.requireTimetableSlot(tenantId, id);
    await this.prisma.timetableSlot.delete({ where: { id } });
  }

  async requireTimetableSlot(tenantId: string, id: string) {
    const row = await this.prisma.timetableSlot.findFirst({
      where: {
        id,
        tenantId
      }
    });

    if (!row) {
      throw new NotFoundException("Timetable slot not found.");
    }

    return row;
  }

  private async ensureNoTimetableConflict(
    tenantId: string,
    payload: {
      classId: string;
      schoolYearId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      roomId?: string;
      teacherAssignmentId?: string;
      teacherName?: string;
      excludeId?: string;
    }
  ): Promise<void> {
    const normalizedTeacherName = payload.teacherName?.trim() || undefined;

    const rows = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId,
        schoolYearId: payload.schoolYearId,
        dayOfWeek: payload.dayOfWeek,
        id: payload.excludeId ? { not: payload.excludeId } : undefined,
        OR: [
          { classId: payload.classId },
          ...(payload.roomId ? [{ roomId: payload.roomId }] : []),
          ...(payload.teacherAssignmentId
            ? [{ teacherAssignmentId: payload.teacherAssignmentId }]
            : []),
          ...(normalizedTeacherName ? [{ teacherName: normalizedTeacherName }] : [])
        ]
      }
    });

    for (const row of rows) {
      if (!this.timesOverlap(payload.startTime, payload.endTime, row.startTime, row.endTime)) {
        continue;
      }

      if (row.classId === payload.classId) {
        throw new ConflictException("Classroom already has another slot in this time range.");
      }

      if (payload.roomId && row.roomId === payload.roomId) {
        throw new ConflictException("Room already has another slot in this time range.");
      }

      if (payload.teacherAssignmentId && row.teacherAssignmentId === payload.teacherAssignmentId) {
        throw new ConflictException(
          "Teacher assignment already has another slot in this time range."
        );
      }

      if (normalizedTeacherName && row.teacherName === normalizedTeacherName) {
        throw new ConflictException("Teacher already has another slot in this time range.");
      }
    }
  }

  private async requireRoom(tenantId: string, id: string) {
    const row = await this.prisma.room.findFirst({
      where: {
        id,
        tenantId,
        archivedAt: null,
        status: "ACTIVE"
      },
      select: { id: true, code: true, name: true }
    });

    if (!row) {
      throw new NotFoundException("Active room not found.");
    }

    return row;
  }

  private async requireTeacherAssignmentForSlot(
    tenantId: string,
    id: string,
    context: {
      classId: string;
      schoolYearId: string;
      subjectId: string;
      track: AcademicTrack;
    }
  ) {
    const row = await this.prisma.teacherAssignment.findFirst({
      where: {
        id,
        tenantId,
        status: "ACTIVE"
      },
      include: {
        teacher: true
      }
    });

    if (!row || row.teacher.archivedAt || row.teacher.status !== "ACTIVE") {
      throw new NotFoundException("Active teacher assignment not found.");
    }
    if (
      row.classId !== context.classId ||
      row.schoolYearId !== context.schoolYearId ||
      row.subjectId !== context.subjectId ||
      row.track !== context.track
    ) {
      throw new ConflictException(
        "Teacher assignment must match class, school year, subject and track."
      );
    }

    return row;
  }

  private teacherDisplayName(row: { firstName: string; lastName: string }): string {
    return `${row.firstName} ${row.lastName}`.trim();
  }

  private validateTimes(startTime: string, endTime: string): void {
    if (this.parseTimeToMinutes(startTime) >= this.parseTimeToMinutes(endTime)) {
      throw new ConflictException("startTime must be earlier than endTime.");
    }
  }

  private assertCanonicalTimetableRefs(
    roomId?: string | null,
    teacherAssignmentId?: string | null
  ): void {
    if (!this.requiresCanonicalTimetableRefs()) {
      return;
    }

    const missing = [
      roomId ? undefined : "roomId",
      teacherAssignmentId ? undefined : "teacherAssignmentId"
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new BadRequestException(
        `Timetable canonical references are required before cutover: ${missing.join(", ")}.`
      );
    }
  }

  private requiresCanonicalTimetableRefs(): boolean {
    return (
      this.configService
        .get<string>("TIMETABLE_REQUIRE_CANONICAL_REFS", "false")
        .trim()
        .toLowerCase() === "true"
    );
  }

  private timesOverlap(
    leftStart: string,
    leftEnd: string,
    rightStart: string,
    rightEnd: string
  ): boolean {
    const leftStartMinutes = this.parseTimeToMinutes(leftStart);
    const leftEndMinutes = this.parseTimeToMinutes(leftEnd);
    const rightStartMinutes = this.parseTimeToMinutes(rightStart);
    const rightEndMinutes = this.parseTimeToMinutes(rightEnd);

    return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
  }

  private parseTimeToMinutes(value: string): number {
    const [hour, minute] = value.split(":").map((item) => Number(item));
    return hour * 60 + minute;
  }

  private timetableSlotView(row: TimetableSlotWithRelations): TimetableSlotView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      classId: row.classId,
      schoolYearId: row.schoolYearId,
      subjectId: row.subjectId,
      track: row.track,
      rotationGroup: row.rotationGroup || undefined,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      roomId: row.roomId || undefined,
      room: row.roomRef ? `${row.roomRef.code} - ${row.roomRef.name}` : row.room || undefined,
      teacherAssignmentId: row.teacherAssignmentId || undefined,
      teacherName: row.teacherAssignment?.teacher
        ? this.teacherDisplayName(row.teacherAssignment.teacher)
        : row.teacherName || undefined,
      classLabel: row.classroom.label,
      subjectLabel: row.subject.label,
      schoolYearCode: row.schoolYear.code
    };
  }
}
