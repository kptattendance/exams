import test from "node:test";
import assert from "node:assert/strict";

import Exam from "../src/models/Exam.js";
import AuditLog from "../src/models/AuditLog.js";
import { lockedExamGuard } from "../src/services/examLock.js";

const ID = "6aebbcc752652869b9a5240e";
const published = { _id: ID, name: "Nov/Dec 2026", results: { publishedAt: new Date("2027-01-10") } };
const open = { _id: ID, name: "Nov/Dec 2026", results: {} };
let current = published;
Exam.findById = () => ({ select: () => ({ lean: async () => current }) });
AuditLog.create = async () => ({});

async function run({ method = "POST", role = "coe", reason = "", exam = published } = {}) {
  current = exam;
  const req = { method, user: { id: "u1", role }, headers: reason ? { "x-unlock-reason": encodeURIComponent(reason) } : {}, originalUrl: `/api/exams/${ID}/fees/mark-paid`, socket: {} };
  const out = { status: 200, body: null, next: false };
  const res = { status: (s) => ((out.status = s), res), json: (b) => ((out.body = b), res) };
  await lockedExamGuard(() => ID)(req, res, () => (out.next = true));
  return out;
}

test("a published examination is locked for changes", async () => {
  const r = await run({ role: "office" });
  assert.equal(r.status, 423);
  assert.equal(r.next, false);
  assert.match(r.body.error, /locked/);
  assert.equal((await run({ role: "coe" })).status, 423);
});

test("reading a locked examination still works, and an unpublished one is open", async () => {
  assert.equal((await run({ method: "GET", role: "office" })).next, true);
  assert.equal((await run({ role: "office", exam: open })).next, true);
});

test("the Admin must give a reason, then a code", async () => {
  const noReason = await run({ role: "admin" });
  assert.equal(noReason.status, 423);
  assert.equal(noReason.body.needReason, true);
  const noCode = await run({ role: "admin", reason: "Revaluation order 12/2027" });
  assert.equal(noCode.status, 428); // the verification code is asked
  assert.equal(noCode.body.stepUp.scope, "unlock");
  process.env.STEP_UP_DISABLED = "true";
  const ok = await run({ role: "admin", reason: "ಮರುಮೌಲ್ಯಮಾಪನ ಆದೇಶ" }); // a Kannada reason works
  delete process.env.STEP_UP_DISABLED;
  assert.equal(ok.next, true);
});
