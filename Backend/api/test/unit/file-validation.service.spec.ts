import * as JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import * as sharp from "sharp";

import {
  FileValidationService,
  type UploadedFile
} from "../../src/storage/file-validation.service";

const createSharp = sharp as unknown as (
  input: sharp.SharpOptions,
) => sharp.Sharp;

const upload = (
  buffer: Buffer,
  originalname: string,
  mimetype: string,
  size = buffer.byteLength
): UploadedFile => ({ buffer, originalname, mimetype, size });

describe("FileValidationService", () => {
  const service = new FileValidationService();

  const png = (width = 16, height = 16): Promise<Buffer> =>
    createSharp({
      create: { width, height, channels: 4, background: { r: 20, g: 120, b: 200, alpha: 1 } }
    })
      .png()
      .toBuffer();

  it("accepts and decodes a valid avatar", async () => {
    const buffer = await png();

    await expect(service.validate(upload(buffer, "avatar.png", "image/png"), "avatar"))
      .resolves.toMatchObject({
        extension: ".png",
        mimeType: "image/png",
        size: buffer.byteLength,
        width: 16,
        height: 16
      });
  });

  it.each([
    ["script.sh", "text/x-sh"],
    ["../avatar.png", "image/png"],
    ["folder/avatar.png", "image/png"]
  ])("rejects forbidden or path-bearing names: %s", async (name, mimeType) => {
    const buffer = await png();
    await expect(service.validate(upload(buffer, name, mimeType), "avatar")).rejects.toThrow();
  });

  it("rejects an empty file and inconsistent multipart size", async () => {
    await expect(
      service.validate(upload(Buffer.alloc(0), "avatar.png", "image/png"), "avatar")
    ).rejects.toThrow("vide");

    const buffer = await png();
    await expect(
      service.validate(upload(buffer, "avatar.png", "image/png", buffer.byteLength + 1), "avatar")
    ).rejects.toThrow("incohérente");
  });

  it("rejects oversized files before parsing", async () => {
    const buffer = Buffer.alloc(2 * 1024 * 1024 + 1, 0x61);
    await expect(
      service.validate(upload(buffer, "avatar.png", "image/png"), "avatar")
    ).rejects.toThrow("taille maximale");
  });

  it("rejects a forged MIME type and a forged binary signature", async () => {
    const buffer = await png();
    await expect(
      service.validate(upload(buffer, "avatar.png", "image/jpeg"), "avatar")
    ).rejects.toThrow("MIME déclaré");

    await expect(
      service.validate(
        upload(Buffer.from("not-a-png"), "avatar.png", "image/png"),
        "avatar"
      )
    ).rejects.toThrow("Signature binaire");
  });

  it("rejects corrupted and oversized images", async () => {
    const valid = await png();
    const corrupted = valid.subarray(0, valid.length - 8);
    await expect(
      service.validate(upload(corrupted, "avatar.png", "image/png"), "avatar")
    ).rejects.toThrow();

    const oversized = await png(4097, 1);
    await expect(
      service.validate(upload(oversized, "avatar.png", "image/png"), "avatar")
    ).rejects.toThrow("dimensions maximales");
  });

  it("rejects an image with a trailing polyglot payload", async () => {
    const buffer = Buffer.concat([await png(), Buffer.from("<script>alert(1)</script>")]);
    await expect(
      service.validate(upload(buffer, "avatar.png", "image/png"), "avatar")
    ).rejects.toThrow("données ajoutées");
  });

  it("parses a valid PDF and rejects active or malformed PDFs", async () => {
    const document = await PDFDocument.create();
    document.addPage([200, 200]);
    const valid = Buffer.from(await document.save());
    await expect(
      service.validate(upload(valid, "justificatif.pdf", "application/pdf"), "attendance-attachment")
    ).resolves.toMatchObject({ extension: ".pdf", mimeType: "application/pdf" });

    const active = Buffer.from("%PDF-1.4\n/JavaScript true\n%%EOF");
    await expect(
      service.validate(upload(active, "active.pdf", "application/pdf"), "teacher-document")
    ).rejects.toThrow("fonctionnalité active");
  });

  it("parses a valid DOCX archive and rejects traversal entries", async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", "<Types></Types>");
    archive.file("word/document.xml", "<document></document>");
    const valid = await archive.generateAsync({ type: "nodebuffer" });
    await expect(
      service.validate(
        upload(
          valid,
          "contrat.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        "teacher-document"
      )
    ).resolves.toMatchObject({ extension: ".docx" });

    const unsafeArchive = new JSZip();
    unsafeArchive.file("[Content_Types].xml", "<Types></Types>");
    unsafeArchive.file("word/document.xml", "<document></document>");
    unsafeArchive.file("payload.js", "alert(1)");
    const unsafe = await unsafeArchive.generateAsync({ type: "nodebuffer" });
    await expect(
      service.validate(
        upload(
          unsafe,
          "contrat.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        "teacher-document"
      )
    ).rejects.toThrow("type interdit");
  });

  it("rejects Office archives with macros, trailing payloads or excessive expansion", async () => {
    const macroArchive = new JSZip();
    macroArchive.file("[Content_Types].xml", "<Types></Types>");
    macroArchive.file("word/document.xml", "<document></document>");
    macroArchive.file("word/vbaProject.bin", "macro");
    const macro = await macroArchive.generateAsync({ type: "nodebuffer" });
    await expect(
      service.validate(
        upload(
          macro,
          "macro.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        "teacher-document"
      )
    ).rejects.toThrow("type interdit");

    const validArchive = new JSZip();
    validArchive.file("[Content_Types].xml", "<Types></Types>");
    validArchive.file("word/document.xml", "<document></document>");
    const valid = await validArchive.generateAsync({ type: "nodebuffer" });
    const polyglot = Buffer.concat([valid, Buffer.from("<script>alert(1)</script>")]);
    await expect(
      service.validate(
        upload(
          polyglot,
          "polyglot.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        "teacher-document"
      )
    ).rejects.toThrow("données ajoutées");

    const expandedArchive = new JSZip();
    expandedArchive.file("[Content_Types].xml", "<Types></Types>");
    expandedArchive.file("word/document.xml", `<document>${"a".repeat(21 * 1024 * 1024)}</document>`);
    const expanded = await expandedArchive.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE"
    });
    await expect(
      service.validate(
        upload(
          expanded,
          "expansion.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
        "teacher-document"
      )
    ).rejects.toThrow("décompressée trop volumineuse");
  });
});
