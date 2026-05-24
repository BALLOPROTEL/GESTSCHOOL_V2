function toWinAnsiHexString(input: string): string {
  const sanitized = input.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
  return Buffer.from(sanitized, "latin1").toString("hex").toUpperCase();
}

export function buildSimplePdf(lines: string[]): Buffer {
  const contentLines = ["BT", "/F1 12 Tf", "50 790 Td"];
  lines.forEach((line, index) => {
    const encoded = toWinAnsiHexString(line);
    if (index === 0) {
      contentLines.push(`<${encoded}> Tj`);
      return;
    }

    contentLines.push(`0 -16 Td <${encoded}> Tj`);
  });
  contentLines.push("ET");

  const stream = contentLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function toPdfDataUrl(pdfBuffer: Buffer): string {
  return `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
}
