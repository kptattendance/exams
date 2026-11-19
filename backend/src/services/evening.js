// src/services/evening.js
//
// Evening college (2nd shift, working students). Same college, same subjects
// and the same combined theory exams; register numbers start with 186.
// One Evening Principal does for ALL evening students (EE and ME) what a HOD
// does for his department: students, Final IA, Final attendance, electives,
// exam fee list. Day HODs see only day students.
//
// asHodScope (route middleware, after authenticateUser) makes the existing
// HOD code work for both:
//   Evening Principal → acts as HOD of the department chosen on his pages
//                       (X-Department header or ?department=), evening only
//   HOD               → his own department, day students only
// The controllers then add studentShift(req) to student queries and
// sheetShift(req) / shiftQuery(req) to the IA / attendance sheets.

import { COLLEGE_CODE, EVENING_CODE } from "./studentImport/rules.js";

export const EVENING_ROLE = "evening_principal";
export const EVENING_DEPARTMENTS = String(process.env.EVENING_DEPARTMENTS || "ee,me")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// Working professionals (KPT 3.3): the "51 and up" lateral series 351–399, 451–499, 751–999.
// They are evening (second-shift) students whether their number starts with 186 or,
// as now, with 103 (e.g. 103ME26451) – never day students.
const WORKING_SERIES = "(35[1-9]|3[6-9]\\d|45[1-9]|4[6-9]\\d|75[1-9]|7[6-9]\\d|[89]\\d\\d)";

// Evening: every 186 number, and a 103 number in the working-professional series
export const EVENING_RX = new RegExp(`^(?:${EVENING_CODE}|${COLLEGE_CODE}[A-Z]{2}\\d{2}${WORKING_SERIES}$)`, "i");
export const isEvening = (registerNumber) => EVENING_RX.test(String(registerNumber || "").trim());
export const shiftOf = (registerNumber) => (isEvening(registerNumber) ? "EVENING" : "DAY");

export function asHodScope(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === EVENING_ROLE) {
    const asked = String(req.headers["x-department"] || req.query?.department || req.body?.department || "").toLowerCase();
    const department = EVENING_DEPARTMENTS.includes(asked) ? asked : EVENING_DEPARTMENTS[0];
    req.user = { ...req.user, role: "hod", department, evening: true, realRole: EVENING_ROLE };
  } else if (role === "hod") {
    req.user = { ...req.user, evening: false };
  }
  next();
}

// Only for a HOD-scoped request: evening students for the Evening Principal,
// day students for a HOD; nothing for everyone else
export function studentShift(req) {
  if (req.user?.role !== "hod") return {};
  return req.user.evening ? { registerNumber: EVENING_RX } : { registerNumber: { $not: EVENING_RX } };
}

// Which IA / attendance sheet: the evening one or the day one
export const sheetShift = (req) => (req.user?.evening ? "EVENING" : "DAY");
// Query part for that sheet (sheets saved before this have no shift = day).
// Other roles (COE, Exam Officer) may ask with ?shift=EVENING|DAY; without
// it they are not limited.
export function shiftQuery(req) {
  const asked = String(req.query?.shift || req.body?.shift || "").toUpperCase();
  const evening = req.user?.role === "hod" ? Boolean(req.user.evening) : asked === "EVENING" ? true : asked === "DAY" ? false : null;
  if (evening === null) return {};
  return evening ? { shift: "EVENING" } : { shift: { $ne: "EVENING" } };
}
// Working professionals (KPT 3.3) are evening (186) students in the "51 and
// up" lateral series: 351–399 (ITI), 451–499 (ITI, other trade), 751–999
// (PUC). 301–350, 401–450, 701–750 are evening-shift laterals; 001–299 regular.
export const WORKING_RX = new RegExp(`^(?:${EVENING_CODE}|${COLLEGE_CODE})[A-Z]{2}\\d{2}${WORKING_SERIES}$`, "i");
export const isWorkingProfessional = (registerNumber) => WORKING_RX.test(String(registerNumber || "").trim());

// COE / office / Admin lists: ?college=DAY (103…, not working professionals),
// EVENING (186, evening shift), WORKING (working professionals, 186 or 103); anything else = all.
// A HOD / Evening Principal is already limited (studentShift).
export function collegeFilter(query) {
  const c = String(query?.college || "").toUpperCase();
  if (c === "EVENING") return { registerNumber: { $regex: EVENING_RX, $not: WORKING_RX } };
  if (c === "WORKING") return { registerNumber: WORKING_RX };
  if (c === "DAY") return { registerNumber: { $not: EVENING_RX } };
  return {};
}

export const shiftOfSheet = (doc) => (doc?.shift === "EVENING" ? "EVENING" : "DAY");
