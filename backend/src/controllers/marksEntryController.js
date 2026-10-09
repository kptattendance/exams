// src/controllers/marksEntryController.js
//
// The exam clerk types valuers' award lists, one packet at a time.
// Only dummy numbers are ever shown here – never register numbers.
//
// With double entry (default):
//   1st typing → FIRST_DONE
//   2nd typing (blind – the first values are not shown) → VERIFIED if both match,
//   otherwise MISMATCH: only the differing dummy numbers are shown with both
//   values, the clerk checks the award list and types the correct mark.

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ValuationPacket from "../models/ValuationPacket.js";
import ValuationPaper from "../models/ValuationPaper.js";
import AnswerScript from "../models/AnswerScript.js";
import AuditLog from "../models/AuditLog.js";
import { parseMark, compareEntries } from "../services/exams/valuation.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const plain = (m) => (m instanceof Map ? Object.fromEntries(m) : { ...(m || {}) });

const NEED = { PENDING: "FIRST", FIRST_DONE: "SECOND", MISMATCH: "RESOLVE", VERIFIED: "DONE" };

async function decodedCodes(examIds) {
  const papers = await ValuationPaper.find({ exam: { $in: examIds }, decoded: true }).select("exam code").lean();
  return new Set(papers.map((p) => `${p.exam}|${p.code}`));
}

function packetView(p, exam, paper) {
  return {
    _id: p._id,
    number: p.number,
    code: p.code,
    paperName: paper?.name || "",
    round: p.round,
    count: p.dummies.length,
    valuer: p.valuer,
    status: p.status,
    need: NEED[p.status],
    rawMax: p.rawMax,
    exam: exam ? { _id: exam._id, name: exam.name } : null,
    updatedAt: p.updatedAt,
  };
}

// GET /api/marks-entry/packets?done=1
export const listEntryPackets = async (req, res) => {
  const exams = await Exam.find({ status: { $ne: "COMPLETED" } }).select("name valuation").lean();
  const examIds = exams.map((e) => e._id);
  const decoded = await decodedCodes(examIds);
  const filter = { exam: { $in: examIds }, status: req.query.done === "1" ? "VERIFIED" : { $ne: "VERIFIED" } };
  const packets = await ValuationPacket.find(filter)
    .select("-first -second -final -scripts")
    .sort(req.query.done === "1" ? { updatedAt: -1 } : { code: 1, round: 1, number: 1 })
    .limit(req.query.done === "1" ? 30 : 500)
    .lean();
  const papers = await ValuationPaper.find({ exam: { $in: examIds } }).select("exam code name").lean();
  const paperOf = new Map(papers.map((p) => [`${p.exam}|${p.code}`, p]));
  const examOf = new Map(exams.map((e) => [String(e._id), e]));
  res.json({
    data: packets
      .filter((p) => !decoded.has(`${p.exam}|${p.code}`))
      .map((p) => packetView(p, examOf.get(String(p.exam)), paperOf.get(`${p.exam}|${p.code}`))),
  });
};

// GET /api/marks-entry/find?number=25CS31T0-P03
export const findPacket = async (req, res) => {
  const number = String(req.query.number || "").trim().toUpperCase();
  if (!number) return fail(res, 400, "Type the packet number printed on the award list.");
  const p = await ValuationPacket.findOne({ number }).sort({ createdAt: -1 }).select("_id").lean();
  if (!p) return fail(res, 404, `No packet ${number}.`);
  res.json({ data: { _id: p._id } });
};

// GET /api/marks-entry/packets/:id
export const getEntryPacket = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid packet.");
  const p = await ValuationPacket.findById(req.params.id).lean();
  if (!p) return fail(res, 404, "Packet not found.");
  const [exam, paper] = await Promise.all([
    Exam.findById(p.exam).select("name valuation").lean(),
    ValuationPaper.findOne({ exam: p.exam, code: p.code }).select("name decoded").lean(),
  ]);
  const view = packetView(p, exam, paper);
  view.dummies = p.dummies;
  view.doubleEntry = exam?.valuation?.doubleEntry !== false;
  view.locked = Boolean(paper?.decoded);
  if (p.status === "MISMATCH") {
    const a = plain(p.first.marks);
    const b = plain(p.second.marks);
    view.mismatches = p.mismatches.map((d) => ({ dummy: d, first: a[d], second: b[d] }));
  }
  if (p.status === "VERIFIED") view.final = plain(p.final);
  res.json({ data: view });
};

// POST /api/marks-entry/packets/:id   { marks: { KQ4821: 67, ... } }
export const submitEntry = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid packet.");
  const p = await ValuationPacket.findById(req.params.id);
  if (!p) return fail(res, 404, "Packet not found.");
  const [exam, paper] = await Promise.all([
    Exam.findById(p.exam).select("valuation").lean(),
    ValuationPaper.findOne({ exam: p.exam, code: p.code }).lean(),
  ]);
  if (paper?.decoded) return fail(res, 409, "This paper is already decoded. Marks are locked.");
  if (p.status === "VERIFIED") return fail(res, 409, "This packet is already complete.");

  const input = req.body?.marks && typeof req.body.marks === "object" ? req.body.marks : {};
  const expect = p.status === "MISMATCH" ? p.mismatches : p.dummies;
  const values = {};
  const errors = [];
  for (const d of expect) {
    const r = parseMark(input[d], p.rawMax);
    if (!r.ok) errors.push({ dummy: d, error: r.error });
    else values[d] = r.value;
  }
  if (errors.length) return fail(res, 400, `${errors.length} mark${errors.length > 1 ? "s are" : " is"} missing or wrong.`, { errors });

  const doubleEntry = exam?.valuation?.doubleEntry !== false;
  const stamp = { by: who(req), at: new Date() };
  let message;

  if (p.status === "PENDING") {
    p.first = { ...stamp, marks: values };
    if (doubleEntry) {
      p.status = "FIRST_DONE";
      message = `First entry of ${p.number} saved. Now it must be typed once more (second entry) to check for typing mistakes.`;
    } else {
      p.final = values;
      p.status = "VERIFIED";
    }
  } else if (p.status === "FIRST_DONE") {
    p.second = { ...stamp, marks: values };
    const diff = compareEntries(plain(p.first.marks), values);
    if (diff.length) {
      p.status = "MISMATCH";
      p.mismatches = diff;
      message = `${diff.length} mark${diff.length > 1 ? "s differ" : " differs"} between the two entries. Check the award list and type the correct mark${diff.length > 1 ? "s" : ""}.`;
    } else {
      p.final = values;
      p.status = "VERIFIED";
    }
  } else if (p.status === "MISMATCH") {
    p.final = { ...plain(p.first.marks), ...values };
    p.status = "VERIFIED";
    p.mismatches = [];
  }

  if (p.status === "VERIFIED") {
    p.verifiedAt = new Date();
    const final = plain(p.final);
    const scripts = await AnswerScript.find({ _id: { $in: p.scripts } }).select("dummy").lean();
    await AnswerScript.bulkWrite(
      scripts.flatMap((s) => [
        { updateOne: { filter: { _id: s._id }, update: { $pull: { valuations: { round: p.round } } } } },
        {
          updateOne: {
            filter: { _id: s._id },
            update: { $push: { valuations: { round: p.round, marks: final[s.dummy], packet: p._id, at: new Date() } } },
          },
        },
      ]),
      { ordered: true }
    );
    message = `${p.number} is complete. ${scripts.length} marks saved.`;
  }

  p.markModified("first");
  p.markModified("second");
  p.markModified("final");
  await p.save();
  AuditLog.create({
    action: "VALUATION_MARKS_ENTERED",
    entity: "ValuationPacket",
    entityId: p._id,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    details: { packet: p.number, status: p.status },
  }).catch(() => {});
  res.json({ data: { status: p.status, need: NEED[p.status] }, message });
};
