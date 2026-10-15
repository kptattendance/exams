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

// ------------------------------------------------------------------ sub-folders
//
// Sub-folders inside the papers folder. The app creates them itself, because
// in OAuth mode it can only see files and folders it created.

const folderIds = new Map();

async function subFolderId(name) {
  if (folderIds.has(name)) return folderIds.get(name);
  const drive = getDrive();
  const parent = getPaperFolderId();
  const found = await drive.files.list({
    q: `name = '${name}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  let id = found.data.files?.[0]?.id;
  if (!id) {
    const made = await drive.files.create({
      requestBody: { name, parents: [parent], mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
      supportsAllDrives: true,
    });
    id = made.data.id;
  }
  folderIds.set(name, id);
  return id;
}

// ------------------------------------------------------------------ syllabus PDFs
// Not secret, so they are stored as they are, in the "Syllabus" folder.

export async function uploadSyllabus(buffer, name) {
  const res = await getDrive().files.create({
    requestBody: { name, parents: [await subFolderId("Syllabus")], mimeType: "application/pdf" },
    media: { mimeType: "application/pdf", body: Readable.from(buffer) },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id;
}

export const downloadFile = downloadEncrypted;
export const deleteFile = deleteEncrypted;

// ------------------------------------------------------------------ scrutiny in Google Docs
//
// While a paper is being scrutinised it exists as a Google Doc (not encrypted)
// in the "Scrutiny" folder, shared only with the scrutiniser. When scrutiny is
// finished it is exported back to Word, encrypted again, and the Doc is deleted.

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function createScrutinyDoc(buffer, name) {
  const res = await getDrive().files.create({
    requestBody: { name, parents: [await subFolderId("Scrutiny")], mimeType: "application/vnd.google-apps.document" },
    media: { mimeType: DOCX, body: Readable.from(buffer) },
    fields: "id",
    supportsAllDrives: true,
  });
  return res.data.id;
}

// Only this person (a Google account) may open and edit the Doc
export async function shareForEditing(fileId, email) {
  await getDrive().permissions.create({
    fileId,
    requestBody: { type: "user", role: "writer", emailAddress: email },
    sendNotificationEmail: false,
    supportsAllDrives: true,
  });
}

export async function exportAsDocx(fileId) {
  const res = await getDrive().files.export({ fileId, mimeType: DOCX }, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

export const scrutinyDocUrl = (fileId) => `https://docs.google.com/document/d/${fileId}/edit`;
