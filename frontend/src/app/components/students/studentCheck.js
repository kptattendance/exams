// Every detail of a student, in one list – used by the HOD's students page
// (on screen) and its Excel, so that the HOD and the students can check them.
// Aadhaar is always masked (only the last 4 digits) because the Excel is shared.

const ADMISSION = {
  regular: "Regular",
  "lateral-puc": "Lateral (PUC)",
  "lateral-iti": "Lateral (ITI)",
  "lateral-iti-cross": "Lateral (ITI, other branch)",
};

const dmy = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
};
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");
export const maskAadhaar = (a) => {
  const digits = String(a || "").replace(/\D/g, "");
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "";
};

const phoneOk = (v) => /^\d{10}$/.test(String(v || "").replace(/[\s-]/g, "").replace(/^(\+91|91)(?=\d{10}$)/, ""));
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));

// key, label, value (as shown), required (empty = missing), check (wrong format)
export const STUDENT_FIELDS = [
  { key: "registerNumber", label: "Register No.", value: (s) => s.registerNumber, required: true },
  { key: "rollNumber", label: "Roll No.", value: (s) => s.rollNumber, required: true },
  { key: "name", label: "Student name", value: (s) => s.name, required: true },
  { key: "fatherName", label: "Father's name", value: (s) => s.fatherName, required: true },
  { key: "motherName", label: "Mother's name", value: (s) => s.motherName, required: true },
  { key: "dob", label: "Date of birth", value: (s) => dmy(s.dob), required: true },
  { key: "gender", label: "Gender", value: (s) => cap(s.gender), required: true },
  { key: "phone", label: "Phone", value: (s) => s.phone, required: true, check: (s) => (phoneOk(s.phone) ? "" : "Phone must be 10 digits") },
  { key: "parentPhone", label: "Parent phone", value: (s) => s.parentPhone, required: true, check: (s) => (phoneOk(s.parentPhone) ? "" : "Parent phone must be 10 digits") },
  { key: "email", label: "Email", value: (s) => s.email, required: true, check: (s) => (emailOk(s.email) ? "" : "Email looks wrong") },
  { key: "category", label: "Category", value: (s) => s.category, required: true },
  { key: "caste", label: "Caste", value: (s) => s.caste },
  { key: "satsNumber", label: "SATS No.", value: (s) => s.satsNumber, required: true },
  { key: "aadhaar", label: "Aadhaar (last 4)", value: (s) => maskAadhaar(s.aadhaarNumber), required: true },
  { key: "admissionType", label: "Admission type", value: (s) => ADMISSION[s.admissionType] || cap(s.admissionType) },
  { key: "admissionYear", label: "Admission year", value: (s) => s.admissionYear, required: true },
  { key: "batch", label: "Batch", value: (s) => s.batch },
  { key: "batchNumber", label: "Batch No.", value: (s) => s.batchNumber, required: true },
  { key: "semester", label: "Semester", value: (s) => s.semester, required: true },
  { key: "status", label: "Status", value: (s) => cap(s.status || "active") },
];

const empty = (v) => v === undefined || v === null || String(v).trim() === "";

// { [key]: "missing" | "<what looks wrong>" } for one student
export function problemsOf(s) {
  const out = {};
  for (const f of STUDENT_FIELDS) {
    const v = f.value(s);
    if (empty(v)) {
      if (f.required) out[f.key] = "missing";
    } else if (f.check) {
      const msg = f.check(s);
      if (msg) out[f.key] = msg;
    }
  }
  return out;
}
