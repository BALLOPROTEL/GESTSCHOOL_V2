import { ConflictException, Injectable } from "@nestjs/common";
import { AcademicTrack, RotationGroup } from "@prisma/client";
import type { Prisma } from "@prisma/client";

@Injectable()
export class AcademicStructureRuleValidator {
  validateWeeklyTrackRule(
    config: Prisma.JsonValue,
    track: AcademicTrack,
    dayOfWeek: number,
    ruleLabel: string
  ): void {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return;
    }

    const daysByTrack = (config as Record<string, unknown>).daysByTrack;
    if (!daysByTrack || typeof daysByTrack !== "object" || Array.isArray(daysByTrack)) {
      return;
    }

    const allowedDays = (daysByTrack as Record<string, unknown>)[track];
    if (!Array.isArray(allowedDays) || allowedDays.length === 0) {
      return;
    }

    const normalizedDays = allowedDays
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

    if (normalizedDays.length > 0 && !normalizedDays.includes(dayOfWeek)) {
      throw new ConflictException(
        `Timetable slot violates pedagogical rule "${ruleLabel}" for ${track}.`
      );
    }
  }

  validateParallelRotationRule(
    config: Prisma.JsonValue,
    track: AcademicTrack,
    rotationGroup: RotationGroup | undefined,
    startTime: string,
    ruleLabel: string
  ): void {
    if (!rotationGroup) {
      return;
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return;
    }

    const schedule = (config as Record<string, unknown>).schedule;
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
      return;
    }

    const halfDayKey = this.parseTimeToMinutes(startTime) < 12 * 60 ? "MORNING" : "AFTERNOON";
    const halfDaySchedule = (schedule as Record<string, unknown>)[halfDayKey];
    if (!halfDaySchedule || typeof halfDaySchedule !== "object" || Array.isArray(halfDaySchedule)) {
      return;
    }

    const expectedTrack = (halfDaySchedule as Record<string, unknown>)[rotationGroup];
    if (!expectedTrack) {
      return;
    }

    if (this.normalizeTrack(expectedTrack as string) !== track) {
      throw new ConflictException(
        `Timetable slot violates pedagogical rule "${ruleLabel}" for ${rotationGroup}.`
      );
    }
  }

  private normalizeTrack(value?: string | AcademicTrack | null): AcademicTrack {
    const normalized = (value || "FRANCOPHONE").toString().trim().toUpperCase();
    if (normalized === "AR" || normalized === "ARABOPHONE") {
      return AcademicTrack.ARABOPHONE;
    }
    return AcademicTrack.FRANCOPHONE;
  }

  private parseTimeToMinutes(value: string): number {
    const [hour, minute] = value.split(":").map((item) => Number(item));
    return hour * 60 + minute;
  }
}
