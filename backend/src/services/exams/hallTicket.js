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

import { paperTimes } from "../examDay.js";
import { effectiveOf, subjectFeePaid, isIncomplete, bySyllabus } from "./rules.js";

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

export const AUDIT_NOTE = "No semester-end exam – audit course";
// an audit course the student is not eligible for: struck out, in red
const AUDIT_BLOCKED = {
  NE: "Not eligible – IA below minimum",
  ANS: "Not eligible – attendance shortage",
};

export function ticketFor(reg, { entries = [], sessions = {}, published = false } = {}) {
  const slot = new Map(entries.map((e) => [e.code, e]));
  const reasons = [];

  // audit courses: internal test only – no exam. Shown on the hall ticket in
  // their place with "no end exam"; struck out in red only when the student is
  // NE / ANS in it. They never count as "not permitted" and never stop the
  // hall ticket from being ready.
  const audits = (reg.subjects || [])
    .filter((s) => s.kind === "AUDIT")
    .map((s) => ({ s, blockedAs: AUDIT_BLOCKED[effectiveOf(s)] || "" }))
    .map(({ s, blockedAs }) => ({
      code: s.code,
      name: s.name,
      semester: s.semester,
      kind: s.kind,
      sequence: s.sequence ?? null,
      audit: true,
      practicalOnly: false,
      date: "",
      session: "",
      time: "",
      permitted: false,
      blocked: Boolean(blockedAs),
      note: blockedAs || AUDIT_NOTE,
    }));
  const subjects = (reg.subjects || []).filter((s) => s.kind !== "AUDIT").map((s) => {
    const eff = effectiveOf(s);
    const feePaid = subjectFeePaid(reg, s);
    const e = s.hasTheory ? slot.get(s.code) : null;
    let note = "";
    if (eff !== "ELIGIBLE") note = NOT_PERMITTED[eff] || NOT_PERMITTED.PENDING;
    else if (!feePaid) note = NOT_PERMITTED.FEE;
    const sess = e ? paperTimes(e, sessions) : null; // a drawing paper is an hour longer
    return {
      code: s.code,
      name: s.name,
      semester: s.semester,
      kind: s.kind,
      sequence: s.sequence ?? null,
      practicalOnly: !s.hasTheory,
      date: e?.date || "",
      session: e?.session || "",
      time: sess ? `${to12(sess.start)} – ${to12(sess.end)}` : "",
      permitted: !note,
      note,
    };
  });


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
    // the syllabus order, as everywhere else
    subjects: bySyllabus([...subjects, ...audits]),
    permittedCount: permitted.length,
  };
}
