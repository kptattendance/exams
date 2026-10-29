// scripts/restoreBackup.js – open a .kptbak backup and (optionally) restore it.
//
// Needs the same key as when the backup was made (BACKUP_KEY, else
// STUDENT_DATA_KEY / PAPER_MASTER_KEY) in backend/.env.
//
//   1. See what is inside (changes nothing):
//        node --env-file=.env scripts/restoreBackup.js kpt-backup-20261029-2015.kptbak
//
//   2. Restore into an EMPTY database (e.g. a new Atlas cluster or a test database):
//        node --env-file=.env scripts/restoreBackup.js <file> --to "mongodb+srv://…" --db kptexams_restore
//
//      It refuses a database that already has data. Only if you are sure
//      (the live data is damaged) add --replace: every collection in the backup
//      is emptied in the target and filled from the backup.

import fs from "fs";
import mongoose from "mongoose";

import { decryptBackup } from "../src/services/backup.js";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !["--to", "--db"].includes(args[args.indexOf(a) - 1]));
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : "");
const to = opt("--to");
const dbName = opt("--db");
const replace = args.includes("--replace");

if (!file) {
  console.log("Usage: node --env-file=.env scripts/restoreBackup.js <file.kptbak> [--to <mongodb-uri> --db <name>] [--replace]");
  process.exit(1);
}

const backup = decryptBackup(fs.readFileSync(file));
const { meta, collections } = backup;
console.log(`Backup of "${meta.database}" made ${meta.createdAt} by ${meta.by || "?"}${meta.reason ? ` (${meta.reason})` : ""}`);
let total = 0;
for (const [name, docs] of Object.entries(collections)) {
  console.log(`  ${name.padEnd(28)} ${String(docs.length).padStart(7)}`);
  total += docs.length;
}
console.log(`  ${"TOTAL".padEnd(28)} ${String(total).padStart(7)}`);

if (!to) {
  console.log("\nNothing restored (add --to <mongodb-uri> --db <name> to restore).");
  process.exit(0);
}

await mongoose.connect(to, dbName ? { dbName } : {});
const db = mongoose.connection.db;
const existing = [];
for (const name of Object.keys(collections)) {
  const n = await db.collection(name).estimatedDocumentCount().catch(() => 0);
  if (n) existing.push(`${name} (${n})`);
}
if (existing.length && !replace) {
  console.log(`\nThe target database "${db.databaseName}" already has data: ${existing.join(", ")}.`);
  console.log("Nothing restored. Use an empty database, or add --replace if you really want to overwrite it.");
  await mongoose.disconnect();
  process.exit(1);
}
for (const [name, docs] of Object.entries(collections)) {
  if (replace) await db.collection(name).deleteMany({});
  if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
  console.log(`  restored ${name}: ${docs.length}`);
}
console.log(`\nDone – ${total} records restored into "${db.databaseName}". Indexes are created again when the website starts.`);
await mongoose.disconnect();
