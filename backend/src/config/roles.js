// src/config/roles.js
//
// Who does what. One list for the whole backend.
//
//   admin          – user accounts, settings, academic year, mark corrections
//   principal      – sees everything, changes nothing
//   vice_principal – same as the principal
//   coe            – Controller of Examinations: runs the exams, opens question papers
//   acoe           – Assistant COE: everything the COE does except opening question papers
//   office         – exam section: fee verification, freezing IA and attendance,
//                    subject changes for hall tickets, hall ticket printing,
//                    marking absentees, paper-setter orders
//   exam_clerk     – types the valuers' award lists (sees dummy numbers only)
//   qp_scrutinizer – scrutinises the submitted question papers
//   hod            – department: IA, attendance, electives, practical batches
//   staff          – faculty: question paper setting, practical marks
//   guest_lecturer – same work as faculty
//
// Students do not sign in; results are looked up publicly.

export const ROLE_LABELS = {
  admin: "Administrator",
  principal: "Principal",
  vice_principal: "Vice-Principal",
  coe: "Controller of Examinations",
  acoe: "Assistant COE",
  office: "Exam section (office)",
  exam_clerk: "Exam clerk",
  qp_scrutinizer: "QP scrutiniser",
  hod: "Head of Department",
  staff: "Faculty",
  guest_lecturer: "Guest Lecturer",
};

export const ROLES = Object.keys(ROLE_LABELS);

// Old role names still found on some accounts
const LEGACY = { exam_officer: "office" };
export const normalizeRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  return LEGACY[r] || r || null;
};

// Roles that teach: may set question papers and be practical examiners
export const FACULTY_ROLES = ["staff", "guest_lecturer", "hod"];
// Read-only heads of the institution
export const HEAD_ROLES = ["principal", "vice_principal"];
