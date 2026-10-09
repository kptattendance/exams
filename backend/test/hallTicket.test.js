import test from "node:test";
import assert from "node:assert/strict";

import { ticketFor } from "../src/services/exams/hallTicket.js";

const tt = {
  published: true,
  sessions: { FN: { start: "10:00", end: "13:00" }, AN: { start: "14:00", end: "17:00" } },
  entries: [
    { code: "R1", date: "2026-11-18", session: "FN" },
    { code: "R2", date: "2026-11-16", session: "AN" },
    { code: "B1", date: "2026-11-17", session: "FN" },
  ],
};
const s = (code, extra = {}) => ({ code, name: code, kind: "REGULAR", hasTheory: true, status: "ELIGIBLE", ...extra });

test("permitted subjects with date and time, sorted; practical at the end", () => {
  const t = ticketFor({ overall: "ALL_CLEAR", regularFee: { paid: true }, subjects: [s("R1"), s("LAB", { hasTheory: false }), s("R2")] }, tt);
  assert.equal(t.ready, true);
  assert.deepEqual(t.subjects.map((x) => x.code), ["R2", "R1", "LAB"]);
  assert.equal(t.subjects[0].time, "2:00 PM – 5:00 PM");
  assert.equal(t.subjects[2].practicalOnly, true);
});

test("ANS / NE / unpaid back paper are printed but not permitted", () => {
  const t = ticketFor(
    {
      overall: "PARTIAL",
      regularFee: { paid: true },
      subjects: [s("R1", { status: "ANS" }), s("R2", { status: "ANS", override: { status: "ELIGIBLE" } }), s("B1", { kind: "BACKLOG", fee: { paid: false } })],
    },
    tt
  );
  assert.equal(t.ready, true);
  const by = Object.fromEntries(t.subjects.map((x) => [x.code, x]));
  assert.match(by.R1.note, /attendance/);
  assert.equal(by.R2.permitted, true);
  assert.match(by.B1.note, /fee not paid/);
});

test("not ready: unpublished timetable, waiting eligibility, nothing permitted", () => {
  assert.match(ticketFor({ overall: "ALL_CLEAR", regularFee: { paid: true }, subjects: [s("R1")] }, { ...tt, published: false }).reasons[0], /not published/);
  assert.match(ticketFor({ overall: "PENDING", subjects: [s("R1", { status: "PENDING" })] }, tt).reasons[0], /waiting/);
  assert.equal(ticketFor({ overall: "ALL_CLEAR", regularFee: { paid: false }, subjects: [s("R1")] }, tt).reasons[0], "Fee not paid.");
  assert.match(
    ticketFor({ overall: "ALL_CLEAR", regularFee: { paid: true }, warnings: ["Elective not chosen for group E1 (HOD to set)."], subjects: [s("R1")] }, tt).reasons[0],
    /Elective/
  );
});
