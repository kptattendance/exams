// src/services/docxValidator.js
//
// Checks that an upload is a genuine, safe .docx BEFORE we accept it.
// Does not trust the file name or the browser's MIME type.
//
//  - Must be a ZIP (a .docx is a zip of XML files)
//  - Must contain [Content_Types].xml and word/document.xml
//  - Rejects macro files (vbaProject.bin -> .docm renamed to .docx)
//  - Rejects old .doc and password-protected Word files (OLE format)
//  - Rejects "zip bombs" (huge uncompressed size / too many entries)

const MAX_UNCOMPRESSED = 60 * 1024 * 1024; // 60 MB
const MAX_ENTRIES = 2000;

export class DocxError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function listZipEntries(buf) {
  // Find End Of Central Directory record (scan back over max comment size)
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new DocxError("File is damaged or not a Word (.docx) file.");

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count > MAX_ENTRIES) throw new DocxError("Word file has too many parts.");

  const entries = [];
  let p = cdOffset;
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) {
      throw new DocxError("File is damaged or not a Word (.docx) file.");
    }
    const uncompressed = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    total += uncompressed;
    entries.push(name);
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (total > MAX_UNCOMPRESSED) {
    throw new DocxError("Word file is too large when unpacked.");
  }
  return entries;
}

export function validateDocx(buf, originalName = "") {
  if (!buf || buf.length < 100) throw new DocxError("File is empty.");

  if (!/\.docx$/i.test(originalName)) {
    throw new DocxError("Only .docx Word files are allowed.");
  }

  // OLE2 header: old .doc OR password-protected .docx
  if (buf.readUInt32BE(0) === 0xd0cf11e0) {
    throw new DocxError(
      "This is an old .doc file or a password-protected Word file. " +
        "Open it in Word, remove the password if any, and use File > Save As > Word Document (.docx)."
    );
  }

  if (buf.readUInt32LE(0) !== 0x04034b50) {
    throw new DocxError("File is not a valid Word (.docx) file.");
  }

  const entries = listZipEntries(buf);
  const lower = entries.map((e) => e.toLowerCase());

  if (!lower.includes("[content_types].xml") || !lower.includes("word/document.xml")) {
    throw new DocxError("File is not a valid Word (.docx) document.");
  }
  if (lower.some((e) => e.endsWith("vbaproject.bin"))) {
    throw new DocxError(
      "This Word file contains macros. Please save it as a normal .docx (without macros) and upload again."
    );
  }
  if (lower.some((e) => e.startsWith("word/embeddings/"))) {
    // Embedded OLE objects (other files inside the doc). Allowed but flagged.
    return { entries, warnings: ["Document contains embedded objects."] };
  }
  return { entries, warnings: [] };
}
