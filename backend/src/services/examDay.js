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

// entry: { date, session: "FN" | "AN" }, sessions: { FN: { start, end }, AN: { … } }
export function printWindow(entry, sessions) {
  const s = sessions?.[entry.session] || { start: entry.session === "AN" ? "14:00" : "10:00", end: entry.session === "AN" ? "17:00" : "13:00" };
  const startsAt = atIST(entry.date, s.start);
  return {
    opensAt: new Date(startsAt.getTime() - OPEN_BEFORE_MINUTES * 60 * 1000),
    startsAt,
    closesAt: atIST(entry.date, s.end),
  };
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
