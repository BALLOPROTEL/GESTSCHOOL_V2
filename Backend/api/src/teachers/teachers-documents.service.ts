import { randomUUID } from "node:crypto";

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  FileValidationService,
  type UploadedFile as BufferedUpload
} from "../storage/file-validation.service";
import { type StorageDriver, type StoredObjectReference } from "../storage/storage-provider";
import { StorageService } from "../storage/storage.service";
import { CreateTeacherDocumentDto, UpdateTeacherDocumentDto } from "./dto/teachers.dto";
import { TeachersSupportService } from "./teachers-support.service";
import { type TeacherDocumentView } from "./teachers.types";

@Injectable()
export class TeachersDocumentsService {
  private readonly logger = new Logger(TeachersDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teachersSupportService: TeachersSupportService,
    private readonly storageService: StorageService,
    private readonly fileValidationService: FileValidationService
  ) {}

  async listDocuments(tenantId: string, teacherId?: string): Promise<TeacherDocumentView[]> {
    if (teacherId) await this.teachersSupportService.requireTeacher(tenantId, teacherId);
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
    teacherId: string,
    payload: CreateTeacherDocumentDto,
    file: BufferedUpload
  ): Promise<TeacherDocumentView> {
    await this.teachersSupportService.requireTeacher(tenantId, teacherId);
    const validated = await this.fileValidationService.validate(file, "teacher-document");
    const stored = await this.storageService.storeValidatedFile({
      tenantId,
      bucketKind: "documents",
      scope: ["teachers", teacherId, "documents"],
      file: validated
    });
    const id = randomUUID();

    try {
      const created = await this.prisma.$transaction(async (transaction) => {
        const row = await transaction.teacherDocument.create({
          data: {
            id,
            tenantId,
            teacherId,
            documentType: payload.documentType,
            fileUrl: `/api/v1/teachers/documents/${id}/content`,
            documentName: this.documentName(payload.documentName),
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            size: stored.size,
            storageDriver: stored.driver,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            uploadedBy: actorUserId,
            status: payload.status || "ACTIVE"
          },
          include: { teacher: true, uploadedByUser: true }
        });
        await this.teachersSupportService.logAudit(
          tenantId,
          actorUserId,
          "TEACHER_DOCUMENT_CREATED",
          "teacher_documents",
          row.id,
          { teacherId, documentType: row.documentType },
          transaction
        );
        return row;
      });
      return this.teachersSupportService.documentView(created);
    } catch (error) {
      await this.deleteAfterFailedCreate(stored, error);
      throw error;
    }
  }

  async downloadDocument(
    tenantId: string,
    id: string
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const document = await this.teachersSupportService.requireDocument(tenantId, id);
    if (document.status === "ARCHIVED") throw new NotFoundException("Teacher document not found.");
    const reference = this.storageReference(tenantId, document);
    const file = await this.storageService.readFile(reference);
    return {
      buffer: file.buffer,
      mimeType: document.mimeType || file.mimeType || "application/octet-stream",
      fileName: document.originalName
    };
  }

  async updateDocument(
    tenantId: string,
    actorUserId: string,
    id: string,
    payload: UpdateTeacherDocumentDto
  ): Promise<TeacherDocumentView> {
    const existing = await this.teachersSupportService.requireDocument(tenantId, id);
    if (existing.status === "ARCHIVED") throw new NotFoundException("Teacher document not found.");
    const updated = await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: {
        documentType: payload.documentType,
        documentName:
          payload.documentName === undefined ? undefined : this.documentName(payload.documentName),
        status: payload.status
      },
      include: { teacher: true, uploadedByUser: true }
    });
    await this.teachersSupportService.logAudit(
      tenantId,
      actorUserId,
      "TEACHER_DOCUMENT_UPDATED",
      "teacher_documents",
      updated.id
    );
    return this.teachersSupportService.documentView(updated);
  }

  async archiveDocument(tenantId: string, actorUserId: string, id: string): Promise<void> {
    const existing = await this.teachersSupportService.requireDocument(tenantId, id);
    if (existing.status === "ARCHIVED") return;
    const reference = this.storageReference(tenantId, existing);
    const archivedAt = new Date();

    await this.prisma.teacherDocument.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt }
    });
    try {
      await this.storageService.deleteFile(reference);
    } catch (error) {
      await this.restoreAfterFailedDelete(existing.id, existing.status, existing.archivedAt, error);
      throw new ServiceUnavailableException("Le document n'a pas pu être supprimé du stockage.");
    }
    await this.teachersSupportService.logAudit(
      tenantId,
      actorUserId,
      "TEACHER_DOCUMENT_ARCHIVED",
      "teacher_documents",
      existing.id
    );
  }

  private storageReference(
    tenantId: string,
    row: { storageDriver: string | null; storageBucket: string | null; storageKey: string | null }
  ): StoredObjectReference {
    if (
      (row.storageDriver !== "LOCAL" && row.storageDriver !== "SUPABASE") ||
      !row.storageBucket ||
      !row.storageKey
    ) {
      throw new NotFoundException("Le fichier historique n'est pas disponible dans le stockage sécurisé.");
    }
    return {
      tenantId,
      driver: row.storageDriver as StorageDriver,
      bucket: row.storageBucket,
      key: row.storageKey
    };
  }

  private documentName(value: string): string {
    const result = value.trim();
    if (!result) throw new BadRequestException("Le nom du document est requis.");
    return result;
  }

  private async deleteAfterFailedCreate(
    reference: StoredObjectReference,
    originalError: unknown
  ): Promise<void> {
    try {
      await this.storageService.deleteFile(reference);
    } catch (cleanupError) {
      this.logger.error("Teacher document cleanup failed after database error.", cleanupError);
      this.logger.error("Original teacher document database error.", originalError);
    }
  }

  private async restoreAfterFailedDelete(
    id: string,
    status: string,
    archivedAt: Date | null,
    providerError: unknown
  ): Promise<void> {
    try {
      await this.prisma.teacherDocument.update({ where: { id }, data: { status, archivedAt } });
    } catch (restoreError) {
      this.logger.error("Teacher document rollback failed after storage deletion error.", restoreError);
    }
    this.logger.error("Teacher document storage deletion failed.", providerError);
  }
}
