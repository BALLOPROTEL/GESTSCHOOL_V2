import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, type SchoolYear } from "@prisma/client";

import {
  CreateSchoolYearDto,
  UpdateSchoolYearDto
} from "./dto/reference.dto";
import { PrismaService } from "../database/prisma.service";
import { type SchoolYearView, schoolYearView } from "./reference.types";

@Injectable()
export class ReferenceSchoolYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSchoolYears(tenantId: string): Promise<SchoolYearView[]> {
    const rows = await this.prisma.schoolYear.findMany({
      where: { tenantId },
      orderBy: [{ startDate: "desc" }, { code: "desc" }]
    });
    return rows.map((row) => schoolYearView(row));
  }

  async createSchoolYear(
    tenantId: string,
    payload: CreateSchoolYearDto
  ): Promise<SchoolYearView> {
    const normalizedCode = this.resolveSchoolYearCode(payload);
    const normalizedStatus = this.resolveSchoolYearStatus(payload.status, payload.isActive);
    await this.assertSchoolYearRules(tenantId, {
      code: normalizedCode,
      label: payload.label,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: normalizedStatus,
      previousYearId: payload.previousYearId
    });

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (normalizedStatus === "ACTIVE") {
          await tx.schoolYear.updateMany({
            where: { tenantId, status: "ACTIVE" },
            data: { isActive: false, status: "DRAFT", updatedAt: new Date() }
          });
        }

        return tx.schoolYear.create({
          data: {
            tenantId,
            code: normalizedCode,
            label: payload.label.trim(),
            startDate: new Date(payload.startDate),
            endDate: new Date(payload.endDate),
            status: normalizedStatus,
            previousYearId: payload.previousYearId,
            isActive: normalizedStatus === "ACTIVE",
            isDefault: payload.isDefault ?? false,
            sortOrder: payload.sortOrder ?? this.resolveSchoolYearSortOrder(payload),
            comment: payload.comment?.trim() || null,
            updatedAt: new Date()
          }
        });
      });

      return schoolYearView(created);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async updateSchoolYear(
    tenantId: string,
    id: string,
    payload: UpdateSchoolYearDto
  ): Promise<SchoolYearView> {
    const existing = await this.requireSchoolYear(tenantId, id);
    const normalizedCode = payload.code?.trim() || existing.code;
    const normalizedStatus = payload.status
      ? this.resolveSchoolYearStatus(payload.status, payload.isActive)
      : payload.isActive === true
        ? "ACTIVE"
        : payload.isActive === false && existing.status === "ACTIVE"
          ? "DRAFT"
          : existing.status;
    await this.assertSchoolYearRules(
      tenantId,
      {
        code: normalizedCode,
        label: payload.label ?? existing.label,
        startDate: payload.startDate ?? existing.startDate.toISOString().slice(0, 10),
        endDate: payload.endDate ?? existing.endDate.toISOString().slice(0, 10),
        status: normalizedStatus,
        previousYearId: payload.previousYearId ?? existing.previousYearId ?? undefined
      },
      existing.id
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (normalizedStatus === "ACTIVE") {
          await tx.schoolYear.updateMany({
            where: { tenantId, id: { not: existing.id } },
            data: { isActive: false, status: "DRAFT", updatedAt: new Date() }
          });
        }

        return tx.schoolYear.update({
          where: { id: existing.id },
          data: {
            code: payload.code?.trim(),
            label: payload.label?.trim(),
            startDate: payload.startDate ? new Date(payload.startDate) : undefined,
            endDate: payload.endDate ? new Date(payload.endDate) : undefined,
            status: normalizedStatus,
            previousYearId: payload.previousYearId,
            isActive: normalizedStatus === "ACTIVE",
            isDefault: payload.isDefault,
            sortOrder: payload.sortOrder,
            comment: payload.comment?.trim(),
            updatedAt: new Date()
          }
        });
      });

      return schoolYearView(updated);
    } catch (error: unknown) {
      this.handleKnownPrismaError(error, "School year code already exists.");
      throw error;
    }
  }

  async deleteSchoolYear(tenantId: string, id: string): Promise<void> {
    await this.requireSchoolYear(tenantId, id);
    await this.deleteEntity(
      () => this.prisma.schoolYear.delete({ where: { id } }),
      "School year cannot be deleted because it is still used."
    );
  }

  async requireSchoolYear(tenantId: string, id: string): Promise<SchoolYear> {
    const row = await this.prisma.schoolYear.findFirst({
      where: { id, tenantId }
    });
    if (!row) {
      throw new NotFoundException("School year not found.");
    }
    return row;
  }

  private resolveSchoolYearCode(payload: CreateSchoolYearDto): string {
    const explicitCode = payload.code?.trim();
    if (explicitCode) return explicitCode;

    return `AS-${payload.label.trim().replace(/\s+/g, "-").toUpperCase()}`;
  }

  private resolveSchoolYearStatus(status: string, isActive?: boolean): string {
    if (isActive) return "ACTIVE";
    return status;
  }

  private resolveSchoolYearSortOrder(payload: { sortOrder?: number; startDate: string }): number {
    return payload.sortOrder ?? new Date(payload.startDate).getUTCFullYear();
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async assertSchoolYearRules(
    tenantId: string,
    payload: {
      code: string;
      label: string;
      startDate: string;
      endDate: string;
      status: string;
      previousYearId?: string;
    },
    ignoreId?: string
  ): Promise<void> {
    if (this.toDateOnly(payload.endDate) <= this.toDateOnly(payload.startDate)) {
      throw new BadRequestException("School year end date must be after start date.");
    }

    if (payload.status === "ACTIVE") {
      const overlappingActiveYear = await this.prisma.schoolYear.findFirst({
        where: {
          tenantId,
          id: ignoreId ? { not: ignoreId } : undefined,
          status: "ACTIVE",
          startDate: { lte: new Date(payload.endDate) },
          endDate: { gte: new Date(payload.startDate) }
        }
      });
      if (overlappingActiveYear) {
        throw new ConflictException("Another active school year overlaps this date range.");
      }
    }

    const duplicateLabel = await this.prisma.schoolYear.findFirst({
      where: {
        tenantId,
        id: ignoreId ? { not: ignoreId } : undefined,
        label: payload.label.trim()
      }
    });
    if (duplicateLabel) {
      throw new ConflictException("School year label already exists.");
    }

    if (payload.previousYearId) {
      const previousYear = await this.requireSchoolYear(tenantId, payload.previousYearId);
      if (ignoreId && previousYear.id === ignoreId) {
        throw new BadRequestException("School year cannot reference itself as previous year.");
      }
      if (previousYear.endDate >= this.toDateOnly(payload.startDate)) {
        throw new ConflictException(
          "Previous school year should end before the current one starts."
        );
      }
    }
  }

  private handleKnownPrismaError(error: unknown, conflictMessage: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(conflictMessage);
    }
  }

  private async deleteEntity(
    callback: () => Promise<unknown>,
    relationErrorMessage: string
  ): Promise<void> {
    try {
      await callback();
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ConflictException(relationErrorMessage);
      }
      throw error;
    }
  }
}
