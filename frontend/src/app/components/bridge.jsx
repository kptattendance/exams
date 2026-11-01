"use client";

// Bridge courses on the HOD's Final IA sheet. Only lateral students take
// them, and only the lateral types each course is marked for (none marked =
// every lateral) – the same rule as exam registration
// (backend services/exams/rules.js takesSubject). For everyone else the cell
// is greyed out as "Not required" and saved empty.

const LATERAL = ["lateral-puc", "lateral-iti", "lateral-iti-cross"];
const SHORT = { "lateral-puc": "PUC", "lateral-iti": "ITI", "lateral-iti-cross": "ITI cross" };

export const isBridge = (subject) => String(subject?.subjectCategory || "").toUpperCase() === "BRIDGE";

export const isElective = (subject) => String(subject?.subjectCategory || "").toUpperCase() === "ELECTIVE";

export function takesSubject(student, subject) {
  // an elective: only the one the HOD chose for the student (none chosen yet: all)
  if (isElective(subject)) {
    const chosen = student?.electives?.[String(subject.electiveGroup || "").toUpperCase()];
    return !chosen || String(chosen) === String(subject.subjectId ?? subject._id);
  }
  if (!isBridge(subject)) return true;
  if (!LATERAL.includes(student?.admissionType)) return false;
  const types = subject.forAdmissionTypes || [];
  return types.length === 0 || types.includes(student.admissionType);
}

const forWhom = (subject) => (subject.forAdmissionTypes || []).map((t) => SHORT[t] || t).join(", ") || "all laterals";

// under the subject code in the table header
export function BridgeBadge({ subject }) {
  if (isElective(subject))
    return (
      <div className="mt-1 inline-block rounded bg-sky-200 px-1.5 py-0.5 text-[9px] font-bold text-sky-900" title="Elective – each student takes the one chosen under Electives">
        ELECTIVE · {subject.electiveGroup || "-"}
      </div>
    );
  if (!isBridge(subject)) return null;
  return (
    <div className="mt-1 inline-block rounded bg-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-900" title={`Bridge course – only for lateral students: ${forWhom(subject)}`}>
      BRIDGE · {forWhom(subject)}
    </div>
  );
}

// under the student's name
export function LateralTag({ student }) {
  if (!LATERAL.includes(student?.admissionType)) return null;
  return <span className="mt-0.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">Lateral · {SHORT[student.admissionType]}</span>;
}

const STRIPES = { backgroundImage: "repeating-linear-gradient(135deg, #f1f5f9 0 6px, #e2e8f0 6px 12px)" };

// the cell of a bridge course the student does not take
export function NotRequiredCell() {
  return (
    <td className="w-[115px] min-w-[115px] border-r border-b border-gray-200 px-1.5 py-1.5 text-center" style={STRIPES} title="Not taken by this student (bridge course of another type, or the other elective)">
      <span className="text-[10px] font-medium text-slate-500">Not required</span>
    </td>
  );
}

// a one-line explanation above the table (only when the semester has bridge courses)
export function BridgeLegend({ subjects }) {
  const list = (subjects || []).filter(isBridge);
  if (!list.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
      <span className="font-semibold">Bridge courses ({list.map((s) => s.code).join(", ")})</span>
      <span>Enter marks only in the white boxes – the lateral students who take them.</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-6 rounded border border-slate-300" style={STRIPES} /> = not required, leave it
      </span>
    </div>
  );
}
