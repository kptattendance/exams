import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { todayIST, sessionOfDate, printWindow, windowState, stampPdf } from "../src/services/examDay.js";

test("today in India", () => {
  // 20:00 UTC on 15 Nov is already 16 Nov in India
  assert.equal(todayIST(new Date("2026-11-15T20:00:00Z")), "2026-11-16");
});

test("which paper-setting session an exam date belongs to", () => {
  assert.equal(sessionOfDate("2026-11-16"), "NOV-2026");
  assert.equal(sessionOfDate("2026-12-02"), "NOV-2026");
  assert.equal(sessionOfDate("2027-01-05"), "NOV-2026");
  assert.equal(sessionOfDate("2027-05-20"), "MAY-2027");
  assert.equal(sessionOfDate("2027-06-10"), "MAY-2027");
});

test("print window: from 1 hour before the session until it ends", () => {
  const w = printWindow({ date: "2026-11-16", session: "FN" }, { FN: { start: "10:00", end: "13:00" } });
  assert.equal(w.opensAt.toISOString(), "2026-11-16T03:30:00.000Z"); // 09:00 IST
  assert.equal(w.closesAt.toISOString(), "2026-11-16T07:30:00.000Z"); // 13:00 IST
  assert.equal(windowState(w, new Date("2026-11-16T03:29:00Z")), "BEFORE"); // 08:59 IST
  assert.equal(windowState(w, new Date("2026-11-16T03:30:00Z")), "OPEN"); // 09:00 IST
  assert.equal(windowState(w, new Date("2026-11-16T07:31:00Z")), "CLOSED");
  assert.equal(windowState(w, new Date("2026-11-15T04:00:00Z")), "BEFORE"); // the day before
  const an = printWindow({ date: "2026-11-16", session: "AN" }, {});
  assert.equal(an.opensAt.toISOString(), "2026-11-16T07:30:00.000Z"); // 13:00 IST, default 14:00 start
});

test("every page of a printed copy is stamped", async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  const stamped = await stampPdf(Buffer.from(await doc.save()), "Printed by chief@kpt.in · 16-11-2026 09:05 IST · Copy 1", "KPT · CONFIDENTIAL");
  const again = await PDFDocument.load(stamped);
  assert.equal(again.getPageCount(), 2);
  assert.ok(stamped.length > 0);
});

test("absentees: from 30 minutes after the start until the session ends", async () => {
  const { absentWindow } = await import("../src/services/examDay.js");
  const w = absentWindow({ date: "2026-11-16", session: "FN" }, { FN: { start: "10:00", end: "13:00" } });
  assert.equal(windowState(w, new Date("2026-11-16T10:20:00+05:30")), "BEFORE");
  assert.equal(windowState(w, new Date("2026-11-16T10:30:00+05:30")), "OPEN");
  assert.equal(windowState(w, new Date("2026-11-16T12:59:00+05:30")), "OPEN");
  assert.equal(windowState(w, new Date("2026-11-16T13:01:00+05:30")), "CLOSED");
});

test("written paper times: 9–12 / 2–5, a drawing paper one hour more (9–1 / 1–5)", async () => {
  const { paperTimes } = await import("../src/services/examDay.js");
  assert.deepEqual(paperTimes({ session: "FN" }, {}), { start: "09:00", end: "12:00" });
  assert.deepEqual(paperTimes({ session: "AN" }, {}), { start: "14:00", end: "17:00" });
  assert.deepEqual(paperTimes({ session: "FN", drawing: true }, {}), { start: "09:00", end: "13:00" });
  assert.deepEqual(paperTimes({ session: "AN", drawing: true }, {}), { start: "13:00", end: "17:00" });
  // the exam's own session times are used when set
  assert.deepEqual(paperTimes({ session: "FN", drawing: true }, { FN: { start: "10:00", end: "13:00" } }), { start: "10:00", end: "14:00" });
});
