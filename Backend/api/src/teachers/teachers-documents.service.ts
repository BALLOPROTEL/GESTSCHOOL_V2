import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  CreateTeacherDocumentDto,
  UpdateTeacherDocumentDto
} from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import { type TeacherDocumentView } from "./teachers.types";

@Injectable()
export class TeachersDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService
  ) {}

  async listDocuments(tenantId: string, teacherId?: string): Promise<TeacherDocumentView[]> {
    const rows = await this.prisma.teacherDocument.findMany({
      where: { tenantId, teacherId, status: { not: "ARCHIVED" } },
      include: { teacher: true, uploadedByUser: true },
      orderBy: [{ uploadedAt: "desc" }]
    });
    return rows.map((row) => this.teachersSupportService.documentView(row));
  }

  async createDocument(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    await this.teachersSupportService.requireTeacher(tenantId, payload.teacherId);
    const created = await this.prisma.teacherDocument.create({
      data: {
        tenantId,
        teacherId: payload.teacherId,
        documentType: payload.documentType,
        fileUrl: payload.fileUrl.trim(),
        originalName: payload.originalName.trim(),
        mimeType: this.teachersSupportService.optionalTrim(payload.mimeType),
        size: payload.size,
        uploadedBy: actorUserId,
        status: payload.status || "ACTIVE"
      },
      include: { teacher: true, uploadedByUser: true }
    });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_CREATED", "teacher_documents", created.id, {
      teacherId: created.teacherId,
      documentType: created.documentType
    });
    return this.teachersSupportService.documentView(created);
  }

  async updateDocument(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    const existing = await this.teachersSupportService.requireDocument(tenantId, id);
    if (payload.teacherId) await this.teachersSupportService.requireTeacher(tenantId, payload.teacherId);
    const updated = await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: {
        teacherId: payload.teacherId,
        documentType: payload.documentType,
        fileUrl: payload.fileUrl?.trim(),
        originalName: payload.originalName?.trim(),
        mimeType: payload.mimeType !== undefined ? this.teachersSupportService.optionalTrim(payload.mimeType) : undefined,
        size: payload.size,
        status: payload.status,
        archivedAt:
          payload.status === "ARCHIVED"
            ? existing.archivedAt ?? new Date()
            : payload.status
              ? null
              : undefined
      },
      include: { teacher: true, uploadedByUser: true }
    });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_UPDATED", "teacher_documents", updated.id);
    return this.teachersSupportService.documentView(updated);
  }

  async archiveDocument(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.teachersSupportService.requireDocument(tenantId, id);
    await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: existing.archivedAt ?? new Date() }
    });
    await this.teachersSupportService.logAudit(tenantId, actorUserId, "TEACHER_DOCUMENT_ARCHIVED", "teacher_documents", existing.id);
  }
}
