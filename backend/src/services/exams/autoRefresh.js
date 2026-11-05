// src/services/exams/autoRefresh.js
//
// Keeps exam registration up to date by itself. Whenever something that
// decides a student's exam subjects changes – electives, a frozen / returned
// IA or attendance sheet, a subject, imported results, a student – only the
// classes concerned (department + semester) are registered again, in every
// exam that is already registered and not completed. The same work as the
// COE's "Refresh registration" (which keeps the COE's decisions, paid fees
// and hand-added back papers), so it is safe to repeat.
//
// It runs before the request answers (no background work on the server). If
// it cannot run (a full registration is running, or an error), the class is
// marked "out of date" on the exam page and refreshed before hall tickets
// are listed.

import Exam from "../../models/Exam.js";
import { examGroupKey } from "./rules.js";
import { refreshBacklogInExam, refreshClassInExam } from "../../controllers/examController.js";

const BACKLOG = "backlog";

const keyOf = (c) => (c.backlog ? BACKLOG : examGroupKey(c.department, c.semester));

async function markStale(exam, c, reason) {
  const key = keyOf(c);
  await Exam.updateOne({ _id: exam._id }, { $pull: { "generation.stale": { key } } });
  await Exam.updateOne(
    { _id: exam._id },
    { $push: { "generation.stale": { key, department: c.department || "", semester: c.semester || null, reason: String(reason || "").slice(0, 200), at: new Date() } } }
  );
}

// classes: [{ department, semester }] and/or { backlog: true }; reason: shown if it fails
export async function refreshClasses(classes, reason = "") {
  const seen = new Set();
  const list = [];
  for (const c of classes || []) {
    if (!c) continue;
    const item = c.backlog
      ? { backlog: true }
      : { department: String(c.department || "").toLowerCase(), semester: Number(c.semester) };
    if (!item.backlog && (!item.department || !(item.semester >= 1 && item.semester <= 6))) continue;
    const k = keyOf(item);
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(item);
  }
  const out = { refreshed: 0, pending: 0 };
  if (!list.length) return out;

  // published results lock an examination: it is never refreshed again (services/examLock.js)
  const exams = await Exam.find({ status: { $ne: "COMPLETED" }, "generation.finishedAt": { $ne: null }, "results.publishedAt": null });
  for (const exam of exams) {
    const running = exam.generation?.lockedUntil && exam.generation.lockedUntil > new Date();
    for (const c of list) {
      if (c.backlog ? exam.backPapers === "NONE" : !exam.semesters.includes(c.semester)) continue;
      if (running) {
        await markStale(exam, c, reason);
        out.pending++;
        continue;
      }
      try {
        if (c.backlog) await refreshBacklogInExam(exam);
        else await refreshClassInExam(exam, c.department, c.semester);
        out.refreshed++;
      } catch (e) {
        console.error("Automatic registration refresh failed:", keyOf(c), e.message);
        await markStale(exam, c, reason).catch(() => {});
        out.pending++;
      }
    }
  }
  return out;
}

// Never lets a refresh problem fail the save that triggered it
export async function refreshAfterChange(classes, reason) {
  try {
    return await refreshClasses(classes, reason);
  } catch (e) {
    console.error("Automatic registration refresh failed:", e.message);
    return { refreshed: 0, pending: 1 };
  }
}

// The classes of one exam still marked "out of date" (e.g. before hall tickets)
export async function refreshStale(examId) {
  const exam = await Exam.findById(examId).select("generation.stale results.publishedAt").lean();
  const stale = exam?.generation?.stale || [];
  // results published: the examination is locked (services/examLock.js)
  if (!stale.length || exam?.results?.publishedAt) return { refreshed: 0, pending: 0 };
  return refreshAfterChange(
    stale.map((s) => (s.key === BACKLOG ? { backlog: true } : { department: s.department, semester: s.semester })),
    "refresh before hall tickets"
  );
}

// " Exam registration updated." for save messages
export const refreshNote = (r) => (r?.refreshed ? " Exam registration updated." : r?.pending ? " Exam registration will update – the COE sees it as out of date." : "");
