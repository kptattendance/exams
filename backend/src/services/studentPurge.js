// src/services/studentPurge.js
//
// Deletes students together with everything that refers to them (Admin only,
// after a one-time code sent by email – see controllers/studentPurgeController.js):
//
//   exam registrations, answer scripts (and their entries in valuation packets),
//   practical batch places, course results, elective choices, rows in the HOD's
//   Final IA / Final attendance sheets, links from student imports,
//   the photo on Cloudinary, any login, and the student record itself.

import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";

import cloudinary from "../config/cloudinary.js";
import Student from "../models/Student.js";
import ExamRegistration from "../models/ExamRegistration.js";
import AnswerScript from "../models/AnswerScript.js";
import ValuationPacket from "../models/ValuationPacket.js";
import PracticalBatch from "../models/PracticalBatch.js";
import CourseResult from "../models/CourseResult.js";
import StudentElective from "../models/StudentElective.js";
import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import StudentImport from "../models/StudentImport.js";

const oid = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

// How much would be deleted (shown before the code is asked for)
export async function purgeSummary(ids) {
  const _ids = oid(ids);
  const [students, registrations, scripts, results, electives, iaSheets, attendanceSheets] = await Promise.all([
    Student.find({ _id: { $in: _ids } }).select("registerNumber name").lean(),
    ExamRegistration.countDocuments({ student: { $in: _ids } }),
    AnswerScript.countDocuments({ student: { $in: _ids } }),
    CourseResult.countDocuments({ student: { $in: _ids } }),
    StudentElective.countDocuments({ student: { $in: _ids } }),
    FinalIA.countDocuments({ "students.studentId": { $in: _ids } }),
    FinalAttendance.countDocuments({ "students.studentId": { $in: _ids } }),
  ]);
  return {
    students: students.map((s) => ({ _id: String(s._id), registerNumber: s.registerNumber, name: s.name })),
    registrations,
    answerScripts: scripts,
    results,
    electives,
    iaSheets,
    attendanceSheets,
  };
}

export async function purgeStudents(ids) {
  const _ids = oid(ids);
  const students = await Student.find({ _id: { $in: _ids } }).select("registerNumber name clerkId imagePublicId").lean();
  const found = students.map((s) => s._id);
  const counts = {};

  // Exam side
  const regIds = (await ExamRegistration.find({ student: { $in: found } }).select("_id").lean()).map((r) => r._id);
  const scripts = await AnswerScript.find({ student: { $in: found } }).select("_id dummy").lean();
  const scriptIds = scripts.map((s) => s._id);
  const dummies = scripts.map((s) => s.dummy).filter(Boolean);

  // Take the scripts out of their valuation packets, with any marks typed for them
  const packets = scriptIds.length ? await ValuationPacket.find({ scripts: { $in: scriptIds } }) : [];
  for (const p of packets) {
    p.scripts = p.scripts.filter((id) => !scriptIds.some((x) => x.equals(id)));
    p.dummies = p.dummies.filter((d) => !dummies.includes(d));
    for (const d of dummies) {
      p.first?.marks?.delete?.(d);
      p.second?.marks?.delete?.(d);
      p.final?.delete?.(d);
    }
    p.mismatches = (p.mismatches || []).filter((d) => !dummies.includes(d));
    await p.save();
  }
  counts.packetsUpdated = packets.length;
  counts.answerScripts = (await AnswerScript.deleteMany({ _id: { $in: scriptIds } })).deletedCount;
  counts.practicalBatches = (
    await PracticalBatch.updateMany({ "students.registration": { $in: regIds } }, { $pull: { students: { registration: { $in: regIds } } } })
  ).modifiedCount;
  counts.registrations = (await ExamRegistration.deleteMany({ _id: { $in: regIds } })).deletedCount;
  counts.results = (await CourseResult.deleteMany({ student: { $in: found } })).deletedCount;

  // Department side
  counts.electives = (await StudentElective.deleteMany({ student: { $in: found } })).deletedCount;
  counts.iaSheets = (
    await FinalIA.updateMany({ "students.studentId": { $in: found } }, { $pull: { students: { studentId: { $in: found } } } })
  ).modifiedCount;
  counts.attendanceSheets = (
    await FinalAttendance.updateMany({ "students.studentId": { $in: found } }, { $pull: { students: { studentId: { $in: found } } } })
  ).modifiedCount;
  await StudentImport.updateMany(
    { "rows.student": { $in: found } },
    { $set: { "rows.$[r].student": null, "rows.$[r].state": "UNDONE" } },
    { arrayFilters: [{ "r.student": { $in: found } }] }
  );

  // Photos and logins (failures are listed, the records are still removed)
  const warnings = [];
  await Promise.all(
    students.map(async (s) => {
      if (s.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(s.imagePublicId);
        } catch (e) {
          warnings.push(`Photo of ${s.registerNumber}: ${e.message}`);
        }
      }
      if (s.clerkId) {
        try {
          await clerkClient.users.deleteUser(s.clerkId);
        } catch (e) {
          if (e?.status !== 404) warnings.push(`Login of ${s.registerNumber}: ${e.message}`);
        }
      }
    })
  );
  counts.photos = students.filter((s) => s.imagePublicId).length;

  counts.students = (await Student.deleteMany({ _id: { $in: found } })).deletedCount;
  return {
    counts,
    warnings,
    students: students.map((s) => ({ registerNumber: s.registerNumber, name: s.name })),
  };
}
