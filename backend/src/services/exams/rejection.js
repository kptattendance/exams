// src/services/exams/rejection.js
//
// KPT 9.9 Result rejection – pure rules (unit-tested in test/rejection.test.js).
//   Odd semester  : once in the whole program – repeats the semester with readmission
//   Even semester : once in the whole program – cannot register for the next odd
//                   semester, waits for the next academic year
//   Project work  : cannot be rejected
//   Within one week of the results, through the HOD, with the Dean (Academic)'s approval

export const REJECTION_DAYS = 7;
export const isProjectWork = (c) => /\b(project|internship)\b/i.test(String(c?.name || ""));

//   reg      : his registration in the published exam (result.courses, semester, group)
//   earlier  : his earlier rejections [{ semester }]
//   publishedAt, now
// -> { ok, errors: [...], codes: [...courses rejected], kept: [...project work kept], parity }
export function rejectionCheck(reg, earlier = [], { publishedAt, now = new Date() } = {}) {
  const errors = [];
  const semester = Number(reg?.semester);
  if (!publishedAt) errors.push("The results of this exam are not published yet.");
  else if (now.getTime() - new Date(publishedAt).getTime() > REJECTION_DAYS * 864e5)
    errors.push(`The results were published on ${new Date(publishedAt).toLocaleDateString("en-IN")} – a result can be rejected only within one week (KPT 9.9).`);
  if (["backlog", "manual"].includes(reg?.group)) errors.push("He wrote only back papers in this exam – there is no semester result to reject.");
  if (!semester) errors.push("His semester is not known.");
  const parity = semester % 2 ? "odd" : "even";
  if (earlier.some((r) => Number(r.semester) % 2 === semester % 2))
    errors.push(`He has already rejected an ${parity}-semester result once – it is allowed only once in the program (KPT 9.9).`);

  const current = (reg?.result?.courses || []).filter((c) => c.kind !== "BACKLOG" && Number(c.semester) === semester);
  const kept = current.filter(isProjectWork).map((c) => c.code);
  const codes = current.filter((c) => !isProjectWork(c)).map((c) => c.code);
  if (!codes.length) errors.push("No course of this semester's result can be rejected.");
  return { ok: errors.length === 0, errors, codes, kept, parity };
}
