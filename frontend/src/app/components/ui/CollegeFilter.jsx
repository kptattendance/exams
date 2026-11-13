"use client";

// Day college (register numbers 103…) or evening college (186…, working
// students) – a filter for the COE / office / Admin lists, and a small
// "Evening" tag next to a register number.
//
//   <CollegeSelect value={college} onChange={setCollege} />
//   <EveningTag registerNumber={s.registerNumber} />

export const EVENING_CODE = process.env.NEXT_PUBLIC_EVENING_COLLEGE_CODE || "186";
export const isEveningNo = (registerNumber) => String(registerNumber || "").startsWith(EVENING_CODE);
// "" (both), "DAY", "EVENING" -> does this register number match?
export const matchesCollege = (college, registerNumber) =>
  !college || (college === "EVENING" ? isEveningNo(registerNumber) : !isEveningNo(registerNumber));

export const COLLEGES = [
  ["", "Day + Evening"],
  ["DAY", "Day college (103)"],
  ["EVENING", `Evening college (${EVENING_CODE})`],
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
  return <span className="ml-1.5 inline-block rounded bg-indigo-50 px-1.5 py-px align-middle text-[10px] font-bold uppercase tracking-wide text-indigo-700">Evening</span>;
}
