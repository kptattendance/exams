// src/services/driveStorage.js
//
// Stores ONLY encrypted blobs in Google Drive.
// File names are random UUIDs with no subject / examiner / session info,
// so even someone browsing the Drive folder learns nothing.

import crypto from "crypto";
import { Readable } from "stream";
import { getDrive, getPaperFolderId } from "../config/googleDrive.js";

export async function uploadEncrypted(ciphertext) {
  const drive = getDrive();

  const res = await drive.files.create({
    requestBody: {
      name: `${crypto.randomUUID()}.bin`,
      parents: [getPaperFolderId()],
      mimeType: "application/octet-stream",
    },
    media: {
      mimeType: "application/octet-stream",
      body: Readable.from(ciphertext),
    },
    fields: "id,size",
    supportsAllDrives: true,
  });

  if (Number(res.data.size) !== ciphertext.length) {
    throw new Error("Drive upload size mismatch");
  }
  return res.data.id;
}

export async function downloadEncrypted(fileId) {
  const drive = getDrive();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}

// Used only to clean up a blob if saving the DB record fails right after upload
export async function deleteEncrypted(fileId) {
  try {
    await getDrive().files.delete({ fileId, supportsAllDrives: true });
  } catch (e) {
    console.error("Drive cleanup failed for", fileId, e.message);
  }
}

// ------------------------------------------------------------------ syllabus PDFs
//
// Not secret, so they are stored as they are, in a "Syllabus" folder inside
// the papers folder. The app creates that folder itself, because in OAuth
// mode it can only see files and folders it created.

let syllabusFolderId = null;

async function getSyllabusFolderId() {
  if (syllabusFolderId) return syllabusFolderId;
  const drive = getDrive();
  const parent = getPaperFolderId();
  const found = await drive.files.list({
    q: `name = 'Syllabus' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  syllabusFolderId = found.data.files?.[0]?.id;
  if (!syllabusFolderId) {
    const made = await drive.files.create({
      requestBody: { name: "Syllabus", parents: [parent], mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
      supportsAllDrives: true,
    });
    syllabusFolderId = made.data.id;
  }
  return syllabusFolderId;
}

export async function uploadSyllabus(buffer, name) {
  const res = await getDrive().files.create({
    requestBody: { name, parents: [await getSyllabusFolderId()], mimeType: "application/pdf" },
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id;
}

export const downloadFile = downloadEncrypted;
export const deleteFile = deleteEncrypted;
