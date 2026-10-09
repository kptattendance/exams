// src/services/exams/rules.js
//
// Pure functions (no database) that decide:
//   - which subjects a student is registered for in an exam
//   - whether he may write each subject (ELIGIBLE / ANS / NE / PENDING)
// Kept separate so they can be unit-tested: test/examRules.test.js

export const LATERAL_TYPES = ["lateral-puc", "lateral-iti", "lateral-iti-cross"];

export const ADMISSION_LABEL = {
  regular: "Regular",
  "lateral-puc": "Lateral (PUC)",
  "lateral-iti": "Lateral (ITI, same course)",
  "lateral-iti-cross": "Lateral (ITI, cross course)",
};

// "PUC; ITI" / ["lateral-iti-cross"] -> ["lateral-puc", "lateral-iti"]
const TYPE_ALIASES = {
  puc: "lateral-puc",
  "lateral-puc": "lateral-puc",
  iti: "lateral-iti",
  "iti-same": "lateral-iti",
  "lateral-iti": "lateral-iti",
  "iti-cross": "lateral-iti-cross",
  cross: "lateral-iti-cross",
  "lateral-iti-cross": "lateral-iti-cross",
};

export function normalizeAdmissionTypes(input) {
  if (input === undefined || input === null || input === "") return [];
  const parts = Array.isArray(input) ? input : String(input).split(/[;,|/]/);
  const out = new Set();
  for (const p of parts) {
    const key = String(p).trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (!key) continue;
    if (key === "all" || key === "all-laterals") {
      LATERAL_TYPES.forEach((t) => out.add(t));
      continue;
    }
    const t = TYPE_ALIASES[key];
    if (!t) throw new Error(`Unknown admission type "${p}". Use PUC, ITI or ITI-CROSS.`);
    out.add(t);
  }
  return LATERAL_TYPES.filter((t) => out.has(t));
}

export const batchStartYear = (student) => {
  const m = /^(\d{4})-\d{4}$/.exec(student?.batch || "");
  if (m) return Number(m[1]);
  if (!student?.admissionYear) return null;
  return student.admissionType === "regular" || !student.admissionType
    ? student.admissionYear
    : student.admissionYear - 1;
};

// A department/semester may have subjects from more than one scheme
// (e.g. the 2025 scheme for new batches, an older one for seniors).
// A class follows the newest scheme that started on or before its batch.
export function pickScheme(subjects, startYear) {
  const years = [...new Set(subjects.map((s) => s.schemeYear || 0))].sort((a, b) => a - b);
  if (years.length <= 1) return subjects;
  const eligible = startYear ? years.filter((y) => y <= startYear) : [];
  const year = eligible.length ? eligible[eligible.length - 1] : years[0];
  return subjects.filter((s) => (s.schemeYear || 0) === year);
}

export const hasTheoryPaper = (s) => Number(s.theoryExamMax) > 0;
export const hasPracticalExam = (s) => Number(s.practicalExamMax) > 0;

// Current-semester subjects for one student.
//   semesterSubjects : subjects of his department + semester (already scheme-filtered)
//   electiveChoices  : { [electiveGroup]: subjectId }
// Returns { subjects: [{ subject, kind }], warnings: [...] }
export function currentSubjectsFor(student, semesterSubjects, electiveChoices = {}) {
  const out = [];
  const warnings = [];
  const isLateral = LATERAL_TYPES.includes(student.admissionType);
  const groups = new Map(); // elective group -> subjects

  for (const s of semesterSubjects) {
    const cat = (s.subjectCategory || "REGULAR").toUpperCase();
    if (cat === "REGULAR") {
      out.push({ subject: s, kind: "REGULAR" });
    } else if (cat === "BRIDGE") {
      if (!isLateral) continue;
      const types = s.forAdmissionTypes || [];
      if (types.length === 0) {
        out.push({ subject: s, kind: "BRIDGE" });
        warnings.push(`Bridge course ${s.code}: lateral types not set, given to all laterals.`);
      } else if (types.includes(student.admissionType)) {
        out.push({ subject: s, kind: "BRIDGE" });
      }
    } else if (cat === "ELECTIVE") {
      const g = (s.electiveGroup || "").toUpperCase();
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(s);
    }
  }

  for (const [g, options] of groups) {
    const chosenId = electiveChoices[g];
    const chosen = chosenId && options.find((s) => String(s._id) === String(chosenId));
    if (chosen) out.push({ subject: chosen, kind: "ELECTIVE" });
    else warnings.push(`Elective not chosen for group ${g || "-"} (HOD to set).`);
  }

  return { subjects: out, warnings };
}

// Latest result per subject that is not a pass -> back papers.
//   results: [{ subject, status, declaredAt, semester }]
export function backlogsFrom(results) {
  const latest = new Map();
  for (const r of results) {
    const k = String(r.subject);
    const prev = latest.get(k);
    if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
  }
  return [...latest.values()].filter((r) => r.status !== "PASS");
}

export function backPaperAllowed(mode, examSemesters, subjectSemester) {
  if (mode === "NONE") return false;
  if (mode === "ALL" || !subjectSemester) return true;
  const parities = new Set(examSemesters.map((s) => s % 2));
  return parities.has(subjectSemester % 2);
}

// Why a sheet can't be used yet
function notReady(what, state) {
  if (state === "submitted") return `${what} submitted by HOD, waiting for the Exam Officer to freeze it.`;
  if (state === "draft") return `${what} is still a draft with the HOD.`;
  if (state === "no-subject") return `This subject is missing from the HOD's ${what} sheet.`;
  return `HOD has not entered ${what} for this class yet.`;
}

const round1 = (n) => Math.round(n * 10) / 10;

// Eligibility of one current-semester subject.
//   ia         : { state: "confirmed"|"submitted"|"draft"|"missing", marks, maxMarks }
//   attendance : { state, attended, maxClasses }
export function eligibilityFor(subject, ia, attendance, minAttendance = 75) {
  const reasons = [];
  let ans = false;
  let ne = false;
  let pending = false;
  let attendancePct = null;
  let iaMarks = null;
  let iaMax = null;

  // ---- attendance
  if (attendance?.state !== "confirmed") {
    pending = true;
    reasons.push(notReady("Attendance", attendance?.state));
  } else if (!(attendance.maxClasses > 0)) {
    pending = true;
    reasons.push("Total classes not entered for this subject.");
  } else if (attendance.attended === null || attendance.attended === undefined) {
    pending = true;
    reasons.push("Attendance not entered for this student.");
  } else {
    attendancePct = round1((attendance.attended / attendance.maxClasses) * 100);
    if ((attendance.attended / attendance.maxClasses) * 100 + 1e-9 < minAttendance) {
      ans = true;
      reasons.push(`Attendance ${attendancePct}% is below ${minAttendance}%.`);
    }
  }

  // ---- internal assessment
  if (ia?.state !== "confirmed") {
    pending = true;
    reasons.push(notReady("IA", ia?.state));
  } else if (ia.marks === null || ia.marks === undefined) {
    pending = true;
    reasons.push("IA mark not entered for this student.");
  } else {
    iaMarks = ia.marks;
    const subjectMax = Number(subject.iaMax) || 0;
    const sheetMax = Number(ia.maxMarks) || subjectMax;
    iaMax = sheetMax || null;
    const min = Number(subject.iaMin) || 0;
    // If the HOD entered IA out of a different maximum, compare proportionally
    const scaled = subjectMax && sheetMax && sheetMax !== subjectMax ? (ia.marks / sheetMax) * subjectMax : ia.marks;
    if (scaled + 1e-9 < min) {
      ne = true;
      reasons.push(`IA ${ia.marks}/${sheetMax || "?"} is below the minimum ${min}${sheetMax !== subjectMax ? `/${subjectMax}` : ""}.`);
    }
  }

  // ANS and NE are final even if the other part is still pending
  const status = ans ? "ANS" : ne ? "NE" : pending ? "PENDING" : "ELIGIBLE";
  return {
    status,
    reasons: status === "ELIGIBLE" ? [] : reasons,
    attendancePct,
    iaMarks,
    iaMax,
  };
}

// Back paper: FAIL/ABSENT carry IA forward; NE/ANS need re-registration.
export function backlogEligibility(lastStatus) {
  if (lastStatus === "NE" || lastStatus === "ANS") {
    return {
      status: "PENDING",
      reasons: [`Previous result was ${lastStatus}: student must re-register for this course. COE to confirm.`],
    };
  }
  if (lastStatus === "WITHHELD") {
    return { status: "PENDING", reasons: ["Previous result is withheld. COE to confirm."] };
  }
  return { status: "ELIGIBLE", reasons: [] };
}

export const effectiveOf = (s) => s.override?.status || s.status;

// incomplete = something is still missing (e.g. elective not chosen), so the
// registration can't be final even if every listed subject is eligible
export function summarize(subjects, { incomplete = false } = {}) {
  const counts = { total: subjects.length, eligible: 0, ans: 0, ne: 0, pending: 0 };
  for (const s of subjects) {
    const e = effectiveOf(s);
    if (e === "ELIGIBLE") counts.eligible++;
    else if (e === "ANS") counts.ans++;
    else if (e === "NE") counts.ne++;
    else counts.pending++;
  }
  let overall;
  if (counts.total === 0) overall = "BLOCKED";
  else if (counts.pending > 0 || (incomplete && counts.eligible > 0)) overall = "PENDING";
  else if (counts.eligible === counts.total) overall = "ALL_CLEAR";
  else if (counts.eligible === 0) overall = "BLOCKED";
  else overall = "PARTIAL";
  return { counts, overall };
}

// Keep COE work when registration is refreshed:
// overrides, fee ticks and manually added subjects survive.
export function mergeSubjects(fresh, existing = []) {
  const old = new Map(existing.map((s) => [String(s.subject), s]));
  const seen = new Set();
  const merged = fresh.map((s) => {
    const k = String(s.subject);
    seen.add(k);
    const prev = old.get(k);
    const next = { ...s };
    if (prev?.override?.status) next.override = prev.override;
    if (prev?.fee?.paid) next.fee = prev.fee;
    next.effective = effectiveOf(next);
    return next;
  });
  for (const prev of existing) {
    const k = String(prev.subject);
    if (seen.has(k)) continue;
    const keep = prev.source === "MANUAL" || prev.fee?.paid || prev.override?.status;
    if (!keep) continue;
    const kept = { ...prev };
    if (prev.source !== "MANUAL") {
      kept.reasons = [...new Set([...(prev.reasons || []), "No longer applicable to this student – check and remove."])];
    }
    merged.push(kept);
  }
  return merged;
}

export const isIncomplete = (warnings = []) => warnings.some((w) => w.startsWith("Elective not chosen"));

export const examGroupKey = (department, semester) => `${department}-${semester}`;

// ------------------------------------------------------------------ fees
//
// A student pays one regular fee for his current-semester subjects, and a
// separate fee for every back paper.
//   items  : what he must pay for (regular block + each back paper)
//   status : PAID | PARTIAL | UNPAID | NONE (nothing to pay)
export function feeItems(reg) {
  const items = [];
  const subjects = reg.subjects || [];
  if (subjects.some((s) => s.kind !== "BACKLOG")) {
    items.push({ type: "REGULAR", key: "REGULAR", label: "Regular fee", paid: Boolean(reg.regularFee?.paid), fee: reg.regularFee || {} });
  }
  for (const s of subjects) {
    if (s.kind !== "BACKLOG") continue;
    items.push({
      type: "SUBJECT",
      key: String(s.subject),
      subject: s.subject,
      code: s.code,
      label: `Back paper ${s.code}`,
      paid: Boolean(s.fee?.paid),
      fee: s.fee || {},
    });
  }
  return items;
}

export function feeSummary(reg) {
  const items = feeItems(reg);
  const paid = items.filter((i) => i.paid).length;
  const status = !items.length ? "NONE" : paid === items.length ? "PAID" : paid === 0 ? "UNPAID" : "PARTIAL";
  return { status, total: items.length, paid };
}

// Hall-ticket rule: may the student write this subject?
//   eligible (IA/attendance/override) AND the fee for it is paid
export function subjectFeePaid(reg, s) {
  return s.kind === "BACKLOG" ? Boolean(s.fee?.paid) : Boolean(reg.regularFee?.paid);
}

// Office Excel: "ALL", "REGULAR", or subject codes "25SC11T0, 25CS11T0"
export function parsePays(value) {
  const v = String(value ?? "").trim().toUpperCase();
  if (!v || v === "ALL") return { all: true, regular: true, codes: [] };
  const parts = v.split(/[\s,;/]+/).filter(Boolean);
  return {
    all: false,
    regular: parts.includes("REGULAR") || parts.includes("REG"),
    codes: parts.filter((p) => p !== "REGULAR" && p !== "REG"),
  };
}
