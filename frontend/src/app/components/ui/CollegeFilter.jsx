"use client";

// Day college (register numbers 103…) or evening college (186…, working
// students) – a filter for the COE / office / Admin lists, and a small
// "Evening" tag next to a register number.
//
//   <CollegeSelect value={college} onChange={setCollege} />
//   <EveningTag registerNumber={s.registerNumber} />

export const EVENING_CODE = process.env.NEXT_PUBLIC_EVENING_COLLEGE_CODE || "186";
export const isEveningNo = (registerNumber) => String(registerNumber || "").startsWith(EVENING_CODE);
// working professionals: evening numbers in the 351–399, 451–499, 751–999 series
const WORKING_RX = new RegExp(`^${EVENING_CODE}[A-Z]{2}\\d{2}(35[1-9]|3[6-9]\\d|45[1-9]|4[6-9]\\d|75[1-9]|7[6-9]\\d|[89]\\d\\d)$`, "i");
export const isWorkingNo = (registerNumber) => WORKING_RX.test(String(registerNumber || "").trim());
// "" (all), "DAY", "EVENING" (evening shift), "WORKING" -> does this register number match?
export const matchesCollege = (college, registerNumber) => {
  if (!college) return true;
  if (college === "DAY") return !isEveningNo(registerNumber);
  if (college === "WORKING") return isWorkingNo(registerNumber);
  return isEveningNo(registerNumber) && !isWorkingNo(registerNumber);
};

// branches in the class list: the evening college has only EE and ME
const ALL_BRANCHES = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];
export const EVENING_DEPTS = ["ee", "me"];
export const branchesFor = (college) => (college === "EVENING" || college === "WORKING" ? EVENING_DEPTS : ALL_BRANCHES);
// changing the college: a class that is not in the new list goes back to "All classes"
export const keepClass = (cls, college) =>
  !cls || cls === "backlog" || branchesFor(college).includes(String(cls).split("-")[0]) ? cls : "";
const COLLEGE_WORD = { DAY: "", EVENING: " (evening)", WORKING: " (working prof.)" };
// class list for a college: [["ee-1", "EE · Sem 1 (evening)"], …, ["backlog", "Back papers only"]]
export const classesFor = (semesters = [], college = "") => [
  ...semesters.flatMap((s) => branchesFor(college).map((d) => [`${d}-${s}`, `${d.toUpperCase()} · Sem ${s}${COLLEGE_WORD[college] || ""}`])),
  ["backlog", "Back papers only"],
];

export const COLLEGES = [
  ["", "Day + Evening + Working prof."],
  ["DAY", "Day college (103)"],
  ["EVENING", `Evening shift (${EVENING_CODE})`],
  ["WORKING", `Working professionals (${EVENING_CODE})`],
];

export default function CollegeSelect({ value, onChange, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Day or evening college"
      className={className || "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"}
    >
      {COLLEGES.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function EveningTag({ registerNumber }) {
  if (!isEveningNo(registerNumber)) return null;
  if (isWorkingNo(registerNumber))
    return <span className="ml-1.5 inline-block rounded bg-teal-50 px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-teal-700">Working prof.</span>;
  return <span className="ml-1.5 inline-block rounded bg-indigo-50 px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-indigo-700">Evening</span>;
}
