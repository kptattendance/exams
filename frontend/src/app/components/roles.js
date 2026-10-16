// Who does what – keep in step with backend src/config/roles.js.
// Faculty (staff) accounts are added on the Staff / Faculty page.

export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator", does: "User accounts, settings, academic year, mark corrections" },
  { value: "principal", label: "Principal", does: "Sees everything, changes nothing" },
  { value: "vice_principal", label: "Vice-Principal", does: "Sees everything, changes nothing" },
  { value: "coe", label: "COE", does: "Runs the examinations, opens question papers" },
  { value: "acoe", label: "Assistant COE", does: "Everything the COE does except opening question papers" },
  {
    value: "office",
    label: "Exam section (office)",
    does: "Fees, freezing IA and attendance, hall-ticket subjects and printing, absentees, paper-setter orders",
  },
  { value: "exam_clerk", label: "Exam clerk", does: "Types the valuers' award lists" },
  { value: "qp_scrutinizer", label: "QP scrutiniser", does: "Scrutinises the submitted question papers" },
  { value: "hod", label: "HOD", does: "Department IA, attendance, electives, practical batches" },
  { value: "guest_lecturer", label: "Guest Lecturer", does: "Same work as faculty: paper setting, practical marks" },
];

// Alphabetical in every drop-down
ROLE_OPTIONS.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));

const LABELS = { ...Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])), staff: "Faculty", exam_officer: "Exam section (office)" };
export const roleLabel = (role) => LABELS[role] || role || "Not assigned";

// Roles that can be added from the Faculty pages – alphabetical
export const STAFF_ROLE_OPTIONS = [
  { value: "staff", label: "Faculty" },
  { value: "guest_lecturer", label: "Guest Lecturer" },
  { value: "hod", label: "HOD" },
  { value: "principal", label: "Principal" },
  { value: "vice_principal", label: "Vice-Principal" },
];
export const STAFF_ROLE_VALUES = STAFF_ROLE_OPTIONS.map((r) => r.value);
