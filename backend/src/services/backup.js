// src/services/backup.js
//
// Full database backup in one encrypted file (.kptbak):
//   every collection -> Extended JSON (keeps ObjectIds and dates exactly)
//   -> gzip -> AES-256-GCM
// File layout: "KPTBAK1" | iv (12 bytes) | tag (16 bytes) | encrypted data
//
// Key: BACKUP_KEY (32 bytes, base64). Falls back to STUDENT_DATA_KEY and then
// PAPER_MASTER_KEY. Keep this key offline too – without it a backup cannot be
// opened. Restore: backend/scripts/restoreBackup.js

import crypto from "crypto";
import zlib from "zlib";
import mongoose from "mongoose";

const MAGIC = Buffer.from("KPTBAK1");
const { EJSON } = mongoose.mongo.BSON;

function key() {
  const b64 = process.env.BACKUP_KEY || process.env.STUDENT_DATA_KEY || process.env.PAPER_MASTER_KEY;
  if (!b64) throw new Error("BACKUP_KEY (or STUDENT_DATA_KEY / PAPER_MASTER_KEY) is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("The backup key must be 32 bytes (base64 encoded)");
  return k;
}

export function encryptBackup(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(zlib.gzipSync(plain, { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

export function decryptBackup(file) {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("This is not a KPT backup file.");
  const at = MAGIC.length;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), file.subarray(at, at + 12));
  decipher.setAuthTag(file.subarray(at + 12, at + 28));
  const zipped = Buffer.concat([decipher.update(file.subarray(at + 28)), decipher.final()]);
  return EJSON.parse(zlib.gunzipSync(zipped).toString("utf8"), { relaxed: false });
}

// db: a connected native Db. Returns { file, meta } – the file is already
// checked by decrypting it again and comparing the counts.
export async function makeBackup(db, { by = "", reason = "" } = {}) {
  const list = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system.")).sort();
  const collections = {};
  const counts = {};
  for (const name of list) {
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }
  const meta = { app: "kptexams", version: 1, createdAt: new Date().toISOString(), database: db.databaseName, by, reason, counts };
  const plain = Buffer.from(EJSON.stringify({ meta, collections }, { relaxed: false }), "utf8");
  const file = encryptBackup(plain);

  // check: the file opens and holds every record
  const back = decryptBackup(file);
  for (const name of list) {
    if ((back.collections[name] || []).length !== counts[name]) throw new Error(`Backup check failed for ${name}.`);
  }
  return { file, meta };
}
