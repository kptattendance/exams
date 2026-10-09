// src/services/studentCrypto.js
//
// Aadhaar numbers are stored encrypted (AES-256-GCM). The database keeps:
//   aadhaarEncrypted : the encrypted number (only the server can decrypt)
//   aadhaarHash      : a keyed hash, used only to detect duplicates
//   aadhaarNumber    : masked "XXXXXXXX1234" for display
//
// Key: STUDENT_DATA_KEY (32 bytes, base64). Falls back to PAPER_MASTER_KEY.

import "dotenv/config";
import crypto from "crypto";

function key() {
  const b64 = process.env.STUDENT_DATA_KEY || process.env.PAPER_MASTER_KEY;
  if (!b64) throw new Error("STUDENT_DATA_KEY (or PAPER_MASTER_KEY) is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("STUDENT_DATA_KEY must be 32 bytes (base64 encoded)");
  return k;
}

export function encryptAadhaar(aadhaar) {
  if (!aadhaar) return { aadhaarEncrypted: "", aadhaarHash: "", aadhaarNumber: "" };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(aadhaar, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    aadhaarEncrypted: Buffer.concat([iv, tag, enc]).toString("base64"),
    aadhaarHash: hashAadhaar(aadhaar),
    aadhaarNumber: maskAadhaar(aadhaar),
  };
}

export function decryptAadhaar(blob) {
  if (!blob) return "";
  const buf = Buffer.from(blob, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export const hashAadhaar = (aadhaar) =>
  crypto.createHmac("sha256", key()).update(`aadhaar:${aadhaar}`).digest("hex");

export const maskAadhaar = (aadhaar) => (aadhaar ? `XXXXXXXX${aadhaar.slice(-4)}` : "");
