// src/services/paperCrypto.js
//
// ENVELOPE ENCRYPTION for question papers (AES-256-GCM, Node built-in crypto)
//
//   1. Every upload gets its own random 256-bit "data key".
//   2. The Word file is encrypted with that data key.
//   3. The data key itself is encrypted ("wrapped") with the MASTER key
//      that lives only in the backend's environment variable.
//
//   Google Drive holds:  the encrypted file (useless alone)
//   MongoDB holds:       the wrapped data key (useless alone)
//   Server env holds:    the master key
//
//   An attacker needs all three to read a question paper.
//   GCM also detects any tampering with the stored file.
//
// Generate a master key once with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import "dotenv/config";
import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getMasterKey() {
  const b64 = process.env.PAPER_MASTER_KEY;
  if (!b64) throw new Error("PAPER_MASTER_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("PAPER_MASTER_KEY must be 32 bytes (base64 encoded)");
  }
  return key;
}

const KEY_VERSION = Number(process.env.PAPER_MASTER_KEY_VERSION || 1);

function gcmEncrypt(key, plain, aad) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  if (aad) cipher.setAAD(aad);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { enc, iv, tag: cipher.getAuthTag() };
}

function gcmDecrypt(key, enc, iv, tag, aad) {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/**
 * Encrypt a file buffer.
 * `context` (e.g. the PaperSetting id) is bound into the ciphertext as AAD,
 * so an encrypted file cannot be swapped onto a different paper record.
 */
export function encryptPaper(buffer, context) {
  const aad = Buffer.from(String(context));
  const dataKey = crypto.randomBytes(32);

  const file = gcmEncrypt(dataKey, buffer, aad);
  const wrapped = gcmEncrypt(getMasterKey(), dataKey, aad);
  dataKey.fill(0);

  return {
    ciphertext: file.enc,
    meta: {
      iv: file.iv.toString("base64"),
      tag: file.tag.toString("base64"),
      wrappedKey: wrapped.enc.toString("base64"),
      keyIv: wrapped.iv.toString("base64"),
      keyTag: wrapped.tag.toString("base64"),
      keyVersion: KEY_VERSION,
      sha256: sha256(buffer),
      size: buffer.length,
    },
  };
}

export function decryptPaper(ciphertext, meta, context) {
  const aad = Buffer.from(String(context));
  const b = (s) => Buffer.from(s, "base64");

  const dataKey = gcmDecrypt(
    getMasterKey(),
    b(meta.wrappedKey),
    b(meta.keyIv),
    b(meta.keyTag),
    aad
  );
  const plain = gcmDecrypt(dataKey, ciphertext, b(meta.iv), b(meta.tag), aad);
  dataKey.fill(0);

  if (meta.sha256 && sha256(plain) !== meta.sha256) {
    throw new Error("Integrity check failed: file hash mismatch");
  }
  return plain;
}

export function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
