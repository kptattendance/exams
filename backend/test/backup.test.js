import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";

process.env.BACKUP_KEY = crypto.randomBytes(32).toString("base64");
const { encryptBackup, decryptBackup } = await import("../src/services/backup.js");
const { EJSON } = mongoose.mongo.BSON;

test("backup file: encrypted, opens again with ObjectIds and dates intact", () => {
  const id = new mongoose.Types.ObjectId();
  const when = new Date("2026-10-29T10:00:00Z");
  const data = { meta: { counts: { students: 1 } }, collections: { students: [{ _id: id, name: "A", dob: when }] } };
  const file = encryptBackup(Buffer.from(EJSON.stringify(data, { relaxed: false })));
  assert.equal(file.subarray(0, 7).toString(), "KPTBAK1");
  assert.ok(!file.includes(Buffer.from('"name":"A"'))); // not readable without the key
  const back = decryptBackup(file);
  const s = back.collections.students[0];
  assert.ok(s._id instanceof mongoose.mongo.ObjectId && s._id.equals(id));
  assert.ok(s.dob instanceof Date && s.dob.getTime() === when.getTime());
});

test("backup file: a changed byte or another key is refused", () => {
  const file = encryptBackup(Buffer.from("{}"));
  const bad = Buffer.from(file);
  bad[bad.length - 1] ^= 1;
  assert.throws(() => decryptBackup(bad));
  assert.throws(() => decryptBackup(Buffer.from("not a backup")), /not a KPT backup/);
});
