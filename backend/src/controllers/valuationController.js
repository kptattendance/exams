// src/controllers/valuationController.js
//
// Paper valuation (hard-copy) for one written paper of an exam:
//
//   1. Candidates  – every student permitted to write the paper
//   2. Attendance  – exam section marks absentees / malpractice
//   3. Coding      – random dummy numbers, scripts bundled into packets of ~30
//   4. Valuation   – valuers mark scripts on paper and fill award lists;
//                    the exam clerk types them in (see marksEntryController)
//                    2nd valuation on chosen packets; 3rd when 1st & 2nd
//                    differ by more than 15 %
//   5. Decode      – COE links dummy numbers back to register numbers and the
//                    marks (out of 100) are reduced to the theory maximum

import mongoose from "mongoose";
import XLSX from "xlsx";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Subject from "../models/Subject.js";
import ValuationPaper from "../models/ValuationPaper.js";
import AnswerScript from "../models/AnswerScript.js";
import ValuationPacket from "../models/ValuationPacket.js";
import AuditLog from "../models/AuditLog.js";
import { effectiveOf, subjectFeePaid } from "../services/exams/rules.js";
import { buildPapers } from "../services/exams/timetable.js";
import { makeDummies, shuffle, packetize, finalMarks, reduce, valuationsOf } from "../services/exams/valuation.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const codeOf = (req) => String(req.params.code || "").toUpperCase();

const log = (req, action, examId, details = {}) =>
  AuditLog.create({
    action,
    entity: "Valuation",
    entityId: examId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details,
  }).catch(() => {});

async function loadExam(req, res) {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  return exam;
}

async function getPaper(exam, code) {
  let paper = await ValuationPaper.findOne({ exam: exam._id, code });
  if (paper) return paper;
  const subject = await Subject.findOne({ code }).select("name theoryExamMax theoryExamMin").lean();
  if (!subject) return null;
  paper = await ValuationPaper.create({
    exam: exam._id,
    code,
    name: subject.name,
    seeMax: subject.theoryExamMax || 0,
    seeMin: subject.theoryExamMin || 0,
  });
  return paper;
}

// Which rounds each script must have, from the packets it is in
async function expectedRounds(examId, code) {
  const packets = await ValuationPacket.find({ exam: examId, code }).select("round scripts status").lean();
  const map = new Map();
  for (const p of packets) for (const s of p.scripts) {
    const k = String(s);
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(p.round);
  }
  return { packets, map };
}

function scriptResult(script, rounds, paper, percent) {
  if (script.attendance !== "PRESENT") return { status: "DONE", raw: null, attendance: script.attendance };
  const v = valuationsOf(script);
  for (const r of rounds || []) if (v[`v${r}`] === undefined) return { status: "WAITING", reason: `Valuation ${r} not entered.` };
  return finalMarks(v, { rawMax: paper.rawMax, percent });
}

// ------------------------------------------------------------------ overview

// GET /api/exams/:id/valuation – every written paper with its progress
export const listPapers = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const regs = await ExamRegistration.find({ exam: exam._id })
    .select("department subjects.code subjects.name subjects.semester subjects.kind subjects.hasTheory")
    .lean();
  const { papers } = buildPapers(regs);
  const [docs, scriptStats, packetStats] = await Promise.all([
    ValuationPaper.find({ exam: exam._id }).lean(),
    AnswerScript.aggregate([
      { $match: { exam: exam._id } },
      { $group: { _id: { code: "$code", attendance: "$attendance" }, n: { $sum: 1 } } },
    ]),
    ValuationPacket.aggregate([
      { $match: { exam: exam._id } },
      { $group: { _id: { code: "$code", status: "$status" }, n: { $sum: 1 } } },
    ]),
  ]);
  const byCode = new Map(docs.map((d) => [d.code, d]));
  const slot = new Map((exam.timetable?.entries || []).map((e) => [e.code, e]));
  const out = papers.map((p) => {
    const d = byCode.get(p.code);
    const sc = (a) => scriptStats.find((x) => x._id.code === p.code && x._id.attendance === a)?.n || 0;
    const pk = (s) => packetStats.find((x) => x._id.code === p.code && x._id.status === s)?.n || 0;
    const packets = pk("PENDING") + pk("FIRST_DONE") + pk("MISMATCH") + pk("VERIFIED");
    return {
      code: p.code,
      name: p.name,
      departments: p.departments,
      semesters: p.semesters,
      candidates: d ? sc("PRESENT") + sc("ABSENT") + sc("MALPRACTICE") : null,
      absent: sc("ABSENT"),
      malpractice: sc("MALPRACTICE"),
      date: slot.get(p.code)?.date || "",
      session: slot.get(p.code)?.session || "",
      coded: Boolean(d?.coded),
      decoded: Boolean(d?.decoded),
      packets,
      packetsVerified: pk("VERIFIED"),
      stage: d?.decoded ? "DECODED" : !d?.coded ? "ATTENDANCE" : packets && pk("VERIFIED") === packets ? "READY" : "VALUATION",
    };
  });
  out.sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || a.code.localeCompare(b.code));
  res.json({ exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, valuation: exam.valuation || {} }, data: out });
};

// Create / update the list of scripts from who is permitted to write
async function syncCandidates(exam, paper) {
  const regs = await ExamRegistration.find({ exam: exam._id, "subjects.code": paper.code })
    .select("student registerNumber name department semester regularFee subjects")
    .lean();
  const permitted = [];
  for (const r of regs) {
    const s = r.subjects.find((x) => x.code === paper.code);
    if (!s?.hasTheory) continue;
    if (effectiveOf(s) !== "ELIGIBLE" || !subjectFeePaid(r, s)) continue;
    permitted.push({ r, s });
  }
  const existing = await AnswerScript.find({ exam: exam._id, code: paper.code }).select("registration").lean();
  const have = new Set(existing.map((x) => String(x.registration)));
  const want = new Set(permitted.map((x) => String(x.r._id)));
  const toAdd = permitted.filter((x) => !have.has(String(x.r._id)));
  if (toAdd.length) {
    await AnswerScript.insertMany(
      toAdd.map(({ r, s }) => ({
        exam: exam._id,
        code: paper.code,
        registration: r._id,
        student: r.student,
        registerNumber: r.registerNumber,
        name: r.name,
        department: r.department,
        semester: r.semester,
        kind: s.kind,
      })),
      { ordered: false }
    );
  }
  const gone = existing.filter((x) => !want.has(String(x.registration))).map((x) => x._id);
  if (gone.length) await AnswerScript.deleteMany({ _id: { $in: gone } });
  return { added: toAdd.length, removed: gone.length };
}

// GET /api/exams/:id/valuation/:code – one paper: candidates, packets, progress
export const getPaperDetail = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await getPaper(exam, code);
  if (!paper) return fail(res, 404, `Subject ${code} not found.`);
  if (!paper.coded) await syncCandidates(exam, paper); // list follows eligibility / fee until coding

  const [scripts, { map }] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code }).sort({ registerNumber: 1 }).lean(),
    expectedRounds(exam._id, code),
  ]);
  const percent = exam.valuation?.thirdValuationPercent ?? 15;
  const summary = { DONE: 0, WAITING: 0, NEEDS_THIRD: 0 };
  for (const s of scripts) {
    if (s.attendance !== "PRESENT" || !paper.coded) continue;
    const r = scriptResult(s, [...(map.get(String(s._id)) || [])], paper, percent);
    summary[r.status] = (summary[r.status] || 0) + 1;
  }
  const slot = (exam.timetable?.entries || []).find((e) => e.code === code);

  res.json({
    data: {
      exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, doubleEntry: exam.valuation?.doubleEntry !== false, thirdValuationPercent: percent },
      paper: { ...paper.toObject(), date: slot?.date || "", session: slot?.session || "" },
      // register numbers are shown only to COE / Exam Officer, and only for attendance
      candidates: scripts.map((s) => ({
        _id: s._id,
        registerNumber: s.registerNumber,
        name: s.name,
        department: s.department,
        semester: s.semester,
        kind: s.kind,
        attendance: s.attendance,
      })),
      packets: (await ValuationPacket.find({ exam: exam._id, code }).select("number round status valuer scripts mismatches").sort({ round: 1, number: 1 }).lean()).map((p) => ({
        _id: p._id,
        number: p.number,
        round: p.round,
        status: p.status,
        valuer: p.valuer,
        count: p.scripts.length,
        mismatches: p.mismatches.length,
      })),
      summary,
      present: scripts.filter((s) => s.attendance === "PRESENT").length,
    },
  });
};

// PATCH /api/exams/:id/valuation/:code   { rawMax, packetSize }   (before coding)
export const updatePaper = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const paper = await getPaper(exam, codeOf(req));
  if (!paper) return fail(res, 404, "Paper not found.");
  if (paper.coded) return fail(res, 409, "Already coded. Undo coding first.");
  if (req.body?.rawMax !== undefined) {
    const v = Number(req.body.rawMax);
    if (!(v >= 1 && v <= 500)) return fail(res, 400, "Paper maximum must be between 1 and 500.");
    paper.rawMax = v;
  }
  if (req.body?.packetSize !== undefined) {
    const v = Number(req.body.packetSize);
    if (!(v >= 5 && v <= 100)) return fail(res, 400, "Packet size must be between 5 and 100.");
    paper.packetSize = v;
  }
  await paper.save();
  res.json({ data: paper, message: "Saved." });
};

// POST /api/exams/:id/valuation/:code/attendance  { absent: ["103CS25001"], malpractice: [] }
export const saveAttendance = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await getPaper(exam, code);
  if (!paper) return fail(res, 404, "Paper not found.");
  if (paper.coded) return fail(res, 409, "Attendance is locked because the paper is already coded. Undo coding to change it.");
  const norm = (l) => [...new Set((Array.isArray(l) ? l : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
  const absent = norm(req.body?.absent);
  const malpractice = norm(req.body?.malpractice);
  const both = absent.filter((x) => malpractice.includes(x));
  if (both.length) return fail(res, 400, `${both.join(", ")} cannot be both absent and malpractice.`);

  const scripts = await AnswerScript.find({ exam: exam._id, code }).select("registerNumber").lean();
  const known = new Set(scripts.map((s) => s.registerNumber));
  const unknown = [...absent, ...malpractice].filter((x) => !known.has(x));
  if (unknown.length) return fail(res, 400, `Not a candidate for ${code}: ${unknown.join(", ")}`);

  await AnswerScript.updateMany({ exam: exam._id, code }, { $set: { attendance: "PRESENT" } });
  if (absent.length) await AnswerScript.updateMany({ exam: exam._id, code, registerNumber: { $in: absent } }, { $set: { attendance: "ABSENT" } });
  if (malpractice.length)
    await AnswerScript.updateMany({ exam: exam._id, code, registerNumber: { $in: malpractice } }, { $set: { attendance: "MALPRACTICE" } });
  await log(req, "VALUATION_ATTENDANCE_SAVED", exam._id, { code, absent: absent.length, malpractice: malpractice.length });
  res.json({ message: `Saved: ${scripts.length - absent.length - malpractice.length} present, ${absent.length} absent, ${malpractice.length} malpractice.` });
};

// POST /api/exams/:id/valuation/:code/coding   – dummy numbers + round-1 packets
export const codePaper = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await getPaper(exam, code);
  if (!paper) return fail(res, 404, "Paper not found.");
  if (paper.coded) return fail(res, 409, "This paper is already coded.");
  await syncCandidates(exam, paper);

  const present = await AnswerScript.find({ exam: exam._id, code, attendance: "PRESENT" }).select("_id").lean();
  if (!present.length) return fail(res, 400, "No candidates present for this paper.");

  const taken = new Set(await AnswerScript.distinct("dummy", { exam: exam._id, dummy: { $type: "string" } }));
  const dummies = makeDummies(present.length, taken);
  const order = shuffle(present.map((s, i) => ({ id: s._id, dummy: dummies[i] })));

  await AnswerScript.bulkWrite(order.map((o) => ({ updateOne: { filter: { _id: o.id }, update: { $set: { dummy: o.dummy } } } })), { ordered: false });
  const groups = packetize(order, paper.packetSize || 30);
  await ValuationPacket.insertMany(
    groups.map((g, i) => {
      const sorted = [...g].sort((a, b) => a.dummy.localeCompare(b.dummy));
      return {
        exam: exam._id,
        code,
        round: 1,
        number: `${code}-P${String(i + 1).padStart(2, "0")}`,
        scripts: sorted.map((o) => o.id),
        dummies: sorted.map((o) => o.dummy),
        rawMax: paper.rawMax,
      };
    })
  );
  paper.coded = true;
  paper.codedAt = new Date();
  paper.attendanceLocked = true;
  await paper.save();
  await log(req, "VALUATION_PAPER_CODED", exam._id, { code, scripts: present.length, packets: groups.length });
  res.json({ message: `${present.length} scripts coded into ${groups.length} packets.` });
};

// POST /api/exams/:id/valuation/:code/coding/undo – only before any marks are typed
export const undoCoding = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await getPaper(exam, code);
  if (!paper?.coded) return fail(res, 409, "This paper is not coded.");
  if (paper.decoded) return fail(res, 409, "Already decoded.");
  const started = await ValuationPacket.exists({ exam: exam._id, code, status: { $ne: "PENDING" } });
  if (started) return fail(res, 409, "Marks are already entered for some packets. Coding can no longer be undone.");
  await ValuationPacket.deleteMany({ exam: exam._id, code });
  await AnswerScript.updateMany({ exam: exam._id, code }, { $set: { dummy: null, valuations: [] } });
  paper.coded = false;
  paper.codedAt = null;
  paper.attendanceLocked = false;
  await paper.save();
  await log(req, "VALUATION_CODING_UNDONE", exam._id, { code });
  res.json({ message: "Coding undone. Attendance can be changed again." });
};

// GET /api/exams/:id/valuation/:code/coding-sheet – COE only, keep confidential
export const codingSheet = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.coded) return fail(res, 409, "This paper is not coded yet.");
  const [scripts, packets] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code }).sort({ registerNumber: 1 }).select("registerNumber name attendance dummy").lean(),
    ValuationPacket.find({ exam: exam._id, code, round: 1 }).select("number scripts").lean(),
  ]);
  const packetOf = new Map();
  for (const p of packets) for (const s of p.scripts) packetOf.set(String(s), p.number);
  await log(req, "VALUATION_CODING_SHEET_VIEWED", exam._id, { code });
  res.json({
    data: {
      exam: { name: exam.name },
      paper: { code, name: paper.name },
      rows: scripts.map((s) => ({ registerNumber: s.registerNumber, name: s.name, attendance: s.attendance, dummy: s.dummy, packet: packetOf.get(String(s._id)) || "" })),
    },
  });
};

// GET /api/exams/:id/valuation/:code/slips?round=1 – award lists to print (dummy numbers only)
export const packetSlips = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.coded) return fail(res, 409, "This paper is not coded yet.");
  const filter = { exam: exam._id, code };
  if (req.query.round) filter.round = Number(req.query.round);
  if (req.query.packet && isId(req.query.packet)) filter._id = req.query.packet;
  const packets = await ValuationPacket.find(filter).sort({ round: 1, number: 1 }).lean();
  res.json({
    data: {
      exam: { name: exam.name },
      paper: { code, name: paper.name, rawMax: paper.rawMax },
      packets: packets.map((p) => ({ _id: p._id, number: p.number, round: p.round, valuer: p.valuer, dummies: p.dummies })),
    },
  });
};

// PATCH /api/exams/:id/valuation/packets/:packetId  { valuer }
export const setValuer = async (req, res) => {
  if (!isId(req.params.packetId)) return fail(res, 400, "Invalid packet.");
  const valuer = String(req.body?.valuer || "").trim().slice(0, 80);
  const p = await ValuationPacket.findOneAndUpdate({ _id: req.params.packetId, exam: req.params.id }, { $set: { valuer } }, { returnDocument: "after" }).lean();
  if (!p) return fail(res, 404, "Packet not found.");
  res.json({ message: valuer ? `${p.number} given to ${valuer}.` : "Valuer cleared." });
};

// POST /api/exams/:id/valuation/packets/:packetId/reopen  – correct a verified packet (before decoding)
export const reopenPacket = async (req, res) => {
  if (!isId(req.params.packetId)) return fail(res, 400, "Invalid packet.");
  const p = await ValuationPacket.findOne({ _id: req.params.packetId, exam: req.params.id });
  if (!p) return fail(res, 404, "Packet not found.");
  const paper = await ValuationPaper.findOne({ exam: p.exam, code: p.code }).lean();
  if (paper?.decoded) return fail(res, 409, "The paper is already decoded.");
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 3) return fail(res, 400, "Write why the packet is reopened.");
  await AnswerScript.updateMany({ _id: { $in: p.scripts } }, { $pull: { valuations: { round: p.round } } });
  p.status = "PENDING";
  p.first = { by: "", at: null, marks: {} };
  p.second = { by: "", at: null, marks: {} };
  p.final = {};
  p.mismatches = [];
  p.verifiedAt = null;
  await p.save();
  await log(req, "VALUATION_PACKET_REOPENED", p.exam, { packet: p.number, reason });
  res.json({ message: `${p.number} reopened. Its marks must be typed again.` });
};

// POST /api/exams/:id/valuation/:code/second  { all: true } or { packetIds: [...] }
export const sendSecondValuation = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.coded) return fail(res, 409, "Code the paper first.");
  if (paper.decoded) return fail(res, 409, "Already decoded.");
  const filter = { exam: exam._id, code, round: 1 };
  if (!req.body?.all) {
    const ids = (req.body?.packetIds || []).filter(isId);
    if (!ids.length) return fail(res, 400, "Choose the packets for second valuation.");
    filter._id = { $in: ids };
  }
  const firsts = await ValuationPacket.find(filter).lean();
  const existing = new Set((await ValuationPacket.find({ exam: exam._id, code, round: 2 }).select("number").lean()).map((p) => p.number));
  const create = firsts
    .filter((p) => !existing.has(`${p.number}-V2`))
    .map((p) => ({ exam: exam._id, code, round: 2, number: `${p.number}-V2`, scripts: p.scripts, dummies: p.dummies, rawMax: p.rawMax }));
  if (!create.length) return fail(res, 409, "These packets are already sent for second valuation.");
  await ValuationPacket.insertMany(create);
  await log(req, "VALUATION_SECOND_CREATED", exam._id, { code, packets: create.length });
  res.json({ message: `${create.length} packet${create.length > 1 ? "s" : ""} sent for second valuation.` });
};

// POST /api/exams/:id/valuation/:code/third – packets for scripts whose 1st & 2nd differ too much
export const createThirdValuation = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.coded) return fail(res, 409, "Code the paper first.");
  if (paper.decoded) return fail(res, 409, "Already decoded.");
  const percent = exam.valuation?.thirdValuationPercent ?? 15;
  const [scripts, { map }] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code, attendance: "PRESENT" }).lean(),
    expectedRounds(exam._id, code),
  ]);
  const need = scripts.filter((s) => {
    const rounds = map.get(String(s._id)) || new Set();
    if (rounds.has(3)) return false;
    return scriptResult(s, [...rounds], paper, percent).status === "NEEDS_THIRD";
  });
  if (!need.length) return fail(res, 409, "No script needs a third valuation right now.");
  const already = await ValuationPacket.countDocuments({ exam: exam._id, code, round: 3 });
  const groups = packetize(
    need.map((s) => ({ id: s._id, dummy: s.dummy })).sort((a, b) => a.dummy.localeCompare(b.dummy)),
    paper.packetSize || 30
  );
  await ValuationPacket.insertMany(
    groups.map((g, i) => ({
      exam: exam._id,
      code,
      round: 3,
      number: `${code}-T${String(already + i + 1).padStart(2, "0")}`,
      scripts: g.map((o) => o.id),
      dummies: g.map((o) => o.dummy),
      rawMax: paper.rawMax,
    }))
  );
  await log(req, "VALUATION_THIRD_CREATED", exam._id, { code, scripts: need.length });
  res.json({ message: `${need.length} scripts need a third valuation – ${groups.length} packet${groups.length > 1 ? "s" : ""} created.` });
};

// POST /api/exams/:id/valuation/:code/decode
export const decodePaper = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code });
  if (!paper?.coded) return fail(res, 409, "Code the paper first.");
  const percent = exam.valuation?.thirdValuationPercent ?? 15;

  const unverified = await ValuationPacket.countDocuments({ exam: exam._id, code, status: { $ne: "VERIFIED" } });
  if (unverified) return fail(res, 409, `${unverified} packet${unverified > 1 ? "s are" : " is"} not fully entered yet.`);

  const [scripts, { map }] = await Promise.all([AnswerScript.find({ exam: exam._id, code }).lean(), expectedRounds(exam._id, code)]);
  const results = scripts.map((s) => ({ s, r: scriptResult(s, [...(map.get(String(s._id)) || [])], paper, percent) }));
  const third = results.filter((x) => x.r.status === "NEEDS_THIRD").length;
  if (third) return fail(res, 409, `${third} scripts need a third valuation first.`);
  const waiting = results.filter((x) => x.r.status === "WAITING").length;
  if (waiting) return fail(res, 409, `${waiting} scripts are still waiting for marks.`);

  const now = new Date();
  await ExamRegistration.bulkWrite(
    results.map(({ s, r }) => ({
      updateOne: {
        filter: { _id: s.registration },
        update: {
          $set: {
            "subjects.$[x].see": {
              attendance: s.attendance,
              raw: s.attendance === "PRESENT" ? r.raw : null,
              marks: s.attendance === "PRESENT" ? reduce(r.raw, paper.rawMax, paper.seeMax) : null,
              decodedAt: now,
            },
          },
        },
        arrayFilters: [{ "x.code": code }],
      },
    })),
    { ordered: false }
  );
  paper.decoded = true;
  paper.decodedAt = now;
  paper.decodedBy = who(req);
  await paper.save();
  await log(req, "VALUATION_PAPER_DECODED", exam._id, { code, scripts: scripts.length });
  res.json({ message: `${code} decoded. Marks of ${scripts.length} candidates are now with their register numbers.` });
};

// GET /api/exams/:id/valuation/:code/marks  (after decoding)  ?format=xlsx
export const paperMarks = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.decoded) return fail(res, 409, "Marks are shown only after the paper is decoded.");
  const percent = exam.valuation?.thirdValuationPercent ?? 15;
  const [scripts, { map }] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code }).sort({ registerNumber: 1 }).lean(),
    expectedRounds(exam._id, code),
  ]);
  const rows = scripts.map((s) => {
    const v = valuationsOf(s);
    const r = scriptResult(s, [...(map.get(String(s._id)) || [])], paper, percent);
    return {
      registerNumber: s.registerNumber,
      name: s.name,
      department: s.department,
      semester: s.semester,
      dummy: s.dummy,
      attendance: s.attendance,
      v1: v.v1 ?? null,
      v2: v.v2 ?? null,
      v3: v.v3 ?? null,
      raw: r.raw ?? null,
      marks: s.attendance === "PRESENT" ? reduce(r.raw, paper.rawMax, paper.seeMax) : null,
    };
  });
  if (req.query.format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        "Register Number": r.registerNumber,
        "Student Name": r.name,
        Department: String(r.department).toUpperCase(),
        Semester: r.semester,
        "Dummy No": r.dummy || "",
        Attendance: r.attendance,
        "Valuation 1": r.v1 ?? "",
        "Valuation 2": r.v2 ?? "",
        "Valuation 3": r.v3 ?? "",
        [`Final / ${paper.rawMax}`]: r.raw ?? (r.attendance === "ABSENT" ? "AB" : r.attendance === "MALPRACTICE" ? "MP" : ""),
        [`SEE / ${paper.seeMax}`]: r.marks ?? "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, code);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SEE_${code}.xlsx"`,
      "Cache-Control": "no-store",
    });
    return res.send(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
  res.json({ data: { paper: { code, name: paper.name, rawMax: paper.rawMax, seeMax: paper.seeMax, seeMin: paper.seeMin }, rows } });
};

// PATCH /api/exams/:id/valuation-settings  { doubleEntry, thirdValuationPercent }
export const updateValuationSettings = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const set = {};
  if (req.body?.doubleEntry !== undefined) set["valuation.doubleEntry"] = Boolean(req.body.doubleEntry);
  if (req.body?.thirdValuationPercent !== undefined) {
    const v = Number(req.body.thirdValuationPercent);
    if (!(v >= 1 && v <= 50)) return fail(res, 400, "Percentage must be between 1 and 50.");
    set["valuation.thirdValuationPercent"] = v;
  }
  await Exam.updateOne({ _id: exam._id }, { $set: set });
  await log(req, "VALUATION_SETTINGS_CHANGED", exam._id, set);
  res.json({ message: "Saved." });
};
