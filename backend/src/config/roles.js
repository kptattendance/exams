// src/config/roles.js
//
// Who does what. One list for the whole backend.
//
//   admin          – user accounts, settings, academic year, mark corrections
//   principal      – sees everything, changes nothing
//   coe            – Controller of Examinations: runs the exams, opens question papers
//   acoe           – Assistant COE: everything the COE does except opening question papers
//   office         – exam section: fee verification, freezing IA and attendance,
//                    subject changes for hall tickets, hall ticket printing,
//                    marking absentees, paper-setter orders
//   exam_clerk     – types the valuers' award lists (sees dummy numbers only)
//   qp_scrutinizer – scrutinises the submitted question papers
//   chief_examiner – on the exam date only, opens and prints the frozen question paper
//   hod            – department: IA, attendance, electives, practical batches
//   evening_principal – evening college (register numbers 186…): does for all
//                    evening students what a HOD does (services/evening.js)
//   staff          – faculty: question paper setting, practical marks
//
// Students sign in too (role "student", set when they are imported): they see
// only their own details (/api/students/me); the server refuses everything else.

export const ROLE_LABELS = {
  admin: "Administrator",
  principal: "Principal",
  coe: "Controller of Examinations",
  acoe: "Assistant COE",
  office: "Exam section (office)",
  exam_clerk: "Exam clerk",
  qp_scrutinizer: "QP scrutiniser",
  chief_examiner: "Chief Examiner",
  hod: "Head of Department",
  evening_principal: "Evening Principal",
  staff: "Faculty",
};

export const ROLES = Object.keys(ROLE_LABELS);

// Old role names still found on some accounts
const LEGACY = { exam_officer: "office" };
export const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  return LEGACY[r] || r || null;
};

