// src/services/studentImport/rules.js
//
// Pure functions (no database) for the 1st-year student Excel import:
//   - reading the office Excel's columns (any order, flexible header names)
//   - cleaning and validating each row
//   - working out the register number for each student
//
// Register number = COLLEGE + DEPT + YY + SERIAL
//   103 AT 26 001
//   Regular              -> 001..299   (YY = admission year)
//   Lateral, ITI same    -> 301..399   (YY = joining year)
//   Lateral, ITI cross   -> 401..499   (YY = joining year)
//   Lateral, PUC         -> 701..999   (YY = joining year)

export const COLLEGE_CODE = process.env.COLLEGE_CODE || "103";

export const DEPARTMENTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];

export const ADMISSION_TYPES = {
  regular: { label: "Regular", start: 1, end: 299, semester: 1 },
  "lateral-iti": { label: "Lateral (ITI, same course)", start: 301, end: 399, semester: 3 },
  "lateral-iti-cross": { label: "Lateral (ITI, cross course)", start: 401, end: 499, semester: 3 },
  "lateral-puc": { label: "Lateral (PUC)", start: 701, end: 999, semester: 3 },
};

// ------------------------------------------------------------------ headers

const HEADER_KEYS = [
  ["rollNumber", ["rollnumber", "rollno", "roll"]],
  ["registerNumberGiven", ["registernumber", "regno", "registerno"]],
  ["name", ["studentname", "name", "nameofthestudent"]],
  ["fatherName", ["fathername", "fathersname"]],
  ["motherName", ["mothername", "mothersname"]],
  ["dob", ["dob", "dateofbirth"]],
  ["gender", ["gender", "sex"]],
  ["email", ["emailid", "email", "emailaddress", "mailid"]],
  ["phone", ["phonenumber", "phone", "mobile", "mobilenumber", "studentphone"]],
  ["parentPhone", ["parentphone", "parentmobile", "parentphonenumber", "guardianphone"]],
  ["caste", ["caste"]],
  ["category", ["category"]],
  ["aadhaar", ["aadhaarnumber", "aadharnumber", "aadhaar", "aadhar"]],
  ["department", ["course", "department", "branch", "program", "dept"]],
  ["admissionYear", ["admissionyear", "yearofadmission"]],
  ["batch", ["batch", "academicyear"]],
  ["batchNumber", ["batchnumber", "batchno"]],
  ["semester", ["semester", "sem"]],
  ["status", ["status"]],
  ["admissionType", ["admissiontype", "typeofadmission", "entrytype"]],
  ["satsNumber", ["satsnumber", "sats", "satsno"]],
];

const squash = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Maps each Excel header to our field name. Unknown headers are ignored. */
export function mapHeaders(headers) {
  const map = {};
  const missing = [];
  for (const h of headers) {
    const sq = squash(h);
    if (!sq) continue;
    // Photo column has a long descriptive header in the office sheet
    if (sq.startsWith("studentphoto") || sq === "photo" || sq.includes("photo")) {
      map[h] = "photo";
      continue;
    }
    const hit = HEADER_KEYS.find(([, alts]) => alts.includes(sq));
    if (hit) map[h] = hit[0];
  }
  const found = new Set(Object.values(map));
  for (const req of ["rollNumber", "name", "email", "department", "admissionYear", "admissionType"]) {
    if (!found.has(req)) missing.push(req);
  }
  return { map, missing };
}

// --------------------------------------------------------------- cleaning

const text = (v) => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

/** Excel can give numbers like 9901024445 or 9.9e9 – keep digits only. */
const digits = (v) => {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return Math.round(v).toString();
  return String(v).replace(/\D/g, "");
};

export function parseDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 1000 && v < 80000) {
    // Excel serial date
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  const s = text(v);
  if (!s) return null;
  // dd-mm-yyyy or dd/mm/yyyy or dd.mm.yyyy
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  // yyyy-mm-dd (optionally with time)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

export function normalizeAdmissionType(v) {
  const s = squash(v);
  if (!s || s === "regular" || s === "reg") return s ? "regular" : "";
  if (s.includes("cross")) return "lateral-iti-cross";
  if (s.includes("iti")) return "lateral-iti";
  if (s.includes("pu")) return "lateral-puc"; // lateralpu, latpu, lateralpuc, puc
  return "invalid";
}

const normalizeGender = (v) => {
  const s = squash(v);
  if (["m", "male", "boy"].includes(s)) return "male";
  if (["f", "female", "girl"].includes(s)) return "female";
  if (["o", "other", "others", "transgender"].includes(s)) return "other";
  return s ? "invalid" : "";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function getDriveFileId(url) {
  const v = text(url);
  if (!v) return null;
  const a = v.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (a) return a[1];
  const b = v.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return b ? b[1] : null;
}

/**
 * Turns one Excel row (object keyed by original headers) into a clean
 * student record + list of problems. Problems with level "error" block
 * the row; "warning" rows are imported but flagged.
 */
export function cleanRow(raw, headerMap, rowNumber) {
  const r = {};
  for (const [header, key] of Object.entries(headerMap)) r[key] = raw[header];

  const s = {
    rowNumber,
    rollNumber: text(r.rollNumber).toUpperCase(),
    name: text(r.name).toUpperCase(),
    fatherName: text(r.fatherName).toUpperCase(),
    motherName: text(r.motherName).toUpperCase(),
    dob: parseDate(r.dob),
    gender: normalizeGender(r.gender),
    email: String(r.email ?? "").replace(/\s+/g, "").toLowerCase(),
    phone: digits(r.phone).slice(-10),
    parentPhone: digits(r.parentPhone).slice(-10),
    caste: text(r.caste).toUpperCase(),
    category: text(r.category).toUpperCase(),
    aadhaar: digits(r.aadhaar),
    department: text(r.department).toLowerCase(),
    admissionYear: parseInt(digits(r.admissionYear), 10) || null,
    batch: text(r.batch),
    batchNumber: parseInt(digits(r.batchNumber), 10) || null,
    semester: parseInt(digits(r.semester), 10) || null,
    status: text(r.status).toLowerCase() || "active",
    admissionType: normalizeAdmissionType(r.admissionType),
    satsNumber: text(r.satsNumber).toUpperCase(),
    photoUrl: text(r.photo),
  };

  const problems = [];
  const err = (field, message) => problems.push({ level: "error", field, message });
  const warn = (field, message) => problems.push({ level: "warning", field, message });

  if (!s.rollNumber) err("rollNumber", "Roll number is missing.");
  if (!s.name) err("name", "Student name is missing.");
  if (!s.fatherName) err("fatherName", "Father name is missing.");
  if (!s.motherName) err("motherName", "Mother name is missing.");

  if (!s.dob) err("dob", "Date of birth is missing or not a valid date.");
  else {
    const age = (Date.now() - s.dob.getTime()) / (365.25 * 864e5);
    if (age < 13 || age > 40) warn("dob", `Date of birth gives age ${Math.floor(age)} – please check.`);
  }

  if (!s.gender) err("gender", "Gender is missing.");
  else if (s.gender === "invalid") err("gender", "Gender must be male, female or other.");

  if (/\s/.test(text(r.email))) warn("email", "Spaces removed from the email address.");
  if (!s.email) err("email", "Email is missing.");
  else if (!EMAIL_RE.test(s.email)) err("email", "Email address is not valid.");

  if (!s.phone) err("phone", "Phone number is missing.");
  else if (!/^[6-9]\d{9}$/.test(s.phone)) err("phone", "Phone number must be a 10-digit mobile number.");
  if (s.parentPhone && !/^[6-9]\d{9}$/.test(s.parentPhone)) warn("parentPhone", "Parent phone does not look like a 10-digit mobile number.");
  if (!s.parentPhone) warn("parentPhone", "Parent phone is missing.");

  if (!s.aadhaar) warn("aadhaar", "Aadhaar number is missing.");
  else if (!/^[2-9]\d{11}$/.test(s.aadhaar)) err("aadhaar", "Aadhaar number must be 12 digits.");

  if (!s.department) err("department", "Course / department is missing.");
  else if (!DEPARTMENTS.includes(s.department)) err("department", `Unknown department "${s.department}".`);

  const thisYear = new Date().getFullYear();
  if (!s.admissionYear) err("admissionYear", "Admission year is missing.");
  else if (s.admissionYear < 2000 || s.admissionYear > thisYear + 1) err("admissionYear", "Admission year looks wrong.");

  if (!s.batch) err("batch", "Batch (e.g. 2026-2027) is missing.");
  if (![1, 2].includes(s.batchNumber)) err("batchNumber", "Batch number must be 1 or 2.");

  if (!s.admissionType) err("admissionType", "Admission type is missing.");
  else if (s.admissionType === "invalid")
    err("admissionType", "Admission type must be regular, lateral-puc, lateral-iti or lateral-iti-cross.");
  else {
    const expectedSem = ADMISSION_TYPES[s.admissionType].semester;
    if (!s.semester) s.semester = expectedSem;
    else if (s.semester !== expectedSem)
      err("semester", `${ADMISSION_TYPES[s.admissionType].label} students must start in semester ${expectedSem}.`);
  }

  if (!["active", "inactive"].includes(s.status)) warn("status", `Status "${s.status}" changed to active.`), (s.status = "active");

  if (!s.photoUrl) warn("photo", "No photo link – upload the photo later.");
  else if (!getDriveFileId(s.photoUrl) && !/^https:\/\//.test(s.photoUrl)) warn("photo", "Photo link is not a valid Google Drive link.");

  return { student: s, problems };
}

// --------------------------------------------------- duplicates in the file

export function findDuplicatesInFile(rows) {
  const seen = { rollNumber: new Map(), email: new Map(), aadhaar: new Map() };
  const labels = { rollNumber: "roll number", email: "email", aadhaar: "Aadhaar number" };
  for (const row of rows) {
    for (const key of Object.keys(seen)) {
      const v = row.student[key];
      if (!v) continue;
      if (seen[key].has(v)) {
        const first = seen[key].get(v);
        row.problems.push({ level: "error", field: key, message: `Same ${labels[key]} as row ${first}.` });
      } else seen[key].set(v, row.student.rowNumber);
    }
  }
}

// ------------------------------------------------------- register numbers

export const seriesKey = (dept, yy, type) => `regno:${dept.toUpperCase()}:${yy}:${type}`;

export function formatRegisterNumber(dept, yy, serial) {
  return `${COLLEGE_CODE}${dept.toUpperCase()}${String(yy).padStart(2, "0")}${String(serial).padStart(3, "0")}`;
}

/** Natural sort so AT26009 < AT26010 */
const naturalCompare = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** Groups valid rows by series, sorted by roll number. */
export function groupBySeries(rows) {
  const groups = new Map();
  for (const row of rows) {
    const s = row.student;
    const yy = s.admissionYear % 100;
    const key = seriesKey(s.department, yy, s.admissionType);
    if (!groups.has(key)) groups.set(key, { key, department: s.department, yy, type: s.admissionType, rows: [] });
    groups.get(key).rows.push(row);
  }
  for (const g of groups.values()) g.rows.sort((a, b) => naturalCompare(a.student.rollNumber, b.student.rollNumber));
  return [...groups.values()];
}

/**
 * Gives every row in each group its register number.
 * lastUsed: { [seriesKey]: last serial already issued (0 if none) }
 * Returns problems if a series would overflow its range.
 */
export function assignRegisterNumbers(groups, lastUsed) {
  for (const g of groups) {
    const range = ADMISSION_TYPES[g.type];
    let next = Math.max(lastUsed[g.key] || 0, range.start - 1) + 1;
    for (const row of g.rows) {
      if (next > range.end) {
        row.problems.push({
          level: "error",
          field: "registerNumber",
          message: `No register numbers left in the ${range.label} series (${range.start}–${range.end}).`,
        });
        row.student.registerNumber = "";
        continue;
      }
      row.student.registerNumber = formatRegisterNumber(g.department, g.yy, next);
      row.student.serial = next;
      next++;
    }
    g.lastSerial = next - 1;
  }
}

/** Highest serial in an existing register number list that falls in this series' range. */
export function highestExistingSerial(registerNumbers, dept, yy, type) {
  const prefix = formatRegisterNumber(dept, yy, 0).slice(0, -3);
  const { start, end } = ADMISSION_TYPES[type];
  let max = 0;
  for (const rn of registerNumbers) {
    if (!rn || !rn.startsWith(prefix)) continue;
    const serial = parseInt(rn.slice(prefix.length), 10);
    if (serial >= start && serial <= end && serial > max) max = serial;
  }
  return max;
}

export const hasErrors = (row) => row.problems.some((p) => p.level === "error");
