"use client";

// Exam section (office) – practical examination sheets.
//   view="room-diary"   one diary per lab and session: batches, students, examiners
//   view="mark-sheets"  blank ML (mark list) entry sheets, one per batch
//   view="report"       per subject: how many students' marks are entered / pending
// Every view downloads as Excel, or as PDF (print page → Save as PDF).

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { T } from "../ui/table";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, batchState, dept, fmtDay, sessionLabel, usePracticalExams } from "./practicalShared";

const VIEWS = {
  "room-diary": {
    title: "Room diary",
    help: "One diary for each lab and session – the batches, their students and the examiners. Print it and keep it in the lab.",
    sheet: "room-diary",
  },
  "mark-sheets": {
    title: "ML entry sheets",
    help: "Blank mark-list (ML) entry sheets, one for each batch, for the examiners to write the marks by hand.",
    sheet: "ml",
  },
  report: {
    title: "Practical marks status",
    help: "For every subject: how many students' marks have been entered (submitted by the examiners) and how many are pending.",
    sheet: "status",
  },
};

export const STATUS = {
  ENTERED: { label: "Entered", chip: "bg-emerald-50 text-emerald-700" },
  PARTLY: { label: "Partly entered", chip: "bg-orange-50 text-orange-700" },
  PENDING: { label: "Pending", chip: "bg-red-50 text-red-700" },
  NOT_SCHEDULED: { label: "No batches yet", chip: "bg-slate-100 text-slate-600" },
};

// Batches that share a lab in one session
export function roomsOf(batches) {
  const rooms = new Map();
  for (const b of batches) {
    const key = `${b.date || ""}|${b.session || ""}|${b.lab || ""}`;
    if (!rooms.has(key)) rooms.set(key, { key, date: b.date, session: b.session, lab: b.lab, batches: [] });
    rooms.get(key).batches.push(b);
  }
  return [...rooms.values()];
}

// Shared filters (department that conducts the exam, date, subject status)
export function filterOffice(data, { department = "", date = "", status = "" }) {
  const batches = (data?.batches || []).filter((b) => (!department || b.department === department) && (!date || b.date === date));
  const subjects = (data?.subjects || []).filter((s) => (!department || s.department === department) && (!status || s.status === status));
  return { batches, subjects };
}

const attendanceText = (s) => (s.attendance === "PRESENT" ? "P" : s.attendance === "ABSENT" ? "AB" : s.attendance === "MALPRACTICE" ? "MP" : "");

export default function OfficePractical({ view }) {
  const V = VIEWS[view];
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId } = usePracticalExams();
  const [data, setData] = useState(null);
  const [department, setDepartment] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api("get", `/practicals/${examId}/office`)
      .then((r) => alive && setData(r.data))
      .catch((e) => {
        if (!alive) return;
        setData({ batches: [], subjects: [] });
        toast.error(errMsg(e, "Could not load the practical exams."));
      });
    return () => {
      alive = false;
    };
  }, [api, examId, toast]);

  const departments = useMemo(
    () => [...new Set([...(data?.batches || []).map((b) => b.department), ...(data?.subjects || []).map((s) => s.department)].filter(Boolean))].sort(),
    [data]
  );
  const dates = useMemo(() => [...new Set((data?.batches || []).map((b) => b.date).filter(Boolean))].sort(), [data]);
  const { batches, subjects } = filterOffice(data, { department, date, status });
  const rooms = roomsOf(batches);

  const examName = data?.exam?.name || "";
  const fileTag = [department.toUpperCase(), date].filter(Boolean).join("_") || "all";

  const openPdf = () => {
    const q = new URLSearchParams({ sheet: V.sheet, auto: "1" });
    if (department) q.set("department", department);
    if (date && view !== "report") q.set("date", date);
    if (status && view === "report") q.set("status", status);
    window.open(`/print/practical/${examId}?${q}`, "_blank");
  };

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    if (view === "room-diary") {
      const summary = rooms.map((r, i) => ({
        "Sl No": i + 1,
        Date: r.date || "",
        Session: sessionLabel(r.session),
        Lab: r.lab || "",
        Batches: r.batches.map((b) => b.label).join(", "),
        Subjects: [...new Set(r.batches.map((b) => `${b.code} ${b.name}`))].join("; "),
        Students: r.batches.reduce((n, b) => n + b.count, 0),
        "Internal examiner": [...new Set(r.batches.map((b) => b.internal.name).filter(Boolean))].join(", "),
        "External examiner": [...new Set(r.batches.map((b) => b.external.name).filter(Boolean))].join(", "),
      }));
      const students = [];
      for (const r of rooms)
        for (const b of r.batches)
          b.students.forEach((s, i) =>
            students.push({
              Date: r.date || "",
              Session: sessionLabel(r.session),
              Lab: r.lab || "",
              Batch: b.label,
              "Subject code": b.code,
              Subject: b.name,
              "Sl No": i + 1,
              "Register Number": s.registerNumber,
              Name: s.name,
              Branch: String(s.department || "").toUpperCase(),
              "Present / Absent": attendanceText(s),
              "Answer script No.": "",
              "Signature of candidate": "",
            })
          );
      XLSX.utils.book_append_sheet(wb, sheet(summary, "No batches."), "Rooms");
      XLSX.utils.book_append_sheet(wb, sheet(students, "No students."), "Students");
    } else if (view === "mark-sheets") {
      const used = new Set();
      for (const b of batches) {
        const rows = [
          [examName],
          [`${b.code} – ${b.name}`, "", "", `Batch: ${b.label}`],
          [`Date: ${b.date || "________"}  Session: ${sessionLabel(b.session) || "______"}  Lab: ${b.lab || "______"}`],
          [],
          ["Sl No", "Register Number", "Name", "Branch", `Marks (out of ${b.max})`, "Marks in words", "Remarks"],
          ...b.students.map((s, i) => [i + 1, s.registerNumber, s.name, String(s.department || "").toUpperCase(), "", "", ""]),
          [],
          ["Internal examiner:", b.internal.name || "", "", "External examiner:", b.external.name || "", b.external.college || ""],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [7, 18, 30, 8, 16, 24, 16].map((wch) => ({ wch }));
        let name = b.label.replace(/[\\/?*[\]:]/g, "-").slice(0, 31);
        while (used.has(name)) name = `${name.slice(0, 28)}-${used.size}`;
        used.add(name);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
      if (!batches.length) XLSX.utils.book_append_sheet(wb, sheet([], "No batches."), "ML");
    } else {
      const rows = subjects.map((s, i) => ({
        "Sl No": i + 1,
        "Subject code": s.code,
        Subject: s.name,
        Department: dept(s.department),
        Semester: s.semester ?? "",
        Registered: s.registered,
        Batches: s.batches,
        "Batches submitted": s.submittedBatches,
        "Marks entered": s.entered,
        "Marks pending": s.pending,
        "Not in any batch": s.notInBatch,
        Status: STATUS[s.status]?.label || s.status,
      }));
      XLSX.utils.book_append_sheet(wb, sheet(rows, "No practical subjects."), "Status");
    }
    XLSX.writeFile(wb, `Practical_${V.sheet}_${fileTag}.xlsx`);
  };

  const sel = T.field;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{V.title}</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{V.help}</p>
        </div>
        {examId && data && (
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadExcel} className={btn.secondary}>
              <Icon name="download" className="h-4 w-4" />
              Excel
            </button>
            <button onClick={openPdf} className={btn.primary}>
              <Icon name="download" className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      {exams && exams.length === 0 && <NoExam />}

      {examId && (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={sel}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {dept(d)}
                </option>
              ))}
            </select>
            {view !== "report" ? (
              <select value={date} onChange={(e) => setDate(e.target.value)} className={sel}>
                <option value="">All dates</option>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {fmtDay(d)}
                  </option>
                ))}
              </select>
            ) : (
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
                <option value="">Any status</option>
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className={`mt-4 ${T.wrap}`}>
            {data === null && <div className="h-48 animate-pulse" />}
            {data && view === "room-diary" && <RoomTable rooms={rooms} />}
            {data && view === "mark-sheets" && <BatchTable batches={batches} />}
            {data && view === "report" && <StatusTable subjects={subjects} />}
          </div>
        </>
      )}
    </div>
  );
}

function sheet(rows, empty) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: empty }]);
  ws["!cols"] = Object.keys(rows[0] || { Note: "" }).map((k) => ({ wch: Math.max(10, Math.min(40, k.length + 4)) }));
  return ws;
}

const Empty = ({ children }) => <p className="px-4 py-10 text-center text-sm text-slate-500">{children}</p>;

function RoomTable({ rooms }) {
  if (!rooms.length) return <Empty>No practical batches for this selection yet.</Empty>;
  return (
    <table className={T.table}>
      <thead>
        <tr className={T.headRow}>
          <th className={T.thNum}>Sl.</th>
          <th className={T.th}>Date / session</th>
          <th className={T.th}>Lab</th>
          <th className={T.th}>Batches</th>
          <th className={`${T.th} text-right`}>Students</th>
          <th className={T.th}>Examiners</th>
        </tr>
      </thead>
      <tbody className={T.body}>
        {rooms.map((r, i) => (
          <tr key={r.key} className={T.row}>
            <td className={T.tdNum}>{i + 1}</td>
            <td className={`${T.td} whitespace-nowrap`}>
              {fmtDay(r.date)}
              <span className="block text-xs text-slate-500">{sessionLabel(r.session) || "Session not set"}</span>
            </td>
            <td className={T.td}>{r.lab || <span className="text-slate-400">Not set</span>}</td>
            <td className={T.td}>
              {r.batches.map((b) => (
                <span key={b._id} className="block text-xs">
                  <b>{b.label}</b> {b.name}
                </span>
              ))}
            </td>
            <td className={`${T.td} text-right tabular-nums`}>{r.batches.reduce((n, b) => n + b.count, 0)}</td>
            <td className={`${T.td} text-xs text-slate-600`}>
              {[...new Set(r.batches.map((b) => b.internal.name).filter(Boolean))].join(", ") || "–"}
              <span className="block text-slate-400">{[...new Set(r.batches.map((b) => b.external.name).filter(Boolean))].join(", ")}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BatchTable({ batches }) {
  if (!batches.length) return <Empty>No practical batches for this selection yet.</Empty>;
  return (
    <table className={T.table}>
      <thead>
        <tr className={T.headRow}>
          <th className={T.thNum}>Sl.</th>
          <th className={T.th}>Batch</th>
          <th className={T.th}>Subject</th>
          <th className={T.th}>Date / lab</th>
          <th className={`${T.th} text-right`}>Students</th>
          <th className={T.th}>Status</th>
        </tr>
      </thead>
      <tbody className={T.body}>
        {batches.map((b, i) => {
          const st = batchState(b);
          return (
            <tr key={b._id} className={T.row}>
              <td className={T.tdNum}>{i + 1}</td>
              <td className={`${T.td} font-semibold`}>{b.label}</td>
              <td className={T.td}>
                {b.name}
                <span className="block text-xs text-slate-500">{dept(b.department)}</span>
              </td>
              <td className={`${T.td} text-xs`}>
                {fmtDay(b.date)} {sessionLabel(b.session)}
                <span className="block text-slate-500">{b.lab}</span>
              </td>
              <td className={`${T.td} text-right tabular-nums`}>{b.count}</td>
              <td className={T.td}>
                <span className={`${T.pill} ${st.chip}`}>{st.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function StatusTable({ subjects }) {
  if (!subjects.length) return <Empty>No practical subjects for this selection.</Empty>;
  const sum = (k) => subjects.reduce((n, s) => n + (s[k] || 0), 0);
  return (
    <table className={T.table}>
      <thead>
        <tr className={T.headRow}>
          <th className={T.thNum}>Sl.</th>
          <th className={T.th}>Subject</th>
          <th className={T.th}>Department</th>
          <th className={`${T.th} text-right`}>Registered</th>
          <th className={`${T.th} text-right`}>Batches (done)</th>
          <th className={`${T.th} text-right`}>Entered</th>
          <th className={`${T.th} text-right`}>Pending</th>
          <th className={T.th}>Status</th>
        </tr>
      </thead>
      <tbody className={T.body}>
        {subjects.map((s, i) => (
          <tr key={s.code} className={T.row}>
            <td className={T.tdNum}>{i + 1}</td>
            <td className={T.td}>
              <b>{s.code}</b> {s.name}
            </td>
            <td className={`${T.td} text-xs`}>
              {dept(s.department)}
              {s.semester ? ` · Sem ${s.semester}` : ""}
            </td>
            <td className={`${T.td} text-right tabular-nums`}>{s.registered}</td>
            <td className={`${T.td} text-right tabular-nums`}>
              {s.batches} ({s.submittedBatches})
            </td>
            <td className={`${T.td} text-right font-semibold tabular-nums text-emerald-700`}>{s.entered}</td>
            <td className={`${T.td} text-right font-semibold tabular-nums ${s.pending ? "text-red-700" : "text-slate-400"}`}>{s.pending}</td>
            <td className={T.td}>
              <span className={`${T.pill} ${STATUS[s.status].chip}`}>{STATUS[s.status].label}</span>
            </td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <td className={T.td} colSpan={3}>
            Total
          </td>
          <td className={`${T.td} text-right tabular-nums`}>{sum("registered")}</td>
          <td className={`${T.td} text-right tabular-nums`}>
            {sum("batches")} ({sum("submittedBatches")})
          </td>
          <td className={`${T.td} text-right tabular-nums text-emerald-700`}>{sum("entered")}</td>
          <td className={`${T.td} text-right tabular-nums text-red-700`}>{sum("pending")}</td>
          <td className={T.td} />
        </tr>
      </tbody>
    </table>
  );
}
