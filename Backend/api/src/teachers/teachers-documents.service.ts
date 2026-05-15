import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { StorageService } from "../storage/storage.service";
import { type UploadDescriptorView } from "../storage/storage-provider";
import {
  CreateTeacherDocumentDto,
  CreateTeacherDocumentUploadDescriptorDto,
  UpdateTeacherDocumentDto
} from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import { type TeacherDocumentView } from "./teachers.types";

const TEACHER_DOCUMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const TEACHER_DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

@Injectable()
export class TeachersDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService,
    private readonly storageService: StorageService
  ) {}

  async listDocuments(tenantId: string, teacherId?: string): Promise<TeacherDocumentView[]> {
    const rows = await this.prisma.teacherDocument.findMany({
      where: { tenantId, teacherId, status: { not: "ARCHIVED" } },
      include: { teacher: true, uploadedByUser: true },
      orderBy: [{ uploadedAt: "desc" }]
    });
    return rows.map((row) => this.teachersSupportService.documentView(row));
  }

  async createUploadDescriptor(
    tenantId: string,
    teacherId: string,
    payload: CreateTeacherDocumentUploadDescriptorDto
  ): Promise<UploadDescriptorView> {
    await this.teachersSupportService.requireTeacher(tenantId, teacherId);
    this.validateUpload(payload.mimeType, payload.size);

    return this.storageService.createUploadDescriptor(tenantId, {
      bucket: "documents",
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      folder: `teachers/${teacherId}/documents`
    });
  }

  async createDocument(
    tenantId: string,
    actorUserId: string,
    payload: CreateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    await this.teachersSupportService.requireTeacher(tenantId, payload.teacherId);
    this.validateDocumentReference(payload);
    const created = await this.prisma.teacherDocument.create({
      data: {
        tenantId,
        teacherId: payload.teacherId,
        documentType: payload.documentType,
        fileUrl: payload.fileUrl.trim(),
        documentName: this.documentName(payload),
        originalName: this.originalName(payload.originalName),
        mimeType: payload.mimeType.trim().toLowerCase(),
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
        documentName: payload.documentName !== undefined ? this.documentName(payload, existing.originalName) : undefined,
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

  private validateUpload(mimeType: string, size: number): void {
    const normalizedMimeType = mimeType.trim().toLowerCase();
    if (!TEACHER_DOCUMENT_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException("Ce type de fichier n'est pas autorisé.");
    }
    if (size > TEACHER_DOCUMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException("Le fichier dépasse la taille maximale autorisée.");
    }
  }

  private validateDocumentReference(payload: CreateTeacherDocumentDto): void {
    this.validateUpload(payload.mimeType, payload.size);
    const decodedUrl = this.decodeDocumentUrl(payload.fileUrl);
    const expectedPath = `/teachers/${payload.teacherId.toLowerCase()}/documents/`;
    if (!decodedUrl.includes(expectedPath)) {
      throw new BadRequestException("La référence du document ne correspond pas à l'enseignant.");
    }
  }

  private decodeDocumentUrl(fileUrl: string): string {
    try {
      return decodeURIComponent(fileUrl.trim()).toLowerCase();
    } catch {
      throw new BadRequestException("La référence du document est invalide.");
    }
  }

  private documentName(
    payload: Pick<Partial<CreateTeacherDocumentDto>, "documentName" | "originalName">,
    fallbackOriginalName = ""
  ): string {
    const value = payload.documentName?.trim() || payload.originalName?.trim() || fallbackOriginalName.trim();
    if (!value) {
      throw new BadRequestException("Le nom du document est requis.");
    }
    return value;
  }

  private originalName(originalName: string): string {
    const value = originalName.replace(/[\\/]+/g, "-").trim();
    if (!value) {
      throw new BadRequestException("Le nom original du fichier est requis.");
    }
    return value;
  }
}
