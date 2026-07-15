import { extname } from "node:path";

import { BadRequestException, Injectable, PayloadTooLargeException } from "@nestjs/common";
import * as JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as sharp from "sharp";

export type UploadCategory = "avatar" | "teacher-document" | "attendance-attachment";

export type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type ValidatedUpload = {
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
  width?: number;
  height?: number;
};

type AllowedFormat = {
  extensions: readonly string[];
  mimeType: string;
};

const FORMAT_BY_EXTENSION: Record<string, AllowedFormat> = {
  ".jpeg": { extensions: [".jpeg", ".jpg"], mimeType: "image/jpeg" },
  ".jpg": { extensions: [".jpeg", ".jpg"], mimeType: "image/jpeg" },
  ".png": { extensions: [".png"], mimeType: "image/png" },
  ".webp": { extensions: [".webp"], mimeType: "image/webp" },
  ".pdf": { extensions: [".pdf"], mimeType: "application/pdf" },
  ".docx": {
    extensions: [".docx"],
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  ".xlsx": {
    extensions: [".xlsx"],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
};

const CATEGORY_RULES: Record<
  UploadCategory,
  { maxBytes: number; extensions: readonly string[] }
> = {
  avatar: {
    maxBytes: 2 * 1024 * 1024,
    extensions: [".jpeg", ".jpg", ".png", ".webp"]
  },
  "teacher-document": {
    maxBytes: 10 * 1024 * 1024,
    extensions: [".jpeg", ".jpg", ".png", ".webp", ".pdf", ".docx", ".xlsx"]
  },
  "attendance-attachment": {
    maxBytes: 5 * 1024 * 1024,
    extensions: [".jpeg", ".jpg", ".png", ".webp", ".pdf"]
  }
};

const MAX_AVATAR_DIMENSION = 4096;
const MAX_AVATAR_PIXELS = 16_000_000;
const MAX_OFFICE_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_OFFICE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const createSharp = sharp as unknown as (
  input: Buffer,
  options: sharp.SharpOptions
) => sharp.Sharp;

@Injectable()
export class FileValidationService {
  async validate(file: UploadedFile | undefined, category: UploadCategory): Promise<ValidatedUpload> {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException("Fichier requis.");
    }

    const rule = CATEGORY_RULES[category];
    const size = file.buffer.byteLength;
    if (size === 0) {
      throw new BadRequestException("Le fichier est vide.");
    }
    if (!Number.isFinite(file.size) || file.size !== size) {
      throw new BadRequestException("La taille du fichier est incohérente.");
    }
    if (size > rule.maxBytes) {
      throw new PayloadTooLargeException(
        `Le fichier dépasse la taille maximale autorisée (${this.megabytes(rule.maxBytes)} Mo).`
      );
    }

    const originalName = this.validateOriginalName(file.originalname);
    const extension = extname(originalName).toLowerCase();
    if (!rule.extensions.includes(extension)) {
      throw new BadRequestException("Extension de fichier non autorisée.");
    }

    const expected = FORMAT_BY_EXTENSION[extension];
    const declaredMime = this.normalizeMimeType(file.mimetype);
    if (declaredMime !== expected.mimeType) {
      throw new BadRequestException("Le type MIME déclaré ne correspond pas à l’extension.");
    }

    const detected = await this.detectAndParse(file.buffer);
    if (detected.mimeType !== expected.mimeType || !detected.extensions.includes(extension)) {
      throw new BadRequestException(
        "La signature binaire du fichier ne correspond pas à son extension et à son type MIME."
      );
    }

    if (category === "avatar") {
      if (detected.width === undefined || detected.height === undefined) {
        throw new BadRequestException("L’image ne peut pas être décodée.");
      }
      if (
        detected.width > MAX_AVATAR_DIMENSION ||
        detected.height > MAX_AVATAR_DIMENSION ||
        detected.width * detected.height > MAX_AVATAR_PIXELS
      ) {
        throw new BadRequestException(
          "L’image dépasse les dimensions maximales autorisées (4096 × 4096, 16 mégapixels)."
        );
      }
    }

    return {
      originalName,
      extension,
      mimeType: expected.mimeType,
      size,
      buffer: file.buffer,
      width: detected.width,
      height: detected.height
    };
  }

  private validateOriginalName(value: string): string {
    const name = String(value || "").normalize("NFC").trim();
    if (!name || name.length > 180 || name.includes("\0")) {
      throw new BadRequestException("Nom de fichier invalide.");
    }
    if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
      throw new BadRequestException("Le nom du fichier ne doit contenir aucun chemin.");
    }
    return name;
  }

  private normalizeMimeType(value: string): string {
    return String(value || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
  }

  private async detectAndParse(buffer: Buffer): Promise<AllowedFormat & { width?: number; height?: number }> {
    if (this.isPng(buffer)) {
      this.assertPngHasNoTrailingPayload(buffer);
      return this.decodeImage(buffer, "image/png", [".png"]);
    }
    if (this.isJpeg(buffer)) {
      this.assertJpegHasNoTrailingPayload(buffer);
      return this.decodeImage(buffer, "image/jpeg", [".jpeg", ".jpg"]);
    }
    if (this.isWebp(buffer)) {
      this.assertWebpLength(buffer);
      return this.decodeImage(buffer, "image/webp", [".webp"]);
    }
    if (this.isPdf(buffer)) {
      await this.parsePdf(buffer);
      return { mimeType: "application/pdf", extensions: [".pdf"] };
    }
    if (this.isZip(buffer)) {
      return this.parseOfficeArchive(buffer);
    }
    throw new BadRequestException("Signature binaire inconnue ou fichier tronqué.");
  }

  private async decodeImage(
    buffer: Buffer,
    mimeType: string,
    extensions: readonly string[]
  ): Promise<AllowedFormat & { width: number; height: number }> {
    try {
      const image = createSharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || (metadata.pages && metadata.pages > 1)) {
        throw new Error("Invalid or animated image.");
      }
      await image.raw().toBuffer();
      return { mimeType, extensions, width: metadata.width, height: metadata.height };
    } catch {
      throw new BadRequestException("Image corrompue, animée ou impossible à décoder.");
    }
  }

  private async parsePdf(buffer: Buffer): Promise<void> {
    const end = buffer.lastIndexOf(Buffer.from("%%EOF"));
    if (end < 0 || buffer.subarray(end + 5).toString("latin1").trim().length > 0) {
      throw new BadRequestException("PDF tronqué ou contenant des données ajoutées après sa fin.");
    }
    const source = buffer.toString("latin1");
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia)\b/i.test(source)) {
      throw new BadRequestException("Le PDF contient une fonctionnalité active interdite.");
    }
    try {
      await PDFDocument.load(buffer, {
        ignoreEncryption: false,
        updateMetadata: false
      });
    } catch {
      throw new BadRequestException("PDF corrompu, chiffré ou impossible à parser.");
    }
  }

  private async parseOfficeArchive(buffer: Buffer): Promise<AllowedFormat> {
    this.assertZipHasNoTrailingPayload(buffer);
    let archive: JSZip;
    try {
      archive = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false });
    } catch {
      throw new BadRequestException("Archive Office corrompue ou impossible à parser.");
    }

    const names = Object.keys(archive.files);
    if (names.length === 0 || names.length > 5_000) {
      throw new BadRequestException("Archive Office vide ou anormalement complexe.");
    }
    if (names.some((name) => this.isUnsafeArchiveEntry(name))) {
      throw new BadRequestException("Archive Office contenant un chemin ou un type interdit.");
    }
    this.assertOfficeArchiveExpansionIsBounded(archive, names);

    const contentTypes = archive.file("[Content_Types].xml");
    if (!contentTypes) {
      throw new BadRequestException("Archive Office sans manifeste de contenu.");
    }
    const manifest = await contentTypes.async("string");
    if (manifest.length > 2 * 1024 * 1024) {
      throw new BadRequestException("Manifeste Office anormalement volumineux.");
    }

    if (archive.file("word/document.xml")) {
      await this.readBoundedXml(archive, "word/document.xml");
      return {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extensions: [".docx"]
      };
    }
    if (archive.file("xl/workbook.xml")) {
      await this.readBoundedXml(archive, "xl/workbook.xml");
      return {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extensions: [".xlsx"]
      };
    }
    throw new BadRequestException("Format Office non pris en charge.");
  }

  private async readBoundedXml(archive: JSZip, name: string): Promise<void> {
    const value = await archive.file(name)!.async("string");
    if (!value.trim().startsWith("<") || value.length > 20 * 1024 * 1024) {
      throw new BadRequestException("Contenu Office invalide ou décompressé trop volumineux.");
    }
  }

  private isUnsafeArchiveEntry(name: string): boolean {
    const normalized = name.replace(/\\/g, "/").toLowerCase();
    return (
      normalized.startsWith("/") ||
      normalized.split("/").includes("..") ||
      /\.(exe|dll|com|bat|cmd|ps1|sh|js|vbs|jar|msi|docm|xlsm)$/i.test(normalized) ||
      normalized.endsWith("vbaproject.bin") ||
      normalized.includes("/activex/") ||
      normalized.includes("/embeddings/")
    );
  }

  private assertOfficeArchiveExpansionIsBounded(archive: JSZip, names: string[]): void {
    let total = 0;
    for (const name of names) {
      const entry = archive.files[name] as JSZip.JSZipObject & {
        _data?: { uncompressedSize?: number };
      };
      if (entry.dir) continue;
      const size = Number(entry._data?.uncompressedSize);
      if (!Number.isFinite(size) || size < 0 || size > MAX_OFFICE_ENTRY_BYTES) {
        throw new BadRequestException("Archive Office contenant une entrée décompressée trop volumineuse.");
      }
      total += size;
      if (total > MAX_OFFICE_UNCOMPRESSED_BYTES) {
        throw new BadRequestException("Archive Office dépassant la taille décompressée autorisée.");
      }
    }
  }

  private assertZipHasNoTrailingPayload(buffer: Buffer): void {
    const marker = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const endOfCentralDirectory = buffer.lastIndexOf(marker);
    if (endOfCentralDirectory < 0 || endOfCentralDirectory + 22 > buffer.length) {
      throw new BadRequestException("Archive Office tronquée.");
    }
    const commentLength = buffer.readUInt16LE(endOfCentralDirectory + 20);
    if (endOfCentralDirectory + 22 + commentLength !== buffer.length) {
      throw new BadRequestException("Archive Office contenant des données ajoutées après sa fin.");
    }
  }

  private isPng(buffer: Buffer): boolean {
    return buffer.length >= 20 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }

  private assertPngHasNoTrailingPayload(buffer: Buffer): void {
    let offset = 8;
    let endedAt = -1;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const next = offset + 12 + length;
      if (next > buffer.length) break;
      const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
      offset = next;
      if (chunkType === "IEND") {
        endedAt = offset;
        break;
      }
    }
    if (endedAt !== buffer.length) {
      throw new BadRequestException("PNG tronqué ou contenant des données ajoutées.");
    }
  }

  private isJpeg(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  private assertJpegHasNoTrailingPayload(buffer: Buffer): void {
    if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
      throw new BadRequestException("JPEG tronqué ou contenant des données ajoutées.");
    }
  }

  private isWebp(buffer: Buffer): boolean {
    return (
      buffer.length >= 16 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  private assertWebpLength(buffer: Buffer): void {
    if (buffer.readUInt32LE(4) + 8 !== buffer.length) {
      throw new BadRequestException("WebP tronqué ou contenant des données ajoutées.");
    }
  }

  private isPdf(buffer: Buffer): boolean {
    return buffer.length >= 8 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  private isZip(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  }

  private megabytes(bytes: number): number {
    return bytes / (1024 * 1024);
  }
}
