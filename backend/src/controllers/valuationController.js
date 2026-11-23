// src/controllers/valuationController.js
//
// Paper valuation (hard-copy) for one written paper of an exam – ATS coding:
//
//   1. Candidates  – every student permitted to write the paper
//   2. Rooms       – the Chief Examiner saves the rooms; every room diary (one
//                    paper in one room) gets a random 6-digit number and each
//                    student a shuffled 2-digit serial: ATS = 482715-07
//                    (examSessionController). The ATS is printed in the diary.
//   3. Attendance  – the Chief Examiner (or the office) marks the absentees
//   4. Packets     – AUTOMATIC when the session is over: each room diary becomes
//                    its packet (same number, P-0007) with its present scripts
//   5. Valuation   – ONE valuation per script. The COE sticks the packet number
//                    over the ATS number on the envelope (packet labels); the
//                    valuer sees only the packet number and the last 2 digits
//                    of the ATS on each script. The award list and the clerk's
//                    marks entry show the same: packet number + 2-digit serial.
//                    The clerk types each award list twice (marksEntryController)
//   6. Decode      – AUTOMATIC when every packet of the paper is typed and checked:
//                    the marks go to the register numbers, reduced to the theory maximum

import crypto from "node:crypto";
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
import RoomDiary from "../models/RoomDiary.js";
import { ML_MAX, finalMarks, fmtAts, reduce, valuationsOf } from "../services/exams/valuation.js";
import { printWindow } from "../services/examDay.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const codeOf = (req) => String(req.params.code || "").toUpperCase();
const isTrial = () => String(process.env.MONGO_DB_NAME || "").endsWith("_trial");

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

export async function getPaper(exam, code) {
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
  const packets = await ValuationPacket.find({ exam: examId, code }).select("number round scripts status").lean();
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

// ------------------------------------------------------------------ automatic coding & decoding

const system = (action, examId, details) =>
  AuditLog.create({ action, entity: "Valuation", entityId: examId, actorClerkId: "system", actorEmail: "", actorRole: "system", details }).catch(() => {});

// the paper's session is over (published time table, IST)
export function sessionOver(exam, code, now = Date.now()) {
  const e = (exam.timetable?.entries || []).find((x) => x.code === code);
  if (!e?.date || !e?.session) return false;
  return now > printWindow(e, exam.timetable?.sessions).closesAt.getTime();
}


// The packet of every room diary = its present scripts (absent and malpractice
// are left out – printed AB / MP on the award list). A packet with no marks typed
// yet follows attendance changes.
export async function syncPackets(exam, paper) {
  const code = paper.code;
  const [diaries, scripts, packets] = await Promise.all([
    RoomDiary.find({ exam: exam._id, code }).select("number").lean(),
    AnswerScript.find({ exam: exam._id, code, attendance: "PRESENT", dummy: { $type: "string" } }).select("_id dummy diary").lean(),
    ValuationPacket.find({ exam: exam._id, code }),
  ]);
  const byNumber = new Map(packets.map((p) => [p.number, p]));
  const want = new Map(); // packet number -> its present scripts in ATS order
  for (const d of diaries) {
    const mine = scripts.filter((x) => String(x.diary) === String(d._id)).sort((a, b) => a.dummy.localeCompare(b.dummy));
    if (mine.length) want.set(d.number, mine);
  }
  const same = (p, list) => p.dummies.length === list.length && p.dummies.every((x, i) => x === list[i].dummy);
  const creates = [];
  for (const [number, list] of want) {
    const p = byNumber.get(number);
    if (!p) {
      creates.push({ exam: exam._id, code, round: 1, number, scripts: list.map((x) => x._id), dummies: list.map((x) => x.dummy), rawMax: paper.rawMax });
      continue;
    }
    if (p.status !== "PENDING" || same(p, list)) continue;
    p.scripts = list.map((x) => x._id);
    p.dummies = list.map((x) => x.dummy);
    await p.save();
  }
  // packets of diaries that are gone or now have nobody present (only while no marks are typed)
  const gone = packets.filter((p) => p.status === "PENDING" && !want.has(p.number));
  if (gone.length) await ValuationPacket.deleteMany({ _id: { $in: gone.map((p) => p._id) } });
  if (creates.length) await ValuationPacket.insertMany(creates);
}

// When the session is over: every room diary becomes its packet. Waits (and says
// why) while a present student has no room (no ATS). -> "" or the reason it waits
export async function autoCode(exam, paper) {
  if (paper.coded) return "";
  if (!sessionOver(exam, paper.code)) return "";
  await syncCandidates(exam, paper);
  const noRoom = await AnswerScript.find({ exam: exam._id, code: paper.code, attendance: "PRESENT", dummy: null }).select("registerNumber").lean();
  if (noRoom.length)
    return `${noRoom.length} present student${noRoom.length === 1 ? " is" : "s are"} not in any room (no ATS): ${noRoom
      .slice(0, 8)
      .map((x) => x.registerNumber)
      .join(", ")}${noRoom.length > 8 ? " …" : ""}. Mark ${noRoom.length === 1 ? "him / her" : "them"} absent, or the Admin puts ${noRoom.length === 1 ? "him / her" : "them"} in a room.`;
  await syncPackets(exam, paper);
  paper.coded = true;
  paper.codedAt = new Date();
  await paper.save();
  await system("VALUATION_PAPER_CODED", exam._id, { code: paper.code, packets: await ValuationPacket.countDocuments({ exam: exam._id, code: paper.code, round: 1 }) });
  return "";
}

// every paper of the exam whose session is over gets its packets
export async function autoCodeExam(exam, codes) {
  const over = codes.filter((c) => sessionOver(exam, c));
  if (!over.length) return;
  const done = new Set((await ValuationPaper.find({ exam: exam._id, code: { $in: over }, coded: true }).select("code").lean()).map((p) => p.code));
  for (const c of over) {
    if (done.has(c)) continue;
    const paper = await getPaper(exam, c);
    if (paper) await autoCode(exam, paper);
  }
}

// Decoding, automatically: every packet of the paper typed and checked. -> true when decoded
export async function autoDecode(exam, paper) {
  if (!paper?.coded || paper.decoded) return false;
  const code = paper.code;
  if (await ValuationPacket.exists({ exam: exam._id, code, status: { $ne: "VERIFIED" } })) return false;
  const percent = exam.valuation?.thirdValuationPercent ?? 15;
  const [scripts, { map }] = await Promise.all([AnswerScript.find({ exam: exam._id, code }).lean(), expectedRounds(exam._id, code)]);
  const results = scripts.map((x) => ({ s: x, r: scriptResult(x, [...(map.get(String(x._id)) || [])], paper, percent) }));
  if (results.some((x) => x.r.status !== "DONE")) return false;
  const now = new Date();
  if (results.length)
    await ExamRegistration.bulkWrite(
      results.map(({ s: x, r }) => ({
        updateOne: {
          filter: { _id: x.registration },
          update: {
            $set: {
              "subjects.$[x].see": {
                attendance: x.attendance,
                raw: x.attendance === "PRESENT" ? r.raw : null,
                marks: x.attendance === "PRESENT" ? reduce(r.raw, paper.rawMax, paper.seeMax) : null,
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
  paper.decodedBy = "automatic";
  await paper.save();
  await system("VALUATION_PAPER_DECODED", exam._id, { code, scripts: scripts.length });
  return true;
}

// The attendance of these scripts may change only while their packets have no
// marks typed. changed: scripts { code, registerNumber, diary, dummy }, toPresent:
// register numbers that become PRESENT. -> "" or why not
export async function attendanceBlocked(exam, changed, toPresent = []) {
  if (!changed.length) return "";
  const codes = [...new Set(changed.map((x) => x.code))];
  const decoded = await ValuationPaper.find({ exam: exam._id, code: { $in: codes }, decoded: true }).select("code").lean();
  if (decoded.length) return `${decoded.map((p) => p.code).join(", ")} is already decoded. Attendance can no longer be changed.`;
  // once the packets are made, a student with no ATS (not in any room) cannot be present
  const coded = new Set((await ValuationPaper.find({ exam: exam._id, code: { $in: codes }, coded: true }).select("code").lean()).map((p) => p.code));
  const noAts = changed.filter((x) => coded.has(x.code) && !x.dummy && toPresent.includes(x.registerNumber)).map((x) => x.registerNumber);
  if (noAts.length) return `${noAts.join(", ")} was not in any room (no ATS number), so cannot be marked present.`;
  const diaryIds = [...new Set(changed.filter((x) => x.diary).map((x) => String(x.diary)))];
  if (!diaryIds.length) return "";
  const numbers = (await RoomDiary.find({ _id: { $in: diaryIds } }).select("number").lean()).map((d) => d.number);
  const typed = await ValuationPacket.find({ exam: exam._id, number: { $in: numbers }, status: { $ne: "PENDING" } }).select("number").lean();
  if (typed.length)
    return `Marks are already typed for packet ${typed.map((p) => p.number).join(", ")}. Ask the Admin to reopen the packet first.`;
  return "";
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
  await autoCodeExam(exam, papers.map((p) => p.code)); // packets of every paper whose session is over
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
      stage: d?.decoded ? "DECODED" : !d?.coded ? "ATTENDANCE" : "VALUATION",
    };
  });
  out.sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || a.code.localeCompare(b.code));
  res.json({ exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, valuation: exam.valuation || {} }, data: out });
};

// Create / update the list of scripts from who is permitted to write
export async function syncCandidates(exam, paper) {
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
  if (!paper) return fail(res, 404, `Course ${code} not found.`);
  let waiting = "";
  if (!paper.coded) {
    await syncCandidates(exam, paper); // list follows eligibility / fee until the packets are made
    waiting = await autoCode(exam, paper);
  } else if (!paper.decoded) {
    await autoDecode(exam, paper); // self-healing: normally done when the last packet is typed
  }

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
  const diaries = await RoomDiary.find({ exam: exam._id, code }).select("room number").lean();
  const roomOf = new Map(diaries.map((d) => [String(d._id), d.room]));
  const numberRoom = new Map(diaries.map((d) => [d.number, String(d._id)]));

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
        room: roomOf.get(String(s.diary)) || "",
      })),
      packets: (await ValuationPacket.find({ exam: exam._id, code }).select("number round status valuer scripts mismatches").sort({ round: 1, number: 1 }).lean()).map((p) => ({
        _id: p._id,
        number: p.number,
        round: p.round,
        status: p.status,
        valuer: p.valuer,
        count: p.scripts.length,
        mismatches: p.mismatches.length,
        room: roomOf.get(numberRoom.get(p.number)) || "",
      })),
      summary,
      present: scripts.filter((s) => s.attendance === "PRESENT").length,
      // why the packets are not made yet (after the session)
      waiting,
      // TRIAL DATABASE ONLY (local copy): the page may end the session at once
      trial: String(process.env.MONGO_DB_NAME || "").endsWith("_trial"),
      sessionOver: sessionOver(exam, code),
    },
  });
};

// PATCH /api/exams/:id/valuation/:code   { rawMax }   (until marks are typed)
export const updatePaper = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const paper = await getPaper(exam, codeOf(req));
  if (!paper) return fail(res, 404, "Paper not found.");
  if (paper.decoded) return fail(res, 409, "Already decoded.");
  if (await ValuationPacket.exists({ exam: exam._id, code: paper.code, status: { $ne: "PENDING" } }))
    return fail(res, 409, "Marks are already typed for this paper. The paper maximum can no longer be changed.");
  if (req.body?.rawMax !== undefined) {
    const v = Number(req.body.rawMax);
    if (!(v >= 1 && v <= ML_MAX)) return fail(res, 400, `Paper maximum must be between 1 and ${ML_MAX}.`);
    paper.rawMax = v;
    await ValuationPacket.updateMany({ exam: exam._id, code: paper.code }, { $set: { rawMax: v } });
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
  const norm = (l) => [...new Set((Array.isArray(l) ? l : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
  const absent = norm(req.body?.absent);
  const malpractice = norm(req.body?.malpractice);
  const both = absent.filter((x) => malpractice.includes(x));
  if (both.length) return fail(res, 400, `${both.join(", ")} cannot be both absent and malpractice.`);

  const scripts = await AnswerScript.find({ exam: exam._id, code }).select("code registerNumber attendance diary dummy").lean();
  const known = new Set(scripts.map((s) => s.registerNumber));
  const unknown = [...absent, ...malpractice].filter((x) => !known.has(x));
  if (unknown.length) return fail(res, 400, `Not a candidate for ${code}: ${unknown.join(", ")}`);
  const next = (n) => (absent.includes(n) ? "ABSENT" : malpractice.includes(n) ? "MALPRACTICE" : "PRESENT");
  const changing = scripts.filter((x) => x.attendance !== next(x.registerNumber));
  const blocked = await attendanceBlocked(exam, changing, changing.filter((x) => next(x.registerNumber) === "PRESENT").map((x) => x.registerNumber));
  if (blocked) return fail(res, 409, blocked);

  await AnswerScript.updateMany({ exam: exam._id, code }, { $set: { attendance: "PRESENT" } });
  if (absent.length) await AnswerScript.updateMany({ exam: exam._id, code, registerNumber: { $in: absent } }, { $set: { attendance: "ABSENT" } });
  if (malpractice.length)
    await AnswerScript.updateMany({ exam: exam._id, code, registerNumber: { $in: malpractice } }, { $set: { attendance: "MALPRACTICE" } });
  if (paper.coded) await syncPackets(exam, paper); // the packets follow the attendance
  await log(req, "VALUATION_ATTENDANCE_SAVED", exam._id, { code, absent: absent.length, malpractice: malpractice.length });
  res.json({ message: `Saved: ${scripts.length - absent.length - malpractice.length} present, ${absent.length} absent, ${malpractice.length} malpractice.` });
};

// GET /api/exams/:id/valuation/:code/coding-sheet – ATS ↔ register number (COE / ACOE / Admin only, confidential)
export const codingSheet = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper) return fail(res, 404, "No room is allotted for this paper yet.");
  const [scripts, diaries] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code }).sort({ registerNumber: 1 }).select("registerNumber name attendance dummy diary").lean(),
    RoomDiary.find({ exam: exam._id, code }).select("room number").lean(),
  ]);
  const diaryOf = new Map(diaries.map((d) => [String(d._id), d]));
  await log(req, "VALUATION_CODING_SHEET_VIEWED", exam._id, { code });
  res.json({
    data: {
      exam: { name: exam.name },
      paper: { code, name: paper.name },
      rows: scripts.map((s) => ({
        registerNumber: s.registerNumber,
        name: s.name,
        attendance: s.attendance,
        ats: fmtAts(s.dummy),
        room: diaryOf.get(String(s.diary))?.room || "",
        packet: diaryOf.get(String(s.diary))?.number || "",
      })),
    },
  });
};

// GET /api/exams/:id/valuation/:code/slips – award lists to print: the packet number
// and the last 2 digits of each ATS only (the 6-digit ATS is never shown to a valuer)
export const packetSlips = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.coded) return fail(res, 409, "The packets of this paper are made after its session.");
  const filter = { exam: exam._id, code };
  if (req.query.packet && isId(req.query.packet)) filter._id = req.query.packet;
  const packets = await ValuationPacket.find(filter).sort({ round: 1, number: 1 }).lean();
  // every serial of the room diary; absent / malpractice printed (not valued)
  const diaries = await RoomDiary.find({ exam: exam._id, code }).select("number room date session").lean();
  const diaryOf = new Map(diaries.map((d) => [d.number, d]));
  const others = await AnswerScript.find({ exam: exam._id, code, attendance: { $ne: "PRESENT" }, diary: { $ne: null } }).select("dummy diary attendance").lean();
  const notPresent = new Map(); // diary id -> [{ ats, mark }]
  for (const x of others) {
    const k = String(x.diary);
    if (!notPresent.has(k)) notPresent.set(k, []);
    notPresent.get(k).push({ ats: x.dummy, mark: x.attendance === "ABSENT" ? "AB" : "MP" });
  }
  res.json({
    data: {
      exam: { name: exam.name },
      paper: { code, name: paper.name, rawMax: paper.rawMax },
      packets: packets.map((p) => {
        const d = diaryOf.get(p.number);
        // TRIAL DATABASE ONLY: the award list shows the sample marks, for the decoding demo
        const shown = isTrial() ? p.final || {} : {};
        // absent / malpractice: also a script marked AB on the award list after typing
        const away = d ? notPresent.get(String(d._id)) || [] : [];
        const awayMark = new Map(away.map((x) => [x.ats, x.mark]));
        const rows = p.dummies.map((a) => ({ ats: a, mark: awayMark.get(a) ?? shown[a] ?? "" }));
        rows.push(...away.filter((x) => !p.dummies.includes(x.ats)));
        rows.sort((a, b) => String(a.ats).localeCompare(String(b.ats)));
        return {
          _id: p._id,
          number: p.number,
          round: p.round,
          valuer: p.valuer,
          date: d?.date || "",
          session: d?.session || "",
          present: p.dummies.filter((a) => !awayMark.has(a)).length,
          rows: rows.map((r) => ({ serial: String(r.ats).slice(6), mark: r.mark })),
        };
      }),
    },
  });
};

// ---------------- TRIAL DATABASE ONLY: never available on the real website ----------------

// POST /api/exams/:id/valuation/:code/trial-fill – sample marks in every packet not typed
// yet (first and second entry equal), then the normal automatic decoding
export const trialFillMarks = async (req, res) => {
  if (!isTrial()) return fail(res, 404, "Not found.");
  const exam = await loadExam(req, res);
  if (!exam) return;
  const paper = await getPaper(exam, codeOf(req));
  if (!paper?.coded) return fail(res, 409, "End the session first, so that the packets are made.");
  if (paper.decoded) return fail(res, 409, "This paper is already decoded.");
  const packets = await ValuationPacket.find({ exam: exam._id, code: paper.code, status: { $ne: "VERIFIED" } });
  const stamp = { by: "trial sample marks", at: new Date() };
  for (const p of packets) {
    const low = Math.round(paper.rawMax * 0.2);
    const high = Math.round(paper.rawMax * 0.95);
    const values = Object.fromEntries(p.dummies.map((d) => [d, crypto.randomInt(low, high + 1)]));
    p.first = { ...stamp, marks: values };
    p.second = { ...stamp, marks: values };
    p.final = values;
    p.mismatches = [];
    p.status = "VERIFIED";
    p.verifiedAt = new Date();
    p.markModified("first");
    p.markModified("second");
    p.markModified("final");
    await p.save();
    const scripts = await AnswerScript.find({ _id: { $in: p.scripts } }).select("dummy").lean();
    await AnswerScript.bulkWrite(
      scripts.flatMap((s) => [
        { updateOne: { filter: { _id: s._id }, update: { $pull: { valuations: { round: p.round } } } } },
        { updateOne: { filter: { _id: s._id }, update: { $push: { valuations: { round: p.round, marks: values[s.dummy], packet: p._id, at: new Date() } } } } },
      ]),
      { ordered: true }
    );
  }
  const decoded = await autoDecode(exam, await ValuationPaper.findOne({ exam: exam._id, code: paper.code }));
  res.json({ message: decoded ? `Sample marks filled in ${packets.length} packets, and the paper is decoded.` : "Sample marks filled, but the paper could not be decoded yet." });
};

// GET /api/exams/:id/valuation/:code/trial-decoding – for each ATS: the mark awarded in
// its packet beside the mark that reached the register number after decoding
export const trialDecoding = async (req, res) => {
  if (!isTrial()) return fail(res, 404, "Not found.");
  const exam = await loadExam(req, res);
  if (!exam) return;
  const code = codeOf(req);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code }).lean();
  if (!paper?.decoded) return fail(res, 409, "The paper is not decoded yet.");
  const [packets, scripts, regs] = await Promise.all([
    ValuationPacket.find({ exam: exam._id, code, round: 1 }).select("number dummies final").lean(),
    AnswerScript.find({ exam: exam._id, code, dummy: { $type: "string" } }).select("registerNumber name dummy registration attendance").lean(),
    ExamRegistration.find({ exam: exam._id, "subjects.code": code }).select("subjects.code subjects.see").lean(),
  ]);
  const scriptOf = new Map(scripts.map((s) => [s.dummy, s]));
  const seeOf = new Map(regs.map((r) => [String(r._id), r.subjects.find((x) => x.code === code)?.see]));
  const rows = [];
  for (const p of [...packets].sort((a, b) => a.number.localeCompare(b.number)))
    for (const ats of [...p.dummies].sort()) {
      const s = scriptOf.get(ats);
      const see = s ? seeOf.get(String(s.registration)) : null;
      const awarded = p.final?.[ats] ?? null;
      rows.push({ packet: p.number, ats: fmtAts(ats), awarded, registerNumber: s?.registerNumber || "", name: s?.name || "", decoded: awarded === "AB" && see?.attendance === "ABSENT" ? "AB" : see?.raw ?? null, marks: see?.marks ?? null, ok: awarded === "AB" ? see?.attendance === "ABSENT" : awarded !== null && awarded === see?.raw });
    }
  res.json({ data: { rawMax: paper.rawMax, seeMax: paper.seeMax, total: rows.length, matched: rows.filter((r) => r.ok).length, rows } });
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
  // those marked AB on this award list are in the packet again until it is retyped
  const typedAb = [...(p.final?.entries?.() || [])].filter(([, v]) => v === "AB").map(([ats]) => ats);
  if (typedAb.length) await AnswerScript.updateMany({ _id: { $in: p.scripts }, dummy: { $in: typedAb }, attendance: "ABSENT" }, { $set: { attendance: "PRESENT" } });
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
      ats: fmtAts(s.dummy),
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
        ATS: r.ats || "",
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

// ------------------------------------------------------------------ packet tracker & ATS lookup

// GET /api/exams/:id/valuation-packets – every packet of the exam and where it is
// (filled in automatically – nothing to tick). No register numbers.
export const packetTracker = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const [diaries, packets, papers, scripts] = await Promise.all([
    RoomDiary.find({ exam: exam._id }).select("date session room code number").lean(),
    ValuationPacket.find({ exam: exam._id }).select("number round status valuer dummies verifiedAt").lean(),
    ValuationPaper.find({ exam: exam._id }).select("code name coded decoded").lean(),
    AnswerScript.aggregate([
      { $match: { exam: exam._id, diary: { $ne: null } } },
      { $group: { _id: { diary: "$diary", attendance: "$attendance" }, n: { $sum: 1 } } },
    ]),
  ]);
  const paperOf = new Map(papers.map((p) => [p.code, p]));
  const count = (id, a) => scripts.find((x) => String(x._id.diary) === String(id) && x._id.attendance === a)?.n || 0;
  const packetOf = new Map(packets.map((p) => [p.number, p]));
  const rows = diaries.map((d) => {
    const paper = paperOf.get(d.code);
    const p = packetOf.get(d.number);
    const present = count(d._id, "PRESENT");
    let stage;
    if (paper?.decoded) stage = "DECODED";
    else if (!paper?.coded) stage = "EXAM"; // packets are made after the session
    else if (!present || !p) stage = "ALL_ABSENT";
    else if (p.status === "MISMATCH") stage = "MISMATCH";
    else if (p.status === "VERIFIED") stage = "CHECKED";
    else if (p.status === "FIRST_DONE") stage = "TYPING";
    else stage = "WITH_VALUER";
    return {
      number: d.number,
      code: d.code,
      name: paper?.name || "",
      date: d.date,
      session: d.session,
      room: d.room,
      allotted: present + count(d._id, "ABSENT") + count(d._id, "MALPRACTICE"),
      present,
      absent: count(d._id, "ABSENT"),
      malpractice: count(d._id, "MALPRACTICE"),
      valuer: p?.valuer || "",
      stage,
    };
  });
  rows.sort((a, b) => a.number.localeCompare(b.number));
  res.json({ exam: { _id: exam._id, name: exam.name }, data: rows });
};

// GET /api/exams/:id/ats/:ats – which packet an ATS (6 or 8 digits) belongs to. No names.
export const atsLookup = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const raw = String(req.params.ats || "").replace(/\D/g, "");
  if (raw.length !== 6 && raw.length !== 8) return fail(res, 400, "Type the 6-digit ATS number (or all 8 digits).");
  const d = await RoomDiary.findOne({ exam: exam._id, base: raw.slice(0, 6) }).select("date session room code number serials").lean();
  if (!d) return fail(res, 404, `No room diary has the ATS number ${raw.slice(0, 6)} in ${exam.name}.`);
  const paper = await ValuationPaper.findOne({ exam: exam._id, code: d.code }).select("name").lean();
  const serials = Object.values(d.serials || {});
  const serial = raw.length === 8 ? raw.slice(6) : "";
  res.json({
    data: {
      ats: raw.length === 8 ? fmtAts(raw) : raw,
      number: d.number,
      code: d.code,
      name: paper?.name || "",
      date: d.date,
      session: d.session,
      room: d.room,
      students: serials.length,
      // an 8-digit ATS whose serial is not in the diary is a mis-copied one
      serialFound: serial ? serials.includes(serial) : null,
    },
  });
};

// GET /api/exams/:id/packet-labels?date=&session=&code=  (COE / ACOE / Admin)
// The labels the COE sticks over the ATS number on each envelope: packet number,
// paper and number of scripts – no ATS. Plus the matching list ATS -> packet,
// in the same order, for the COE only.
export const packetLabels = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const filter = { exam: exam._id };
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || ""))) filter.date = req.query.date;
  if (["FN", "AN"].includes(req.query.session)) filter.session = req.query.session;
  if (req.query.code) filter.code = String(req.query.code).toUpperCase();
  const [diaries, papers, counts] = await Promise.all([
    RoomDiary.find(filter).select("date session code number base serials").lean(),
    ValuationPaper.find({ exam: exam._id }).select("code name").lean(),
    AnswerScript.aggregate([{ $match: { exam: exam._id, diary: { $ne: null }, attendance: "PRESENT" } }, { $group: { _id: "$diary", n: { $sum: 1 } } }]),
  ]);
  const nameOf = new Map(papers.map((p) => [p.code, p.name]));
  const present = new Map(counts.map((c) => [String(c._id), c.n]));
  const rows = diaries
    .map((d) => ({
      ats: d.base,
      number: d.number,
      code: d.code,
      name: nameOf.get(d.code) || "",
      date: d.date,
      session: d.session,
      allotted: Object.keys(d.serials || {}).length,
      present: present.get(String(d._id)) ?? null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session) || a.ats.localeCompare(b.ats));
  await log(req, "VALUATION_PACKET_LABELS_VIEWED", exam._id, { packets: rows.length });
  res.json({ exam: { _id: exam._id, name: exam.name }, data: rows });
};
