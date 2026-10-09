// src/services/exams/hallTicket.js
//
// What goes on a student's hall ticket (pure function, unit-tested).
//
// A subject is PERMITTED when
//   - the student is eligible for it (IA + attendance, or COE override), and
//   - its fee is paid (regular fee for current subjects, own fee for a back paper).
// Every other subject is still printed, struck through, with the reason.
//
// A hall ticket can be printed when the timetable is published, nothing is
// still "waiting" (IA / attendance / elective), and at least one subject is permitted.

import { effectiveOf, subjectFeePaid, isIncomplete } from "./rules.js";

const NOT_PERMITTED = {
  ANS: "Not permitted – attendance shortage",
  NE: "Not permitted – IA below minimum",
  PENDING: "Not permitted – eligibility pending",
  FEE: "Not permitted – fee not paid",
};

const to12 = (t = "") => {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return "";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export function ticketFor(reg, { entries = [], sessions = {}, published = false } = {}) {
  const slot = new Map(entries.map((e) => [e.code, e]));
  const reasons = [];

  const subjects = (reg.subjects || []).map((s) => {
    const eff = effectiveOf(s);
    const feePaid = subjectFeePaid(reg, s);
    const e = s.hasTheory ? slot.get(s.code) : null;
    let note = "";
    if (eff !== "ELIGIBLE") note = NOT_PERMITTED[eff] || NOT_PERMITTED.PENDING;
    else if (!feePaid) note = NOT_PERMITTED.FEE;
    const sess = e ? sessions[e.session] : null;
    return {
      code: s.code,
      name: s.name,
      semester: s.semester,
      kind: s.kind,
      practicalOnly: !s.hasTheory,
      date: e?.date || "",
      session: e?.session || "",
      time: sess ? `${to12(sess.start)} – ${to12(sess.end)}` : "",
      permitted: !note,
      note,
    };
  });

  // written papers by date, practical-only at the end
  subjects.sort(
    (a, b) =>
      Number(a.practicalOnly) - Number(b.practicalOnly) ||
      (a.date || "9").localeCompare(b.date || "9") ||
      a.session.localeCompare(b.session) ||
      a.code.localeCompare(b.code)
  );

  if (!published) reasons.push("Timetable is not published yet.");
  if (reg.overall === "PENDING" || isIncomplete(reg.warnings)) {
    reasons.push(
      isIncomplete(reg.warnings) ? "Elective not chosen yet." : "Eligibility is still waiting for IA / attendance."
    );
  }
  const permitted = subjects.filter((s) => s.permitted);
  if (!permitted.length && reg.overall !== "PENDING") {
    const feeOnly = subjects.some((s) => s.note === NOT_PERMITTED.FEE);
    reasons.push(feeOnly ? "Fee not paid." : "No subject permitted.");
  }
  const missingDate = permitted.filter((s) => !s.practicalOnly && !s.date).map((s) => s.code);
  if (published && missingDate.length) reasons.push(`No exam date for ${missingDate.join(", ")}.`);

  return {
    ready: reasons.length === 0,
    reasons,
    subjects,
    permittedCount: permitted.length,
  };
}
