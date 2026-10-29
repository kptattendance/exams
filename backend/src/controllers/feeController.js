// src/controllers/feeController.js
//
// Exam fee verification by the office.
//
// Every registered student owes:
//   - one REGULAR fee for his current-semester subjects (if he has any)
//   - one fee per BACK PAPER
// The office ticks each one with a receipt number, one student at a time or
// from an Excel sheet. A subject whose fee is unpaid will be printed as
// "Not permitted (fee not paid)" on the hall ticket.

import mongoose from "mongoose";
import XLSX from "xlsx";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import AuditLog from "../models/AuditLog.js";
import { feeItems, feeSummary, parsePays, ADMISSION_LABEL } from "../services/exams/rules.js";
import { recount } from "./examController.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const MAX_ROWS = 3000;

const logAction = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entity: "ExamFee",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

// Registrations made before fee verification existed have no feeStatus yet
async function ensureFeeStatus(examId) {
  const missing = await ExamRegistration.find({ exam: examId, feeStatus: { $exists: false } })
    .select("subjects.kind subjects.subject subjects.fee regularFee")
    .lean();
  if (!missing.length) return;
  await ExamRegistration.bulkWrite(
    missing.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { feeStatus: feeSummary(r).status } } } })),
    { ordered: false }
  );
}

function parseDate(v) {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel serial
  const s = String(v).trim();
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s); // 12-11-2026 (Indian order)
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function feeView(r) {
  const items = feeItems(r).map((i) => {
    const subj = i.type === "SUBJECT" ? r.subjects.find((s) => String(s.subject) === i.key) : null;
    return {
      key: i.key,
      type: i.type,
      code: i.code || "",
      label: i.label,
      paid: i.paid,
      receiptNo: i.fee.receiptNo || "",
      paidOn: i.fee.paidOn || null,
      by: i.fee.by || "",
      // so the office can see if a back paper is not permitted anyway
      eligibility: subj ? subj.effective : r.overall,
    };
  });
  return {
    _id: r._id,
    registerNumber: r.registerNumber,
    rollNumber: r.rollNumber,
    name: r.name,
    department: r.department,
    semester: r.semester,
    admissionType: r.admissionType,
    imageUrl: r.imageUrl,
    overall: r.overall,
    feeStatus: r.feeStatus,
    items,
    payments: (r.payments || []).map((p) => ({
      _id: p._id,
      txnNo: p.txnNo,
      amount: p.amount,
      paidOn: p.paidOn,
      note: p.note,
      source: p.source,
      by: p.by,
    })),
    amountPaid: amountPaid(r),
  };
}

const amountPaid = (r) => (r.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

function baseFilter(examId, query) {
  const filter = { exam: new mongoose.Types.ObjectId(examId), feeStatus: { $ne: "NONE" } };
  const { department, semester, q } = query;
  if (department === "backlog") filter.group = { $in: ["backlog", "manual"] };
  else if (department) filter.department = String(department).toLowerCase();
  if (semester && department !== "backlog") filter.semester = Number(semester);
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { registerNumber: rx }, { rollNumber: rx }];
  }
  return filter;
}

// GET /api/exams/:id/fees?department=&semester=&status=PAID|PARTIAL|UNPAID|PENDING&q=&page=
export const listFees = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).select("name academicYear semesters").lean();
  if (!exam) return fail(res, 404, "Exam not found.");
  await ensureFeeStatus(exam._id);

  const filter = baseFilter(req.params.id, req.query);
  const counts = await ExamRegistration.aggregate([{ $match: filter }, { $group: { _id: "$feeStatus", n: { $sum: 1 } } }]);

  const { status } = req.query;
  if (status === "PENDING") filter.feeStatus = { $in: ["PARTIAL", "UNPAID"] };
  else if (status === "ANY_PAID") filter.feeStatus = { $in: ["PAID", "PARTIAL"] };
  else if (["PAID", "PARTIAL", "UNPAID"].includes(status)) filter.feeStatus = status;
  // ?txn=none – marked paid but no transaction details yet; ?txn=some – details added
  if (req.query.txn === "none") filter["payments.0"] = { $exists: false };
  else if (req.query.txn === "some") filter["payments.0"] = { $exists: true };

  const limit = Math.min(Number(req.query.limit) || 40, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    ExamRegistration.find(filter)
      .sort({ semester: 1, department: 1, registerNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ExamRegistration.countDocuments(filter),
  ]);
  res.json({
    exam,
    data: items.map(feeView),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: Object.fromEntries(["PAID", "PARTIAL", "UNPAID"].map((k) => [k, counts.find((c) => c._id === k)?.n || 0])),
  });
};

// Apply paid / unpaid to some fee items of one registration (document, not saved)
function applyFee(reg, keys, { paid, receiptNo, paidOn, by }) {
  const changed = [];
  const value = paid
    ? { paid: true, receiptNo, paidOn, by, at: new Date() }
    : { paid: false, receiptNo: "", paidOn: null, by: "", at: null };
  for (const key of keys) {
    if (key === "REGULAR") {
      if (!reg.subjects.some((s) => s.kind !== "BACKLOG")) continue;
      if (Boolean(reg.regularFee?.paid) === paid) continue;
      reg.regularFee = value;
      changed.push("Regular fee");
    } else {
      const s = reg.subjects.find((x) => String(x.subject) === String(key) && x.kind === "BACKLOG");
      if (!s || Boolean(s.fee?.paid) === paid) continue;
      s.fee = value;
      changed.push(s.code);
    }
  }
  if (changed.length) {
    reg.markModified("subjects");
    reg.markModified("regularFee");
    recount(reg);
  }
  return changed;
}

// POST /api/exams/:id/registrations/:regId/fee
//   { keys: ["REGULAR", "<subjectId>"], paid: true,  receiptNo, paidOn }
//   { keys: [...],                      paid: false, reason }      – undo a wrong entry
export const recordFee = async (req, res) => {
  const { id, regId } = req.params;
  if (!isId(id) || !isId(regId)) return fail(res, 400, "Invalid id.");
  const reg = await ExamRegistration.findOne({ _id: regId, exam: id });
  if (!reg) return fail(res, 404, "Registration not found.");

  const keys = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : [];
  if (!keys.length) return fail(res, 400, "Tick at least one fee.");
  const paid = req.body?.paid !== false;

  let receiptNo = "";
  let paidOn = null;
  if (paid) {
    // Receipt number is optional: the office may just mark "paid" now and
    // add the transaction details later (Payments)
    receiptNo = String(req.body?.receiptNo || "").trim();
    if (receiptNo.length > 40) return fail(res, 400, "Receipt number is too long.");
    paidOn = parseDate(req.body?.paidOn);
    if (!paidOn) return fail(res, 400, "Payment date is not valid.");
    if (paidOn.getTime() > Date.now() + 86400000) return fail(res, 400, "Payment date cannot be in the future.");
  } else if (String(req.body?.reason || "").trim().length < 3) {
    return fail(res, 400, "Write why the payment is being removed.");
  }

  const changed = applyFee(reg, keys, { paid, receiptNo, paidOn, by: who(req) });
  if (!changed.length) return fail(res, 409, paid ? "Already marked as paid." : "Already unpaid.");
  await reg.save();
  await logAction(req, paid ? "EXAM_FEE_PAID" : "EXAM_FEE_REMOVED", reg.exam, {
    registration: reg._id,
    registerNumber: reg.registerNumber,
    items: changed,
    receiptNo,
    reason: paid ? "" : String(req.body.reason).trim(),
  });
  res.json({
    data: feeView(reg.toObject()),
    message: paid ? `Recorded ${changed.join(", ")} for ${reg.registerNumber}.` : `Removed ${changed.join(", ")} for ${reg.registerNumber}.`,
  });
};

// POST /api/exams/:id/fees/mark-paid   { regIds: [...] }
// Quick bulk "Paid": every unpaid fee of the chosen students, no receipt
// details (they can be added later under Payments).
export const markPaidBulk = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return fail(res, 400, "Invalid exam id.");
  //   { regIds }                       – ticked on the page
  //   { registerNumbers: [...] }       – pasted list (e.g. from the bank statement)
  //   { allPending: true, department, semester } – every not-fully-paid student of a class
  const regIds = (Array.isArray(req.body?.regIds) ? req.body.regIds : []).map(String).filter(isId);
  const numbers = [...new Set((Array.isArray(req.body?.registerNumbers) ? req.body.registerNumbers : []).map((n) => String(n).trim().toUpperCase()).filter(Boolean))];
  let filter;
  if (regIds.length) filter = { _id: { $in: regIds }, exam: id };
  else if (numbers.length) filter = { exam: id, registerNumber: { $in: numbers } };
  else if (req.body?.allPending) filter = { ...baseFilter(id, { department: req.body.department, semester: req.body.semester }), feeStatus: { $in: ["PARTIAL", "UNPAID"] } };
  else return fail(res, 400, "Select at least one student.");
  if (regIds.length > 500 || numbers.length > 2000) return fail(res, 400, "Too many students at a time.");

  const regs = await ExamRegistration.find(filter);
  if (regs.length > 2000) return fail(res, 400, "Too many students at a time – choose a class.");
  const notFound = numbers.length ? numbers.filter((n) => !regs.some((r) => r.registerNumber === n)) : [];
  const by = who(req);
  const paidOn = new Date();
  let students = 0;
  for (const reg of regs) {
    const keys = feeItems(reg.toObject()).filter((i) => !i.paid).map((i) => i.key);
    if (!keys.length) continue;
    const changed = applyFee(reg, keys, { paid: true, receiptNo: "", paidOn, by });
    if (!changed.length) continue;
    await reg.save();
    students++;
  }
  await logAction(req, "EXAM_FEE_PAID_BULK", id, {
    registrations: regs.length,
    marked: students,
    by: regIds.length ? "selection" : numbers.length ? "register numbers" : "class",
    notFound: notFound.slice(0, 50),
  });
  res.json({
    marked: students,
    notFound,
    message: `${students} student${students === 1 ? "" : "s"} marked as paid.${notFound.length ? ` ${notFound.length} register number${notFound.length === 1 ? " was" : "s were"} not found in this exam.` : ""}`,
  });
};

// POST /api/exams/:id/registrations/:regId/payments
//   { txnNo, amount, paidOn, note, source: "MANUAL" | "SCAN", keys?: [...] }
// Adds one transaction. With keys, those fees are also marked paid.
export const addPayment = async (req, res) => {
  const { id, regId } = req.params;
  if (!isId(id) || !isId(regId)) return fail(res, 400, "Invalid id.");
  const reg = await ExamRegistration.findOne({ _id: regId, exam: id });
  if (!reg) return fail(res, 404, "Registration not found.");

  const txnNo = String(req.body?.txnNo || "").trim();
  const amount = req.body?.amount === "" || req.body?.amount == null ? null : Number(req.body.amount);
  const note = String(req.body?.note || "").trim().slice(0, 200);
  if (!txnNo && amount === null) return fail(res, 400, "Enter the transaction number or the amount.");
  if (txnNo.length > 60) return fail(res, 400, "Transaction number is too long.");
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1000000)) return fail(res, 400, "Amount is not valid.");
  const paidOn = parseDate(req.body?.paidOn);
  if (!paidOn) return fail(res, 400, "Payment date is not valid.");
  if (paidOn.getTime() > Date.now() + 86400000) return fail(res, 400, "Payment date cannot be in the future.");

  // Same transaction number already used for another student in this exam?
  const duplicate = txnNo
    ? await ExamRegistration.findOne({ exam: id, _id: { $ne: reg._id }, "payments.txnNo": txnNo }).select("registerNumber").lean()
    : null;

  const by = who(req);
  reg.payments.push({ txnNo, amount, paidOn, note, source: req.body?.source === "SCAN" ? "SCAN" : "MANUAL", by, at: new Date() });

  const keys = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : [];
  const changed = keys.length ? applyFee(reg, keys, { paid: true, receiptNo: txnNo.slice(0, 40), paidOn, by }) : [];
  await reg.save();
  await logAction(req, "EXAM_FEE_PAYMENT_ADDED", reg.exam, {
    registration: reg._id,
    registerNumber: reg.registerNumber,
    txnNo,
    amount,
    items: changed,
  });
  res.json({
    data: feeView(reg.toObject()),
    message: `Payment added for ${reg.registerNumber}${changed.length ? ` · ${changed.join(", ")} marked paid` : ""}.`,
    warning: duplicate ? `Transaction ${txnNo} is also entered for ${duplicate.registerNumber}. Please check.` : "",
  });
};

// DELETE /api/exams/:id/registrations/:regId/payments/:paymentId
// Removes a wrongly entered transaction. Paid / not-paid is not changed.
export const deletePayment = async (req, res) => {
  const { id, regId, paymentId } = req.params;
  if (!isId(id) || !isId(regId) || !isId(paymentId)) return fail(res, 400, "Invalid id.");
  const reg = await ExamRegistration.findOne({ _id: regId, exam: id });
  if (!reg) return fail(res, 404, "Registration not found.");
  const p = reg.payments.id(paymentId);
  if (!p) return fail(res, 404, "Payment not found.");
  const removed = { txnNo: p.txnNo, amount: p.amount };
  p.deleteOne();
  await reg.save();
  await logAction(req, "EXAM_FEE_PAYMENT_REMOVED", reg.exam, { registration: reg._id, registerNumber: reg.registerNumber, ...removed });
  res.json({ data: feeView(reg.toObject()), message: "Payment removed." });
};

// ------------------------------------------------------------------ Excel

const COLS = ["Register Number", "Student Name", "Class", "To pay", "Pays", "Receipt No", "Paid On"];

// GET /api/exams/:id/fees/template – pending students, ready for the office to fill
export const feeTemplate = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");
  await ensureFeeStatus(exam._id);
  const filter = baseFilter(req.params.id, req.query);
  filter.feeStatus = { $in: ["PARTIAL", "UNPAID"] };
  const regs = await ExamRegistration.find(filter).sort({ semester: 1, department: 1, registerNumber: 1 }).lean();

  const rows = regs.map((r) => {
    const due = feeItems(r).filter((i) => !i.paid);
    return {
      "Register Number": r.registerNumber,
      "Student Name": r.name,
      Class: r.group === "backlog" || r.group === "manual" ? "Back papers" : `${r.department.toUpperCase()} Sem ${r.semester}`,
      "To pay": due.map((i) => (i.type === "REGULAR" ? "Regular" : i.code)).join(", "),
      Pays: "ALL",
      "Receipt No": "",
      "Paid On": "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(COLS.map((c) => [c, ""]))], { header: COLS });
  ws["!cols"] = [16, 30, 14, 28, 16, 14, 12].map((wch) => ({ wch }));
  const help = XLSX.utils.aoa_to_sheet([
    ["How to fill"],
    ["Fill Receipt No and Paid On (DD-MM-YYYY) only for students who have paid. Leave the others empty."],
    ["Pays: ALL = everything in “To pay”. Or write Regular and/or back-paper codes, e.g.  Regular, 25SC11T0"],
    ["Then upload this file in Fee verification → Upload Excel. You will see a preview before anything is saved."],
  ]);
  help["!cols"] = [{ wch: 110 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fees");
  XLSX.utils.book_append_sheet(wb, help, "Help");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="fee_pending_${exam.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 30)}.xlsx"`,
    "Cache-Control": "no-store",
  });
  res.send(buf);
};

// POST /api/exams/:id/fees/import?apply=1   (multipart "file")
// Without apply: preview only. With apply: saves the rows that are OK.
export const importFees = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  if (!req.file) return fail(res, 400, "Choose the Excel file.");
  const apply = req.query.apply === "1";

  let raw;
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
  } catch {
    return fail(res, 400, "Could not read this Excel file.");
  }
  // accept small differences in headings
  const norm = (k) => String(k).toLowerCase().replace(/[^a-z]/g, "");
  const pick = (row, ...names) => {
    for (const [k, v] of Object.entries(row)) if (names.includes(norm(k))) return v;
    return "";
  };
  const rows = raw
    .map((r, i) => ({
      row: i + 2,
      registerNumber: String(pick(r, "registernumber", "regno", "registerno")).trim().toUpperCase(),
      receiptNo: String(pick(r, "receiptno", "receiptnumber", "receipt")).trim(),
      paidOnRaw: pick(r, "paidon", "date", "paiddate", "paymentdate"),
      pays: pick(r, "pays", "paysfor", "paidfor"),
    }))
    .filter((r) => r.registerNumber && r.receiptNo); // rows without receipt = not paid yet
  if (!rows.length) return fail(res, 400, "No rows with a register number and receipt number were found.");
  if (rows.length > MAX_ROWS) return fail(res, 400, `At most ${MAX_ROWS} rows at a time.`);

  const regs = await ExamRegistration.find({ exam: req.params.id, registerNumber: { $in: rows.map((r) => r.registerNumber) } });
  const byReg = new Map(regs.map((r) => [r.registerNumber, r]));
  const seen = new Set();
  const result = [];
  const toSave = new Map();

  for (const r of rows) {
    const out = { row: r.row, registerNumber: r.registerNumber, receiptNo: r.receiptNo, state: "OK", message: "" };
    result.push(out);
    const reg = byReg.get(r.registerNumber);
    if (!reg) {
      Object.assign(out, { state: "ERROR", message: "Not registered for this exam." });
      continue;
    }
    out.name = reg.name;
    if (seen.has(r.registerNumber)) {
      Object.assign(out, { state: "ERROR", message: "Same register number appears twice in the file." });
      continue;
    }
    seen.add(r.registerNumber);
    const paidOn = parseDate(r.paidOnRaw);
    if (!paidOn || paidOn.getTime() > Date.now() + 86400000) {
      Object.assign(out, { state: "ERROR", message: "Paid On date is not valid." });
      continue;
    }
    const pays = parsePays(r.pays);
    const items = feeItems(reg.toObject());
    const unknown = pays.codes.filter((c) => !items.some((i) => i.code === c));
    if (unknown.length) {
      Object.assign(out, { state: "ERROR", message: `${unknown.join(", ")} is not a back paper of this student.` });
      continue;
    }
    const wanted = items.filter((i) => pays.all || (i.type === "REGULAR" ? pays.regular : pays.codes.includes(i.code)));
    if (!pays.all && pays.regular && !items.some((i) => i.type === "REGULAR")) {
      Object.assign(out, { state: "ERROR", message: "This student has no regular fee (back papers only)." });
      continue;
    }
    const due = wanted.filter((i) => !i.paid);
    out.items = due.map((i) => (i.type === "REGULAR" ? "Regular" : i.code));
    if (!due.length) {
      Object.assign(out, { state: "SKIP", message: "Already paid." });
      continue;
    }
    if (apply) {
      applyFee(reg, due.map((i) => i.key), { paid: true, receiptNo: r.receiptNo, paidOn, by: who(req) });
      toSave.set(String(reg._id), reg);
    }
  }

  if (apply && toSave.size) {
    await Promise.all([...toSave.values()].map((reg) => reg.save()));
    await logAction(req, "EXAM_FEE_IMPORTED", new mongoose.Types.ObjectId(req.params.id), {
      file: req.file.originalname,
      students: toSave.size,
    });
  }
  const summary = {
    ok: result.filter((r) => r.state === "OK").length,
    skipped: result.filter((r) => r.state === "SKIP").length,
    errors: result.filter((r) => r.state === "ERROR").length,
  };
  res.json({ applied: apply, summary, rows: result });
};

// GET /api/exams/:id/fees/export?status=PENDING – list for the notice board / follow-up
export const exportFees = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");
  await ensureFeeStatus(exam._id);
  const filter = baseFilter(req.params.id, req.query);
  if (req.query.status === "PENDING") filter.feeStatus = { $in: ["PARTIAL", "UNPAID"] };
  else if (["PAID", "PARTIAL", "UNPAID"].includes(req.query.status)) filter.feeStatus = req.query.status;
  const regs = await ExamRegistration.find(filter).sort({ semester: 1, department: 1, registerNumber: 1 }).lean();

  const rows = [];
  for (const r of regs) {
    for (const i of feeItems(r)) {
      if (req.query.status === "PENDING" && i.paid) continue;
      rows.push({
        "Register Number": r.registerNumber,
        "Student Name": r.name,
        Department: r.department.toUpperCase(),
        Semester: r.semester,
        "Admission Type": ADMISSION_LABEL[r.admissionType] || r.admissionType,
        Fee: i.type === "REGULAR" ? "Regular" : `Back paper ${i.code}`,
        Status: i.paid ? "Paid" : "Not paid",
        "Receipt No": i.fee.receiptNo || "",
        "Paid On": i.fee.paidOn ? new Date(i.fee.paidOn).toLocaleDateString("en-IN") : "",
        "Recorded By": i.fee.by || "",
        "Amount Paid (all transactions)": amountPaid(r) || "",
        Transactions: (r.payments || [])
          .map((p) => [p.txnNo, p.amount != null ? `Rs.${p.amount}` : "", p.paidOn ? new Date(p.paidOn).toLocaleDateString("en-IN") : ""].filter(Boolean).join(" "))
          .join("; "),
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "Nothing to show." }]);
  ws["!cols"] = [16, 30, 11, 9, 22, 22, 10, 14, 12, 28, 14, 50].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fees");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await logAction(req, "EXAM_FEE_EXPORTED", exam._id, { status: req.query.status || "ALL" });
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="fees_${req.query.status === "PENDING" ? "pending_" : ""}${exam.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 30)}.xlsx"`,
    "Cache-Control": "no-store",
  });
  res.send(buf);
};
