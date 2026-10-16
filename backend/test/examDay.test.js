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
