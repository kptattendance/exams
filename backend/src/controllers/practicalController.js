// src/controllers/practicalController.js
//
// Practical exam marks:
//
//   1. Examiners  – the COE allots one or two examiner SETS to each department
//                   (an internal examiner with a login + an external examiner
//                   who gets a secret code). Examiners and the HOD get an email.
//   2. Time table – the HOD of the subject's BOARD contacts the examiners, forms
//                   the batches (any size, students of any branch) and fixes
//                   date / session / lab. Clashes are refused. The examiners
//                   are emailed their time table whenever it changes.
//   3. Marks      – the internal examiner signs in, the external examiner types
//                   his code, they enter one agreed mark per student and submit.
//   4. Final      – submitting writes ExamRegistration.subjects[].practical.
//                   After that only the Admin can correct a mark, with a reason.

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import PracticalBatch from "../models/PracticalBatch.js";
import PracticalPanel from "../models/PracticalPanel.js";
import AuditLog from "../models/AuditLog.js";
import { sendPracticalAllotmentEmail, sendPracticalScheduleEmail } from "../services/mailer.js";
import {
  batchLabel,
  boardDepartment,
  boardsOf,
  CONDUCTING_DEPARTMENTS,
  practicalCandidates,
  splitEvenly,
  checkArrangement,
  checkSheet,
  findClashes,
  makeCode,
  newAccess,
  checkCode,
  sheetSummary,
  prune,
  MAX_CODE_TRIES,
} from "../services/exams/practical.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const lower = (v) => String(v || "").trim().toLowerCase();
const codeOf = (req) => String(req.params.code || "").toUpperCase();

const UNLOCK_HOURS = 12;

const log = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entity: "PracticalBatch",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details,
  }).catch(() => {});

// HODs only ever work on their own department
function departmentFor(req, requested) {
  if (req.user?.role === "hod") return lower(req.user.department);
  return lower(requested);
}

async function loadExam(req, res) {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(req.params.id).select("name academicYear status timetable.entries").lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  return exam;
}
const examView = (e) => ({ _id: e._id, name: e.name, academicYear: e.academicYear, status: e.status });

const REG_FIELDS =
  "student registerNumber name department regularFee subjects.subject subjects.code subjects.name subjects.semester subjects.kind subjects.hasTheory subjects.hasPractical subjects.status subjects.override subjects.fee";

// code -> { name, board, department (who conducts), max, min }
async function subjectInfo(codes) {
  const docs = await Subject.find({ code: { $in: codes }, practicalExamMax: { $gt: 0 } })
    .select("code name board semester practicalExamMax practicalExamMin")
    .sort({ department: 1 })
    .lean();
  const map = new Map();
  for (const d of docs)
    if (!map.has(d.code))
      map.set(d.code, { code: d.code, name: d.name, board: d.board, semester: d.semester, department: boardDepartment(d.board), max: d.practicalExamMax, min: d.practicalExamMin || 0 });
  return map;
}

const panelReady = (p) => Boolean(p?.internal?.clerkId && p?.external?.name);
const isInternal = (req, p) => Boolean(p?.internal?.clerkId) && p.internal.clerkId === req.user?.id;
const isUnlocked = (b) => Boolean(b.unlockedUntil) && new Date(b.unlockedUntil) > new Date();

async function panelMap(batches) {
  const ids = [...new Set(batches.map((b) => String(b.panel || "")).filter(Boolean))];
  if (!ids.length) return new Map();
  const panels = await PracticalPanel.find({ _id: { $in: ids } }).lean();
  return new Map(panels.map((p) => [String(p._id), p]));
}

// The code's hash never leaves the server
function panelView(p) {
  return {
    _id: p._id,
    department: p.department,
    number: p.number,
    internal: { user: p.internal?.user || null, name: p.internal?.name || "", email: p.internal?.email || "", phone: p.internal?.phone || "" },
    external: { name: p.external?.name || "", college: p.external?.college || "", phone: p.external?.phone || "", email: p.external?.email || "" },
    codeIssued: Boolean(p.access?.hash),
    codeLocked: (p.access?.fails || 0) >= MAX_CODE_TRIES,
    codeSentTo: p.access?.sentTo || "",
  };
}

// What the screens get; marks are shown only when `marks` is true.
function batchView(b, panel, { students = true, marks = false } = {}) {
  const done = b.status === "SUBMITTED";
  const pv = panel ? panelView(panel) : null;
  return {
    _id: b._id,
    exam: b.exam,
    code: b.code,
    name: b.name,
    board: b.board,
    department: b.department,
    semester: b.semester,
    number: b.number,
    label: b.label,
    date: b.date,
    session: b.session,
    lab: b.lab,
    max: b.max,
    min: b.min,
    status: b.status,
    count: b.students.length,
    branches: [...new Set(b.students.map((s) => s.department).filter(Boolean))].sort(),
    panel: b.panel || null,
    set: pv?.number || null,
    // after submission the names are the ones recorded at that moment
    internal: done ? { name: b.submitted?.internal || "" } : { name: pv?.internal.name || "" },
    external: done ? { name: b.submitted?.external || "", college: b.submitted?.college || "" } : { name: pv?.external.name || "", college: pv?.external.college || "" },
    allotted: done || panelReady(panel),
    codeIssued: Boolean(pv?.codeIssued),
    codeLocked: Boolean(pv?.codeLocked),
    submitted: b.submitted || {},
    corrections: marks ? b.corrections || [] : undefined,
    summary: done ? sheetSummary(b.students) : undefined,
    students: students
      ? b.students.map((s) => ({
          registration: s.registration,
          registerNumber: s.registerNumber,
          name: s.name,
          department: s.department,
          kind: s.kind,
          attendance: marks ? s.attendance : null,
          marks: marks ? s.marks : null,
        }))
      : undefined,
  };
}

// The agreed marks go to the student's registration, ready for results
const registrationOps = (batch, students, at) =>
  students.map((s) => ({
    updateOne: {
      filter: { _id: s.registration },
      update: {
        $set: {
          "subjects.$[x].practical": {
            attendance: s.attendance,
            marks: s.attendance === "PRESENT" ? s.marks : null,
            max: batch.max,
            batch: batch._id,
            submittedAt: at,
          },
        },
      },
      arrayFilters: [{ "x.code": batch.code }],
    },
  }));

// Students who are no longer permitted (eligibility or fee changed after the
// batches were made) leave their batch automatically – nobody has to remove
// them by hand. Runs whenever batches are read; submitted batches never change.
async function syncOpen(req, filter) {
  const batches = await PracticalBatch.find({ ...filter, status: "OPEN" }).select("exam code label students").lean();
  const ids = batches.flatMap((b) => b.students.map((s) => s.registration));
  if (!ids.length) return;
  const regs = await ExamRegistration.find({ _id: { $in: ids } }).select(REG_FIELDS).lean();
  for (const b of batches) {
    const { keep, removed } = prune(b.students, regs, b.code);
    if (!removed.length) continue;
    await PracticalBatch.updateOne({ _id: b._id, status: "OPEN" }, { $set: { students: keep } });
    await log(req, "PRACTICAL_STUDENTS_REMOVED", b._id, { batch: b.label, automatic: true, students: removed.map((s) => s.registerNumber) });
  }
}

// ------------------------------------------------------------------ lists

// GET /api/practicals/exams
export const practicalExams = async (req, res) => {
  const exams = await Exam.find({ status: { $ne: "COMPLETED" } }).select("name academicYear status").sort({ createdAt: -1 }).lean();
  res.json({ data: exams, department: req.user?.role === "hod" ? lower(req.user.department) : "" });
};

// GET /api/practicals/examiners – staff who can be an internal examiner
export const listExaminers = async (req, res) => {
  const users = await User.find({ role: { $in: ["staff", "hod"] } }).select("name email phone department role").sort({ department: 1, name: 1 }).lean();
  res.json({ data: users });
};

// ------------------------------------------------------------------ examiner sets (COE)

// GET /api/practicals/:id/panels – each department: its practical work and its examiner sets
export const listPanels = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const only = req.user?.role === "hod" ? lower(req.user.department) : "";

  const [counts, panels, batches] = await Promise.all([
    ExamRegistration.aggregate([
      { $match: { exam: exam._id } },
      { $unwind: "$subjects" },
      { $match: { "subjects.hasPractical": true } },
      { $group: { _id: "$subjects.code", students: { $sum: 1 } } },
    ]),
    PracticalPanel.find({ exam: exam._id, ...(only ? { department: only } : {}) }).sort({ department: 1, number: 1 }).lean(),
    PracticalBatch.aggregate([{ $match: { exam: exam._id } }, { $group: { _id: { department: "$department", status: "$status" }, n: { $sum: 1 } } }]),
  ]);
  const info = await subjectInfo(counts.map((c) => c._id));
  const rows = new Map();
  const row = (d) => {
    if (!rows.has(d)) rows.set(d, { department: d, subjects: 0, students: 0, batches: 0, submitted: 0, panels: [] });
    return rows.get(d);
  };
  for (const d of CONDUCTING_DEPARTMENTS) row(d);
  for (const c of counts) {
    const s = info.get(c._id);
    if (!s) continue;
    row(s.department).subjects++;
    row(s.department).students += c.students;
  }
  for (const b of batches) {
    row(b._id.department).batches += b.n;
    if (b._id.status === "SUBMITTED") row(b._id.department).submitted += b.n;
  }
  for (const p of panels) row(p.department).panels.push(panelView(p));
  res.json({ exam: examView(exam), data: [...rows.values()].filter((r) => !only || r.department === only) });
};

// Reads and checks the two examiners from the request
async function readExaminers(req) {
  if (!isId(req.body?.internalId)) return { error: "Choose the internal examiner." };
  const user = await User.findById(req.body.internalId).select("name email phone role clerkId").lean();
  if (!user?.clerkId || !["staff", "hod"].includes(user.role)) return { error: "The internal examiner must be a staff member with a login." };
  const ext = req.body?.external || {};
  const external = {
    name: String(ext.name || "").trim().slice(0, 80),
    college: String(ext.college || "").trim().slice(0, 120),
    phone: String(ext.phone || "").trim().slice(0, 20),
    email: lower(ext.email).slice(0, 120),
  };
  if (external.name.length < 3) return { error: "Type the external examiner's name." };
  if (external.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(external.email)) return { error: "The external examiner's email does not look right." };
  return { internal: { user: user._id, clerkId: user.clerkId, name: user.name, email: user.email, phone: user.phone || "" }, external };
}

// Tell everyone concerned. Returns who was reached.
async function notifyAllotment(exam, panel, code) {
  const hods = await User.find({ role: "hod", department: panel.department }).select("name email").lean();
  const jobs = [
    { to: panel.internal.email, name: panel.internal.name, role: "INTERNAL" },
    ...hods.filter((h) => h.email && h.email !== panel.internal.email).map((h) => ({ to: h.email, name: h.name, role: "HOD" })),
  ];
  if (code && panel.external.email) jobs.push({ to: panel.external.email, name: panel.external.name, role: "EXTERNAL" });
  const results = await Promise.allSettled(jobs.map((j) => sendPracticalAllotmentEmail({ ...j, exam, panel, code })));
  const sent = (role) => jobs.some((j, i) => j.role === role && results[i].status === "fulfilled" && results[i].value === true);
  return { internal: sent("INTERNAL"), external: sent("EXTERNAL"), hod: sent("HOD") };
}

async function issueCode(req, panel, exam) {
  const code = makeCode();
  panel.access = { ...newAccess(code), issuedAt: new Date(), issuedBy: who(req), sentTo: "" };
  const mail = await notifyAllotment(exam, panel, code);
  if (mail.external) panel.access.sentTo = panel.external.email;
  await panel.save();
  // sheets opened with the old code must be opened again
  await PracticalBatch.updateMany({ panel: panel._id, status: "OPEN" }, { $set: { unlockedUntil: null } });
  return { code, mail };
}

const allotReply = (panel, mail, code) => {
  const told = [mail.internal && "internal examiner", mail.external && "external examiner", mail.hod && "HOD"].filter(Boolean);
  return {
    message: `Examiner set ${panel.number} of ${panel.department.toUpperCase()} saved. ${told.length ? `Email sent to: ${told.join(", ")}.` : "No email could be sent – please inform them."}`,
    // The code is shown to the COE only when it could not be emailed to the external examiner
    code: code && !mail.external ? code : null,
  };
};

// POST /api/practicals/:id/panels  { department, internalId, external: { name, college, phone, email } }
export const addPanel = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const department = lower(req.body?.department);
  if (!CONDUCTING_DEPARTMENTS.includes(department)) return fail(res, 400, "Choose the department.");
  const ex = await readExaminers(req);
  if (ex.error) return fail(res, 400, ex.error);
  const last = await PracticalPanel.findOne({ exam: exam._id, department }).sort({ number: -1 }).select("number").lean();
  const panel = new PracticalPanel({ exam: exam._id, department, number: (last?.number || 0) + 1, ...ex, allottedAt: new Date(), allottedBy: who(req) });
  const { code, mail } = await issueCode(req, panel, exam);
  // The department's first set takes the batches the HOD has already made
  if (panel.number === 1) {
    const taken = await PracticalBatch.updateMany({ exam: exam._id, department, panel: null, status: "OPEN" }, { $set: { panel: panel._id } });
    if (taken.modifiedCount) await sendSchedules(exam, [String(panel._id)]);
  }
  await log(req, "PRACTICAL_EXAMINERS_ALLOTTED", panel._id, { department, set: panel.number, internal: ex.internal.email, external: ex.external.name, mail });
  res.json(allotReply(panel, mail, code));
};

// PATCH /api/practicals/panels/:panelId  { internalId, external }
export const updatePanel = async (req, res) => {
  if (!isId(req.params.panelId)) return fail(res, 400, "Invalid examiner set.");
  const panel = await PracticalPanel.findById(req.params.panelId);
  if (!panel) return fail(res, 404, "Examiner set not found.");
  const ex = await readExaminers(req);
  if (ex.error) return fail(res, 400, ex.error);
  const exam = await Exam.findById(panel.exam).select("name").lean();
  const externalChanged = !panel.access?.hash || panel.external.name !== ex.external.name || panel.external.email !== ex.external.email;
  const internalChanged = panel.internal.clerkId !== ex.internal.clerkId;
  panel.internal = ex.internal;
  panel.external = ex.external;
  panel.allottedAt = new Date();
  panel.allottedBy = who(req);

  let code = null;
  let mail;
  if (externalChanged) ({ code, mail } = await issueCode(req, panel, exam));
  else {
    await panel.save();
    if (internalChanged) await PracticalBatch.updateMany({ panel: panel._id, status: "OPEN" }, { $set: { unlockedUntil: null } });
    mail = await notifyAllotment(exam, panel, null);
  }
  await log(req, "PRACTICAL_EXAMINERS_CHANGED", panel._id, { department: panel.department, set: panel.number, internal: ex.internal.email, external: ex.external.name, codeIssued: externalChanged, mail });
  res.json(allotReply(panel, mail, code));
};

// DELETE /api/practicals/panels/:panelId – only while no batch uses the set
export const removePanel = async (req, res) => {
  if (!isId(req.params.panelId)) return fail(res, 400, "Invalid examiner set.");
  const panel = await PracticalPanel.findById(req.params.panelId).lean();
  if (!panel) return fail(res, 404, "Examiner set not found.");
  const used = await PracticalBatch.countDocuments({ panel: panel._id });
  if (used) return fail(res, 409, `This set is used by ${used} batch${used > 1 ? "es" : ""}. Change the examiners instead of removing the set.`);
  await PracticalPanel.deleteOne({ _id: panel._id });
  await log(req, "PRACTICAL_EXAMINERS_REMOVED", panel._id, { department: panel.department, set: panel.number, internal: panel.internal.email, external: panel.external.name });
  res.json({ message: `Examiner set ${panel.number} removed.` });
};

// POST /api/practicals/panels/:panelId/code – new code (lost, or locked after wrong tries)
export const reissueCode = async (req, res) => {
  if (!isId(req.params.panelId)) return fail(res, 400, "Invalid examiner set.");
  const panel = await PracticalPanel.findById(req.params.panelId);
  if (!panel) return fail(res, 404, "Examiner set not found.");
  const exam = await Exam.findById(panel.exam).select("name").lean();
  const { code, mail } = await issueCode(req, panel, exam);
  await log(req, "PRACTICAL_CODE_REISSUED", panel._id, { department: panel.department, set: panel.number, emailed: mail.external });
  res.json({ message: "New code issued. The old code no longer works.", code, emailed: mail.external });
};

// ------------------------------------------------------------------ batches and time table (HOD of the board)

// GET /api/practicals/:id/subjects?department=cs – practical exams the department conducts
export const listSubjects = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const department = departmentFor(req, req.query.department);
  if (!department) return fail(res, 400, "Department is required.");
  await syncOpen(req, { exam: exam._id, department });

  const subjects = await Subject.find({ board: { $in: boardsOf(department) }, practicalExamMax: { $gt: 0 } }).select("code name semester board").lean();
  const codes = [...new Set(subjects.map((s) => s.code))];
  const [regs, batches, panels] = await Promise.all([
    ExamRegistration.find({ exam: exam._id, "subjects.code": { $in: codes } }).select(REG_FIELDS).lean(),
    PracticalBatch.find({ exam: exam._id, code: { $in: codes } }).select("code status panel date students.registration").lean(),
    PracticalPanel.find({ exam: exam._id, department }).sort({ number: 1 }).lean(),
  ]);
  const data = [];
  for (const code of codes) {
    const s = subjects.find((x) => x.code === code);
    const takers = regs.filter((r) => r.subjects.some((x) => x.code === code && x.hasPractical));
    if (!takers.length) continue;
    const candidates = practicalCandidates(regs, code);
    const mine = batches.filter((b) => b.code === code);
    data.push({
      code,
      name: s.name,
      semester: s.semester,
      board: s.board,
      registered: takers.length,
      candidates: candidates.length,
      branches: [...new Set(candidates.map((c) => c.department))].sort(),
      batches: mine.length,
      assigned: mine.reduce((n, b) => n + b.students.length, 0),
      dated: mine.filter((b) => b.date).length,
      submitted: mine.filter((b) => b.status === "SUBMITTED").length,
    });
  }
  data.sort((a, b) => (a.semester || 9) - (b.semester || 9) || a.code.localeCompare(b.code));
  res.json({ exam: examView(exam), department, panels: panels.map(panelView), data });
};

async function subjectContext(req, res) {
  const exam = await loadExam(req, res);
  if (!exam) return null;
  const code = codeOf(req);
  const info = (await subjectInfo([code])).get(code);
  if (!info) return fail(res, 404, `${code} has no practical exam.`), null;
  if (req.user?.role === "hod" && lower(req.user.department) !== info.department)
    return fail(res, 403, `The practical exam of ${code} is conducted by the ${info.board} board.`), null;
  const regs = await ExamRegistration.find({ exam: exam._id, "subjects.code": code }).select(REG_FIELDS).lean();
  const candidates = practicalCandidates(regs, code);
  await syncOpen(req, { exam: exam._id, code });
  const [batches, panels] = await Promise.all([
    PracticalBatch.find({ exam: exam._id, code }).sort({ number: 1 }).lean(),
    PracticalPanel.find({ exam: exam._id, department: info.department }).sort({ number: 1 }).lean(),
  ]);
  return { exam, code, info, regs, candidates, batches, panels };
}

// GET /api/practicals/:id/subjects/:code – candidates, batches and the department's examiner sets
export const getSubject = async (req, res) => {
  const ctx = await subjectContext(req, res);
  if (!ctx) return;
  const { exam, info, candidates, batches, panels } = ctx;
  const pm = new Map(panels.map((p) => [String(p._id), p]));
  res.json({
    data: {
      exam: examView(exam),
      subject: info,
      candidates,
      panels: panels.map(panelView),
      batches: batches.map((b) => batchView(b, pm.get(String(b.panel)), { marks: b.status === "SUBMITTED" })),
    },
  });
};

const studentRow = (c, old) => ({
  registration: c.registration,
  student: c.student,
  registerNumber: c.registerNumber,
  name: c.name,
  department: c.department,
  kind: c.kind,
  attendance: old?.attendance ?? null,
  marks: old?.marks ?? null,
});

// Each examiner gets his whole time table again whenever something of his changes
async function sendSchedules(exam, panelIds) {
  const panels = await PracticalPanel.find({ _id: { $in: [...panelIds] } }).lean();
  const jobs = [];
  for (const panel of panels) {
    if (!panelReady(panel)) continue;
    const batches = await PracticalBatch.find({ exam: exam._id, panel: panel._id }).select("code name number date session lab students.registration").lean();
    if (!batches.some((b) => b.date)) continue;
    batches.sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || (b.session || "").localeCompare(a.session || "") || a.code.localeCompare(b.code));
    for (const p of [panel.internal, panel.external]) if (p.email) jobs.push(sendPracticalScheduleEmail({ to: p.email, name: p.name, exam, panel, batches }));
  }
  const results = await Promise.allSettled(jobs);
  return results.filter((r) => r.status === "fulfilled" && r.value === true).length;
}

// Saves an arrangement of the OPEN batches of one subject.
//   after: [{ number, date, session, lab, panel, students: [registrationId] }]
// A batch left without students is removed. Returns { status, body }.
async function arrange(req, ctx, after) {
  const { exam, code, info, regs, candidates, batches, panels } = ctx;
  const byId = new Map(candidates.map((c) => [String(c.registration), c]));
  const locked = new Map(batches.filter((b) => b.status === "SUBMITTED").map((b) => [b.number, b.students.map((s) => String(s.registration))]));
  const check = checkArrangement(after, new Set(byId.keys()), locked);
  if (!check.ok) return { status: 400, body: { error: check.errors[0], errors: check.errors } };

  const own = new Map(panels.map((p) => [String(p._id), p]));
  const next = after
    .filter((a) => !locked.has(Number(a.number)))
    .map((a) => ({
      number: Number(a.number),
      label: batchLabel(code, Number(a.number)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(a.date || "") ? a.date : "",
      session: ["FN", "AN"].includes(a.session) ? a.session : "",
      lab: String(a.lab || "").trim().slice(0, 60),
      // with a single set there is nothing to choose
      panel: own.has(String(a.panel)) ? String(a.panel) : panels.length === 1 ? String(panels[0]._id) : null,
      students: (a.students || []).map(String),
    }));

  // ---- clashes with every other practical batch of the exam and with the written time table
  const [others, allPanels] = await Promise.all([
    PracticalBatch.find({ exam: exam._id, code: { $ne: code } }).select("label date session lab panel students.registration students.registerNumber").lean(),
    PracticalPanel.find({ exam: exam._id }).select("internal.clerkId external.email external.name").lean(),
  ]);
  const pm = new Map(allPanels.map((p) => [String(p._id), p]));
  const slot = (x, students) => {
    const p = pm.get(String(x.panel || ""));
    return { label: x.label, date: x.date, session: x.session, lab: x.lab, set: String(x.panel || ""), internal: p?.internal?.clerkId || "", external: p?.external?.email || p?.external?.name || "", students };
  };
  const fromDoc = (b) => slot(b, b.students.map((s) => ({ id: s.registration, registerNumber: s.registerNumber })));
  const all = [
    ...others.map(fromDoc),
    ...batches.filter((b) => b.status === "SUBMITTED").map(fromDoc),
    ...next.filter((a) => a.students.length).map((a) => slot(a, a.students.map((id) => ({ id, registerNumber: byId.get(id).registerNumber })))),
  ];
  const paperSlot = new Map((exam.timetable?.entries || []).map((e) => [e.code, `${e.date}|${e.session}`]));
  const written = new Map(
    regs.map((r) => [String(r._id), new Map(r.subjects.filter((s) => s.hasTheory && paperSlot.has(s.code)).map((s) => [paperSlot.get(s.code), s.code]))])
  );
  const clashes = findClashes(all, new Set(next.map((a) => a.label)), written);
  if (clashes.length)
    return { status: 409, body: { error: clashes.length === 1 ? clashes[0] : `${clashes.length} clashes in the time table. Nothing was saved.`, clashes } };

  // ---- save
  const old = new Map(batches.map((b) => [b.number, b]));
  const touched = new Set();
  let saved = 0;
  for (const a of next) {
    const prev = old.get(a.number);
    if (!a.students.length) {
      if (prev) {
        await PracticalBatch.deleteOne({ _id: prev._id, status: "OPEN" });
        if (prev.panel) touched.add(String(prev.panel));
      }
      continue;
    }
    const before = new Map((prev?.students || []).map((s) => [String(s.registration), s]));
    const set = {
      name: info.name,
      board: info.board,
      department: info.department,
      semester: info.semester ?? null,
      label: a.label,
      max: info.max,
      min: info.min,
      date: a.date,
      session: a.session,
      lab: a.lab,
      panel: a.panel,
      students: a.students.map((id) => studentRow(byId.get(id), before.get(id))),
    };
    const moved = !prev || prev.date !== a.date || prev.session !== a.session || prev.lab !== a.lab || String(prev.panel || "") !== String(a.panel || "") || prev.students.length !== a.students.length;
    if (moved) {
      if (a.panel) touched.add(a.panel);
      if (prev?.panel) touched.add(String(prev.panel));
    }
    // a sheet opened under another examiner set must be opened again
    if (prev && String(prev.panel || "") !== String(a.panel || "")) set.unlockedUntil = null;
    if (prev) await PracticalBatch.updateOne({ _id: prev._id, status: "OPEN" }, { $set: set });
    else await PracticalBatch.create({ exam: exam._id, code, number: a.number, ...set, createdBy: who(req) });
    saved++;
  }
  const mails = touched.size ? await sendSchedules(exam, touched) : 0;
  await log(req, "PRACTICAL_BATCHES_SAVED", exam._id, { code, batches: saved, emails: mails });
  const left = check.unassigned.length;
  return {
    status: 200,
    body: {
      message: [
        `${saved} batch${saved === 1 ? "" : "es"} saved.`,
        left ? `${left} student${left > 1 ? "s are" : " is"} not in any batch yet.` : "",
        mails ? "The examiners were emailed their time table." : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

// POST /api/practicals/:id/subjects/:code/split  { count }
// Makes `count` batches of nearly equal size in register-number order (branch by branch).
export const splitBatches = async (req, res) => {
  const ctx = await subjectContext(req, res);
  if (!ctx) return;
  const { candidates, batches } = ctx;
  if (batches.some((b) => b.status === "SUBMITTED"))
    return fail(res, 409, "Marks are already submitted for a batch, so the batches cannot be made again. Move students between the other batches instead.");
  if (!candidates.length) return fail(res, 400, "No student is permitted to take this practical exam yet (check eligibility and fees).");

  const groups = splitEvenly(candidates, req.body?.count);
  const old = new Map(batches.map((b) => [b.number, b]));
  // date, lab and examiners of an existing batch number are kept
  const after = groups.map((g, i) => {
    const prev = old.get(i + 1);
    return { number: i + 1, date: prev?.date, session: prev?.session, lab: prev?.lab, panel: prev?.panel, students: g.map((c) => String(c.registration)) };
  });
  for (const b of batches) if (b.number > groups.length) after.push({ number: b.number, students: [] });
  const r = await arrange(req, ctx, after);
  res.status(r.status).json(r.body);
};

// PUT /api/practicals/:id/subjects/:code/batches
//   { batches: [{ number, date, session, lab, panel, students: [registrationId] }] }
export const saveBatches = async (req, res) => {
  const ctx = await subjectContext(req, res);
  if (!ctx) return;
  const input = Array.isArray(req.body?.batches) ? req.body.batches : [];
  if (!input.length) return fail(res, 400, "Nothing to save.");
  const r = await arrange(req, ctx, input);
  res.status(r.status).json(r.body);
};

// GET /api/practicals/:id/batches – the practical time table of the exam
//   ?department=cs  batches conducted by that department
//   ?branch=cs      every batch a CS student sits in – the department's own exams and
//                   the other boards' exams – with `own`, the CS students of each batch
export const listBatches = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const filter = { exam: exam._id };
  const branch = lower(req.query.branch);
  if (branch) filter.$or = [{ department: branch }, { "students.department": branch }];
  else if (lower(req.query.department)) filter.department = lower(req.query.department);
  await syncOpen(req, filter);
  const batches = await PracticalBatch.find(filter).lean();
  batches.sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || (b.session || "").localeCompare(a.session || "") || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const pm = await panelMap(batches);
  res.json({
    exam: examView(exam),
    data: batches.map((b) => ({
      ...batchView(b, pm.get(String(b.panel)), { students: false }),
      own: branch ? b.students.filter((s) => s.department === branch).map((s) => ({ registerNumber: s.registerNumber, name: s.name })) : undefined,
    })),
  });
};

// ------------------------------------------------------------------ marks entry (examiners)

// GET /api/practicals/my – batches of the sets where I am the internal examiner
export const myBatches = async (req, res) => {
  const panels = await PracticalPanel.find({ "internal.clerkId": req.user.id }).lean();
  const filter = { panel: { $in: panels.map((p) => p._id) } };
  await syncOpen(req, filter);
  const batches = await PracticalBatch.find(filter).lean();
  batches.sort((a, b) => a.status.localeCompare(b.status) || (a.date || "9").localeCompare(b.date || "9") || (b.session || "").localeCompare(a.session || "") || a.label.localeCompare(b.label));
  const exams = await Exam.find({ _id: { $in: batches.map((b) => b.exam) } }).select("name").lean();
  const examOf = new Map(exams.map((e) => [String(e._id), e.name]));
  const pm = new Map(panels.map((p) => [String(p._id), p]));
  res.json({ data: batches.map((b) => ({ ...batchView(b, pm.get(String(b.panel)), { students: false }), examName: examOf.get(String(b.exam)) || "" })) });
};

async function loadBatch(req) {
  if (!isId(req.params.batchId)) return {};
  await syncOpen(req, { _id: req.params.batchId });
  const batch = await PracticalBatch.findById(req.params.batchId).lean();
  const panel = batch?.panel ? await PracticalPanel.findById(batch.panel).lean() : null;
  return { batch, panel };
}

// GET /api/practicals/batches/:batchId
export const getBatch = async (req, res) => {
  const { batch, panel } = await loadBatch(req);
  const role = req.user?.role;
  const mine = Boolean(batch) && isInternal(req, panel);
  const allowed = batch && (role === "admin" || role === "coe" || (role === "hod" && lower(req.user.department) === batch.department) || mine);
  if (!allowed) return fail(res, 404, "Batch not found.");
  const exam = await Exam.findById(batch.exam).select("name academicYear").lean();
  const unlocked = mine && batch.status === "OPEN" && isUnlocked(batch);
  // Marks are visible once submitted; before that only on the examiners' unlocked sheet
  const view = batchView(batch, panel, { marks: batch.status === "SUBMITTED" || unlocked });
  res.json({ data: { ...view, examName: exam?.name || "", isInternal: mine, unlocked } });
};

// Wrong tries are counted; after MAX_CODE_TRIES the COE must issue a new code
async function verifyCode(req, res, batch, panel, code) {
  const r = checkCode(panel.access, code);
  if (r.ok) return true;
  if (r.reason === "NONE") fail(res, 409, "The COE office has not issued the external examiner's code yet.");
  else if (r.reason === "LOCKED") fail(res, 423, "Too many wrong tries. Ask the COE office to issue a new code.");
  else {
    await PracticalPanel.updateOne({ _id: panel._id }, { $inc: { "access.fails": 1 } });
    await log(req, "PRACTICAL_CODE_WRONG", batch._id, { batch: batch.label, left: r.left });
    fail(res, 401, r.left > 0 ? `Wrong code. ${r.left} ${r.left > 1 ? "tries" : "try"} left.` : "Wrong code. The code is now locked – ask the COE office for a new one.");
  }
  return false;
}

async function entryBatch(req, res, { needUnlock = true } = {}) {
  const { batch, panel } = await loadBatch(req);
  if (!batch || !isInternal(req, panel)) return fail(res, 404, "Batch not found."), {};
  if (batch.status === "SUBMITTED") return fail(res, 409, "The marks of this batch are already submitted. They are final."), {};
  if (!batch.students.length) return fail(res, 409, "This batch has no students."), {};
  if (needUnlock && !isUnlocked(batch)) return fail(res, 403, "The external examiner must type his code to open the marks sheet."), {};
  return { batch, panel };
}

// POST /api/practicals/batches/:batchId/unlock  { code }
export const unlockBatch = async (req, res) => {
  const { batch, panel } = await entryBatch(req, res, { needUnlock: false });
  if (!batch) return;
  if (!(await verifyCode(req, res, batch, panel, req.body?.code))) return;
  const until = new Date(Date.now() + UNLOCK_HOURS * 3600 * 1000);
  await PracticalBatch.updateOne({ _id: batch._id }, { $set: { unlockedUntil: until } });
  await PracticalPanel.updateOne({ _id: panel._id }, { $set: { "access.fails": 0 } });
  await log(req, "PRACTICAL_SHEET_OPENED", batch._id, { batch: batch.label, external: panel.external.name });
  res.json({ message: "Marks sheet opened." });
};

const mergeRows = (batch, values) => {
  const byReg = new Map(values.map((v) => [v.registerNumber, v]));
  return batch.students.map((s) => ({ ...s, attendance: byReg.get(s.registerNumber).attendance, marks: byReg.get(s.registerNumber).marks }));
};

// PUT /api/practicals/batches/:batchId/marks  { rows: { "103CS26001": { attendance, marks } } }  – draft
export const saveDraft = async (req, res) => {
  const { batch } = await entryBatch(req, res);
  if (!batch) return;
  const check = checkSheet(batch.students, req.body?.rows || {}, batch.max, { complete: false });
  if (!check.ok) return fail(res, 400, `${check.errors.length} mark${check.errors.length > 1 ? "s are" : " is"} wrong.`, { errors: check.errors });
  await PracticalBatch.updateOne({ _id: batch._id, status: "OPEN" }, { $set: { students: mergeRows(batch, check.values) } });
  res.json({ message: "Draft saved. Nothing is final until you submit." });
};

// POST /api/practicals/batches/:batchId/submit  { rows, code }  – final
export const submitBatch = async (req, res) => {
  const { batch, panel } = await entryBatch(req, res);
  if (!batch) return;
  const check = checkSheet(batch.students, req.body?.rows || {}, batch.max);
  if (!check.ok) return fail(res, 400, `${check.errors.length} student${check.errors.length > 1 ? "s are" : " is"} missing or wrong.`, { errors: check.errors });
  if (!(await verifyCode(req, res, batch, panel, req.body?.code))) return;

  const now = new Date();
  const students = mergeRows(batch, check.values);
  await ExamRegistration.bulkWrite(registrationOps(batch, students, now), { ordered: false });
  const done = await PracticalBatch.updateOne(
    { _id: batch._id, status: "OPEN" },
    {
      $set: {
        students,
        status: "SUBMITTED",
        unlockedUntil: null,
        submitted: { at: now, by: who(req), internal: panel.internal.name, external: panel.external.name, college: panel.external.college },
      },
    }
  );
  if (!done.modifiedCount) return fail(res, 409, "The marks of this batch are already submitted.");
  await PracticalPanel.updateOne({ _id: panel._id }, { $set: { "access.fails": 0 } });
  const sum = sheetSummary(students);
  await log(req, "PRACTICAL_MARKS_SUBMITTED", batch._id, { batch: batch.label, internal: who(req), external: panel.external.name, ...sum });
  res.json({ message: `${batch.label} submitted: ${sum.present} present, ${sum.absent} absent, ${sum.malpractice} malpractice. The marks are final.` });
};

// ------------------------------------------------------------------ correction (Admin only)

// POST /api/practicals/batches/:batchId/correct  { registerNumber, attendance, marks, reason }
export const correctMark = async (req, res) => {
  if (!isId(req.params.batchId)) return fail(res, 400, "Invalid batch.");
  const batch = await PracticalBatch.findById(req.params.batchId).lean();
  if (!batch) return fail(res, 404, "Batch not found.");
  if (batch.status !== "SUBMITTED") return fail(res, 409, "This batch is not submitted yet. The examiners can still change it themselves.");
  const registerNumber = String(req.body?.registerNumber || "").trim().toUpperCase();
  const student = batch.students.find((s) => s.registerNumber === registerNumber);
  if (!student) return fail(res, 404, `${registerNumber} is not in this batch.`);
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) return fail(res, 400, "Write the reason for the correction.");
  const check = checkSheet([student], { [registerNumber]: { attendance: req.body?.attendance, marks: req.body?.marks } }, batch.max);
  if (!check.ok) return fail(res, 400, `Marks: ${check.errors[0].error}.`);
  const next = check.values[0];
  if (next.attendance === student.attendance && next.marks === student.marks) return fail(res, 400, "Nothing was changed.");

  const now = new Date();
  const from = { attendance: student.attendance, marks: student.marks };
  const to = { attendance: next.attendance, marks: next.marks };
  await PracticalBatch.updateOne(
    { _id: batch._id },
    {
      $set: { "students.$[s].attendance": to.attendance, "students.$[s].marks": to.marks },
      $push: { corrections: { registerNumber, from, to, reason, by: who(req), at: now } },
    },
    { arrayFilters: [{ "s.registerNumber": registerNumber }] }
  );
  await ExamRegistration.bulkWrite(registrationOps(batch, [{ ...student, ...to }], now));
  await log(req, "PRACTICAL_MARK_CORRECTED", batch._id, { batch: batch.label, registerNumber, from, to, reason });
  res.json({ message: `${registerNumber} corrected.` });
};
