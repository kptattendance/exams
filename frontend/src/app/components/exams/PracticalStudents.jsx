"use client";

// HOD / Evening Principal → Practical students
// Every practical subject the department conducts, with all its students:
// eligible (and in which batch, or not yet in one) or not permitted (and why).
// Read only – so the HOD can plan the batches early, before printing anything.

import { useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { T } from "../ui/table";
import { XLSX } from "../xlsx";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, dept, fmtDay, sessionLabel, usePracticalExams } from "./practicalShared";

const SHOW = [
  ["", "All students"],
  ["ELIGIBLE", "Eligible"],
  ["NOT_PLACED", "Eligible – not in a batch yet"],
  ["NOT_PERMITTED", "Not permitted"],
];

export default function PracticalStudents() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId } = usePracticalExams();
  const [data, setData] = useState(null);
  const [code, setCode] = useState("");
  const [show, setShow] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({}); // code -> shown

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    setData(null);
    api("get", `/practicals/${examId}/students`)
      .then((r) => alive && setData(r.data))
      .catch((e) => {
        if (!alive) return;
        setData({ data: [] });
        toast.error(errMsg(e, "Could not load the practical students."));
      });
    return () => {
      alive = false;
    };
  }, [api, examId, toast]);

  const subjects = useMemo(() => data?.data || [], [data]);
  const term = q.trim().toLowerCase();
  const pick = (s) =>
    (show === "ELIGIBLE" ? s.eligible : show === "NOT_PLACED" ? s.eligible && !s.batch : show === "NOT_PERMITTED" ? !s.eligible : true) &&
    (!term || s.registerNumber.toLowerCase().includes(term) || String(s.name || "").toLowerCase().includes(term));
  const shown = subjects.filter((x) => !code || x.code === code);
  const filtering = Boolean(show || term);

  const downloadExcel = () => {
    const rows = [];
    for (const x of shown)
      x.students.filter(pick).forEach((s) =>
        rows.push({
          "Subject code": x.code,
          Subject: x.name,
          "Register Number": s.registerNumber,
          Name: s.name,
          Branch: String(s.branch || "").toUpperCase(),
          Type: s.kind === "BACKLOG" ? "Back paper" : "Regular",
          Status: s.eligible ? "Eligible" : "Not permitted",
          Reason: s.reason,
          Batch: s.batch?.label || "",
          Date: s.batch?.date || "",
          Session: s.batch ? sessionLabel(s.batch.session) : "",
        })
      );
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No students for this selection." }]);
    ws["!cols"] = [12, 34, 14, 28, 8, 11, 14, 40, 16, 12, 20].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Practical students");
    XLSX.writeFile(wb, `Practical_students_${code || "all"}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical students</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Every practical subject your department conducts, with all its students – who is eligible, who is already in a batch, and who is not
            permitted and why. Plan the batches from here; nothing can be changed on this page.
          </p>
        </div>
        {examId && data && subjects.length > 0 && (
          <button onClick={downloadExcel} className={btn.secondary}>
            <Icon name="download" className="h-4 w-4" />
            Excel
          </button>
        )}
      </div>

      {exams && exams.length === 0 && <NoExam />}

      {examId && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <select value={code} onChange={(e) => setCode(e.target.value)} className={`${T.field} max-w-[24rem]`} aria-label="Subject">
              <option value="">All subjects</option>
              {subjects.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.code} – {x.name}
                </option>
              ))}
            </select>
            <select value={show} onChange={(e) => setShow(e.target.value)} className={T.field} aria-label="Students">
              {SHOW.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register number or name" className={`${T.field} w-60 pl-8`} />
            </div>
          </div>

          {data === null && <div className="mt-4 h-48 animate-pulse rounded-2xl bg-slate-100" />}
          {data && subjects.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Your department conducts no practical exam in this examination.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {shown.map((x) => {
              const list = x.students.filter(pick);
              const notPermitted = x.registered - x.eligible;
              const notPlaced = x.eligible - x.placed;
              const isOpen = open[x.code] ?? (filtering || Boolean(code));
              return (
                <section key={x.code} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [x.code]: !isOpen }))}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <b className="text-slate-950">{x.code}</b> <span className="text-slate-800">{x.name}</span>
                      {x.semester && <span className="ml-2 text-xs text-slate-500">Sem {x.semester}</span>}
                    </span>
                    <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">{x.registered} registered</span>
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">{x.eligible} eligible</span>
                      <span className={`rounded-lg px-2 py-1 ${notPlaced ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {notPlaced ? `${notPlaced} not in a batch yet` : "all in batches"}
                      </span>
                      {notPermitted > 0 && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">{notPermitted} not permitted</span>}
                    </span>
                    <Icon name="chevronRight" className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-90" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100">
                      {list.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">No students for this selection.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className={T.table}>
                            <thead>
                              <tr className={T.headRow}>
                                <th className={T.thNum}>Sl.</th>
                                <th className={T.th}>Register no.</th>
                                <th className={T.th}>Name</th>
                                <th className={T.th}>Branch</th>
                                <th className={T.th}>Status</th>
                                <th className={T.th}>Batch</th>
                              </tr>
                            </thead>
                            <tbody className={T.body}>
                              {list.map((s, i) => (
                                <tr key={s.registerNumber} className={T.row}>
                                  <td className={T.tdNum}>{i + 1}</td>
                                  <td className={`${T.td} font-semibold tabular-nums text-slate-950`}>{s.registerNumber}</td>
                                  <td className={T.td}>
                                    {s.name}
                                    {s.kind === "BACKLOG" && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-600">BACK PAPER</span>}
                                  </td>
                                  <td className={`${T.td} text-xs`} title={dept(s.branch)}>
                                    {String(s.branch || "").toUpperCase()}
                                  </td>
                                  <td className={T.td}>
                                    {s.eligible ? (
                                      <span className={`${T.pill} bg-emerald-50 text-emerald-700`}>Eligible</span>
                                    ) : (
                                      <span className={`${T.pill} bg-red-50 text-red-700`}>{s.reason}</span>
                                    )}
                                  </td>
                                  <td className={`${T.td} text-xs`}>
                                    {s.batch ? (
                                      <>
                                        <b>{s.batch.label}</b>
                                        <span className="block text-slate-500">
                                          {s.batch.date ? `${fmtDay(s.batch.date)} ${sessionLabel(s.batch.session)}` : "Date not fixed yet"}
                                        </span>
                                      </>
                                    ) : s.eligible ? (
                                      <span className="font-semibold text-orange-700">Not in a batch yet</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
