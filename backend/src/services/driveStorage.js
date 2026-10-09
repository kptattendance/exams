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
