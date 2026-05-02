import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AcademicPlacementStatus,
  AcademicTrack,
  Prisma
} from "@prisma/client";

import { AcademicStructureService } from "../academic-structure/academic-structure.service";
import { PrismaService } from "../database/prisma.service";
import { ReferenceService } from "../reference/reference.service";
import {
  CreateEnrollmentDto,
  CreateStudentTrackPlacementDto
} from "./dto/create-enrollment.dto";

type EnrollmentView = {
  id: string;
  tenantId: string;
  schoolYearId: string;
  studentId: string;
  classId: string;
  track: AcademicTrack;
  placementId?: string;
  isPrimary?: boolean;
  enrollmentDate: string;
  enrollmentStatus: string;
  studentName?: string;
  classLabel?: string;
  schoolYearCode?: string;
  primaryClassLabel?: string;
  secondaryClassLabel?: string;
  primaryTrack?: AcademicTrack;
  secondaryTrack?: AcademicTrack;
};

type EnrollmentPlacementRow = Prisma.StudentTrackPlacementGetPayload<{
  include: {
    student: true;
    classroom: true;
    schoolYear: true;
    legacyEnrollment: true;
  };
}>;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referenceService: ReferenceService,
    private readonly academicStructureService: AcademicStructureService
  ) {}

  async list(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      classId?: string;
      studentId?: string;
      track?: string;
    }
  ): Promise<EnrollmentView[]> {
    const rows = await this.prisma.studentTrackPlacement.findMany({
      where: {
        tenantId,
        schoolYearId: filters.schoolYearId,
        classId: filters.classId,
        studentId: filters.studentId,
        track: filters.track
          ? this.academicStructureService.normalizeTrack(filters.track)
          : undefined
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        legacyEnrollment: true
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }]
    });

    return Promise.all(rows.map((row) => this.toViewFromPlacement(row)));
  }

  async create(
    tenantId: string,
    payload: CreateEnrollmentDto
  ): Promise<EnrollmentView> {
    await this.referenceService.requireSchoolYear(tenantId, payload.schoolYearId);
    const classroom = await this.referenceService.requireClassroom(tenantId, payload.classId);

    const student = await this.prisma.student.findFirst({
      where: {
        id: payload.studentId,
        tenantId,
        deletedAt: null
      }
    });
    if (!student) {
      throw new NotFoundException("Student not found.");
    }

    const placement = await this.academicStructureService.upsertTrackPlacement(
      tenantId,
      {
        studentId: payload.studentId,
        schoolYearId: payload.schoolYearId,
        track: payload.track || classroom.track,
        levelId: classroom.levelId,
        classId: payload.classId,
        placementStatus: payload.enrollmentStatus || "ACTIVE",
        startDate: payload.enrollmentDate
      },
      { syncLegacyEnrollment: true }
    );

    const created = await this.prisma.studentTrackPlacement.findFirst({
      where: {
        tenantId,
        id: placement.id
      },
      include: {
        student: true,
        classroom: true,
        schoolYear: true,
        legacyEnrollment: true
      }
    });

    if (!created) {
      throw new ConflictException("Academic placement could not be synchronized.");
    }

    return this.toViewFromPlacement(created);
  }

  async listPlacements(
    tenantId: string,
    filters: {
      schoolYearId?: string;
      studentId?: string;
      classId?: string;
      levelId?: string;
      track?: string;
    }
  ) {
    return this.academicStructureService.listTrackPlacements(tenantId, filters);
  }

  async createPlacement(
    tenantId: string,
    payload: CreateStudentTrackPlacementDto
  ) {
    return this.academicStructureService.upsertTrackPlacement(
      tenantId,
      payload,
      { syncLegacyEnrollment: Boolean(payload.classId) }
    );
  }

  async removePlacement(tenantId: string, id: string): Promise<void> {
    await this.academicStructureService.deleteTrackPlacement(tenantId, id, {
      deleteLegacyEnrollment: true
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const placement = await this.prisma.studentTrackPlacement.findFirst({
      where: {
        tenantId,
        OR: [{ id }, { legacyEnrollmentId: id }]
      }
    });

    if (placement) {
      await this.academicStructureService.deleteTrackPlacement(tenantId, placement.id, {
        deleteLegacyEnrollment: true
      });
      return;
    }

    const legacyEnrollment = await this.prisma.enrollment.findFirst({
      where: { id, tenantId }
    });

    if (!legacyEnrollment) {
      throw new NotFoundException("Academic placement or legacy enrollment not found.");
    }

    await this.prisma.enrollment.delete({ where: { id } });
  }

  private async toViewFromPlacement(
    row: EnrollmentPlacementRow
  ): Promise<EnrollmentView> {
    const placementContext =
      await this.academicStructureService.resolvePrimarySecondaryPlacements(
        row.tenantId,
        row.studentId,
        row.schoolYearId
      );
    const linkedPlacement =
      placementContext.placements.find((placement) => placement.id === row.id) ||
      placementContext.placements.find((placement) => placement.track === row.track);
    const enrollmentDate =
      row.legacyEnrollment?.enrollmentDate ||
      row.startDate ||
      row.createdAt;

    return {
      id: row.legacyEnrollmentId || row.id,
      tenantId: row.tenantId,
      schoolYearId: row.schoolYearId,
      studentId: row.studentId,
      classId: row.classId || row.legacyEnrollment?.classId || "",
      track: row.track,
      placementId: row.id,
      isPrimary: linkedPlacement?.isPrimary,
      enrollmentDate: enrollmentDate.toISOString().slice(0, 10),
      enrollmentStatus:
        row.legacyEnrollment?.enrollmentStatus ||
        this.placementStatusToEnrollmentStatus(row.placementStatus),
      studentName: row.student
        ? `${row.student.firstName} ${row.student.lastName}`.trim()
        : undefined,
      classLabel: row.classroom?.label,
      schoolYearCode: row.schoolYear?.code,
      primaryClassLabel: placementContext.primaryPlacement?.classLabel,
      secondaryClassLabel: placementContext.secondaryPlacement?.classLabel,
      primaryTrack: placementContext.primaryPlacement?.track,
      secondaryTrack: placementContext.secondaryPlacement?.track
    };
  }

  private placementStatusToEnrollmentStatus(
    status: AcademicPlacementStatus
  ): string {
    if (status === AcademicPlacementStatus.ACTIVE) return "ENROLLED";
    if (status === AcademicPlacementStatus.COMPLETED) return "COMPLETED";
    if (status === AcademicPlacementStatus.SUSPENDED) return "SUSPENDED";
    return "INACTIVE";
  }
}
