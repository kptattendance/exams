// src/services/examDay.js
//
// When a frozen question paper may be opened and printed by the Chief
// Examiner: on the exam date only, from 1 hour before the session starts
// until the session ends (times from the published exam time table, IST).
// Every printed copy is stamped with who printed it and when.
// Unit-tested in test/examDay.test.js.

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export const IST = "Asia/Kolkata";
export const OPEN_BEFORE_MINUTES = 60;

// "2026-11-16" (today in India)
export const todayIST = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: IST });

export const atIST = (date, hhmm) => new Date(`${date}T${hhmm}:00+05:30`);

// The paper-setting session of an exam date: Oct–Jan -> "NOV-<year>", Feb–Sep -> "MAY-<year>"
export function sessionOfDate(date) {
  const [y, m] = String(date).split("-").map(Number);
  if (m >= 10) return `NOV-${y}`;
  if (m === 1) return `NOV-${y - 1}`;
  return `MAY-${y}`;
}

// Written exam: morning 9–12, afternoon 2–5 (the exam's own times when set).
// A drawing paper gets one hour more: the morning one ends an hour later
// (9–1), the afternoon one starts an hour earlier (1–5).
export const DEFAULT_SESSIONS = { FN: { start: "09:00", end: "12:00" }, AN: { start: "14:00", end: "17:00" } };
export const DRAWING_EXTRA_MINUTES = 60;
const shift = (hhmm, minutes) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
// entry: { session: "FN" | "AN", drawing } -> { start, end } ("09:00")
export function paperTimes(entry, sessions) {
  const s = sessions?.[entry.session]?.start ? sessions[entry.session] : DEFAULT_SESSIONS[entry.session] || DEFAULT_SESSIONS.FN;
  if (!entry.drawing) return { start: s.start, end: s.end };
  return entry.session === "AN" ? { start: shift(s.start, -DRAWING_EXTRA_MINUTES), end: s.end } : { start: s.start, end: shift(s.end, DRAWING_EXTRA_MINUTES) };
}

// entry: { date, session: "FN" | "AN", drawing }, sessions: { FN: { start, end }, AN: { … } }
export function printWindow(entry, sessions) {
  const s = paperTimes(entry, sessions);
  const startsAt = atIST(entry.date, s.start);
  return {
    opensAt: new Date(startsAt.getTime() - OPEN_BEFORE_MINUTES * 60 * 1000),
    startsAt,
    closesAt: atIST(entry.date, s.end),
  };
}

// The Chief Examiner marks absentees from 30 minutes after the session starts
// (once the absent lists come from the rooms) until the session ends.
export const ABSENT_AFTER_MINUTES = 30;
export function absentWindow(entry, sessions) {
  const w = printWindow(entry, sessions);
  return { opensAt: new Date(w.startsAt.getTime() + ABSENT_AFTER_MINUTES * 60 * 1000), startsAt: w.startsAt, closesAt: w.closesAt };
}

// "BEFORE" | "OPEN" | "CLOSED"
export function windowState(w, now = new Date()) {
  if (now < w.opensAt) return "BEFORE";
  if (now > w.closesAt) return "CLOSED";
  return "OPEN";
}

const ascii = (t) => String(t).replace(/[^\x20-\x7E]/g, "?"); // the standard PDF font is Latin only

// Stamp every page: a line at the foot and a faint diagonal mark
export async function stampPdf(buffer, footer, mark) {
  const pdf = await PDFDocument.load(buffer);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    page.drawText(ascii(footer), { x: 24, y: 10, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(ascii(mark), {
      x: width * 0.18,
      y: height * 0.3,
      size: 30,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.12,
      rotate: degrees(35),
    });
  }
  return Buffer.from(await pdf.save());
}
