// src/controllers/hallTicketController.js
//
// GET /api/exams/:id/hall-tickets?department=&semester=&q=&state=READY|NOT_READY&page=&limit=&print=1
// Returns the hall-ticket content for each registered student and whether it
// can be printed yet (see services/exams/hallTicket.js).

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Student from "../models/Student.js";
import AuditLog from "../models/AuditLog.js";
import { ticketFor } from "../services/exams/hallTicket.js";
import { ADMISSION_LABEL } from "../services/exams/rules.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error) => res.status(status).json({ error });

export const listHallTickets = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");

  const { department, semester, q, state } = req.query;
  const filter = { exam: exam._id };
  if (department === "backlog") filter.group = { $in: ["backlog", "manual"] };
  else if (department) filter.department = String(department).toLowerCase();
  if (semester && department !== "backlog") filter.semester = Number(semester);
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { registerNumber: rx }, { rollNumber: rx }];
  }

  const regs = await ExamRegistration.find(filter)
    .select("registerNumber rollNumber name department semester batch admissionType imageUrl group subjects overall warnings regularFee student")
    .sort({ semester: 1, department: 1, registerNumber: 1 })
    .lean();

  const tt = {
    entries: exam.timetable?.entries || [],
    sessions: {
      FN: exam.timetable?.sessions?.FN || { start: "10:00", end: "13:00" },
      AN: exam.timetable?.sessions?.AN || { start: "14:00", end: "17:00" },
    },
    published: Boolean(exam.timetable?.published),
  };

  let tickets = regs.map((r) => ({ reg: r, ...ticketFor(r, tt) }));
  const counts = { ready: tickets.filter((t) => t.ready).length, notReady: tickets.filter((t) => !t.ready).length };
  if (state === "READY") tickets = tickets.filter((t) => t.ready);
  else if (state === "NOT_READY") tickets = tickets.filter((t) => !t.ready);

  const limit = Math.min(Number(req.query.limit) || 40, 400);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const total = tickets.length;
  const pageItems = tickets.slice((page - 1) * limit, page * limit);

  // latest photo and parent name from the student record
  const students = await Student.find({ _id: { $in: pageItems.map((t) => t.reg.student) } })
    .select("imageUrl fatherName")
    .lean();
  const info = new Map(students.map((s) => [String(s._id), s]));

  if (req.query.print === "1") {
    AuditLog.create({
      action: "HALL_TICKETS_PRINTED",
      entity: "Exam",
      entityId: exam._id,
      actorClerkId: req.user?.id || "unknown",
      actorEmail: req.user?.email || "",
      actorRole: req.user?.role || "",
      details: { department: department || "", semester: semester || "", q: q || "", count: pageItems.filter((t) => t.ready).length },
    }).catch(() => {});
  }

  res.json({
    exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, semesters: exam.semesters },
    timetablePublished: tt.published,
    counts,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    data: pageItems.map(({ reg, ready, reasons, subjects, permittedCount }) => ({
      _id: reg._id,
      registerNumber: reg.registerNumber,
      rollNumber: reg.rollNumber,
      name: reg.name,
      fatherName: info.get(String(reg.student))?.fatherName || "",
      department: reg.department,
      semester: reg.semester,
      batch: reg.batch,
      admissionType: reg.admissionType,
      admissionLabel: ADMISSION_LABEL[reg.admissionType] || reg.admissionType,
      backPapersOnly: reg.group === "backlog" || reg.group === "manual",
      imageUrl: info.get(String(reg.student))?.imageUrl || reg.imageUrl || "",
      ready,
      reasons,
      permittedCount,
      subjects,
    })),
  });
};
