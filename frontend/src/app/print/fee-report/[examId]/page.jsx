"use client";

// Fee collection report (new tab, Print → Save as PDF): every student with his
// transactions (number, date, amount), grouped department- and semester-wise,
// with class totals and the total collected – as per the filters chosen on
// the fee page:
//   ?department=cs | backlog   ?semester=3
//   ?status=ANY_PAID (default) | PAID | PARTIAL | ALL
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   only transactions paid in these dates
//   &auto=1  opens the print dialog by itself

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import Letterhead from "../../../components/print/Letterhead";
import { deptLabel, errMsg, useApi } from "../../../components/exams/shared";

const rs = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-") : "");
const STATUS = { ANY_PAID: "Paid and partly paid", PAID: "Fully paid", PARTIAL: "Partly paid", ALL: "All students" };
const th = "border border-slate-500 px-1.5 py-1 text-left";
const td = "border border-slate-400 px-1.5 py-1 align-top";

function Report() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const department = search.get("department") || "";
  const semester = search.get("semester") || "";
  const status = search.get("status") || "ANY_PAID";
  const from = search.get("from") || "";
  const to = search.get("to") || "";
  const auto = search.get("auto") === "1";
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    (async () => {
      try {
        const params = { limit: 200, ...(department ? { department } : {}), ...(semester ? { semester } : {}), ...(status !== "ALL" ? { status } : {}) };
        let page = 1;
        let exam = null;
        const rows = [];
        for (;;) {
          const r = await api("get", `/exams/${examId}/fees`, undefined, { params: { ...params, page } });
          exam = r.data.exam;
          rows.push(...r.data.data);
          if (page >= r.data.pages) break;
          page++;
        }
        setD({ exam, rows });
      } catch (e) {
        setError(errMsg(e, "Could not load the fee details."));
      }
    })();
  }, [api, examId, department, semester, status, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!auto || !d) return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [auto, d]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading the fee details…</p>;

  // only the transactions in the chosen dates
  const inDates = (p) => {
    const day = p.paidOn ? new Date(p.paidOn).toISOString().slice(0, 10) : "";
    return (!from || (day && day >= from)) && (!to || (day && day <= to));
  };
  const students = d.rows
    .map((r) => {
      const txns = (r.payments || []).filter(inDates);
      return { ...r, txns, sum: txns.reduce((a, p) => a + (Number(p.amount) || 0), 0) };
    })
    .filter((r) => (from || to ? r.txns.length > 0 : true));

  // department- and semester-wise
  const groups = new Map();
  for (const s of students) {
    const key = `${s.department}|${s.semester}`;
    if (!groups.has(key)) groups.set(key, { department: s.department, semester: s.semester, list: [] });
    groups.get(key).list.push(s);
  }
  const ordered = [...groups.values()].sort((a, b) => a.department.localeCompare(b.department) || a.semester - b.semester);
  const total = students.reduce((a, s) => a + s.sum, 0);
  const txnCount = students.reduce((a, s) => a + s.txns.length, 0);
  const filterLine = [
    department === "backlog" ? "Back-paper students" : department ? deptLabel(department) : "All departments",
    semester ? `Semester ${semester}` : "All semesters",
    STATUS[status] || status,
    from || to ? `Paid ${from ? `from ${dmy(from)}` : ""} ${to ? `to ${dmy(to)}` : ""}`.trim() : "",
  ]
    .filter(Boolean)
    .join(" · ");
  let sl = 0;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4 portrait;margin:9mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} thead{display:table-header-group} tr{break-inside:avoid}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF.</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      <Letterhead compact />
      <div className="mt-2 rounded-lg bg-slate-800 px-4 py-2 text-center text-white">
        <p className="text-[13px] font-bold tracking-wide">EXAM FEE COLLECTION – {d.exam?.name}</p>
        <p className="text-[10.5px] text-slate-200">{filterLine}</p>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-slate-300 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase text-slate-500">Students</p>
          <p className="text-[13px] font-bold">{students.length}</p>
        </div>
        <div className="rounded-lg border border-slate-300 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase text-slate-500">Transactions</p>
          <p className="text-[13px] font-bold">{txnCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase text-emerald-700">Total collected</p>
          <p className="text-[13px] font-bold text-emerald-800">{rs(total)}</p>
        </div>
      </div>

      {ordered.length === 0 && <p className="mt-6 text-center text-sm text-slate-500">No fee details for these filters.</p>}

      {ordered.map((g) => {
        const sub = g.list.reduce((a, s) => a + s.sum, 0);
        return (
          <div key={`${g.department}-${g.semester}`} className="mt-4 break-inside-avoid-page">
            <p className="mb-1 text-[11px] font-bold">
              {String(g.department).toUpperCase()} – {deptLabel(g.department)} · Semester {g.semester}
              <span className="ml-2 font-normal text-slate-600">
                ({g.list.length} students · {rs(sub)})
              </span>
            </p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className={`${th} w-7 text-center`}>Sl.</th>
                  <th className={`${th} w-[21mm]`}>Register No.</th>
                  <th className={`${th} w-[16mm]`}>Roll No.</th>
                  <th className={th}>Name</th>
                  <th className={`${th} w-[38mm]`}>Transaction / UTR No.</th>
                  <th className={`${th} w-[18mm]`}>Paid on</th>
                  <th className={`${th} w-[17mm] text-right`}>Amount</th>
                  <th className={`${th} w-[18mm] text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((s) => {
                  sl++;
                  const lines = s.txns.length ? s.txns : [null];
                  return lines.map((p, j) => (
                    <tr key={`${s._id}-${j}`}>
                      {j === 0 && (
                        <>
                          <td className={`${td} text-center`} rowSpan={lines.length}>
                            {sl}
                          </td>
                          <td className={`${td} tabular-nums`} rowSpan={lines.length}>
                            {s.registerNumber}
                          </td>
                          <td className={td} rowSpan={lines.length}>
                            {s.rollNumber || ""}
                          </td>
                          <td className={td} rowSpan={lines.length}>
                            <span className="font-semibold">{s.name}</span>
                            {s.feeStatus === "PARTIAL" && <span className="ml-1 text-[9px] text-orange-700">(partly paid)</span>}
                            {s.feeStatus === "UNPAID" && <span className="ml-1 text-[9px] text-red-700">(not paid)</span>}
                          </td>
                        </>
                      )}
                      <td className={`${td} tabular-nums`}>{p ? p.txnNo || "—" : <span className="text-slate-400">No transaction entered</span>}</td>
                      <td className={td}>{p ? dmy(p.paidOn) : ""}</td>
                      <td className={`${td} text-right tabular-nums`}>{p && p.amount != null ? rs(p.amount) : ""}</td>
                      {j === 0 && (
                        <td className={`${td} text-right font-bold tabular-nums`} rowSpan={lines.length}>
                          {rs(s.sum)}
                        </td>
                      )}
                    </tr>
                  ));
                })}
                <tr className="bg-slate-50">
                  <td colSpan={7} className={`${td} text-right font-semibold`}>
                    {String(g.department).toUpperCase()} Sem {g.semester} total
                  </td>
                  <td className={`${td} text-right font-bold tabular-nums`}>{rs(sub)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {ordered.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-900">
          <span>
            TOTAL COLLECTED ({students.length} students · {txnCount} transactions)
          </span>
          <span>{rs(total)}</span>
        </div>
      )}

      <div className="mt-14 flex justify-between text-[11px]">
        <p className="w-52 border-t border-slate-700 pt-1 text-center">Prepared by (Exam section)</p>
        <p className="w-52 border-t border-slate-700 pt-1 text-center">Controller of Examinations</p>
      </div>
      <p className="mt-3 text-[9px] text-slate-500">Printed on {new Date().toLocaleString("en-IN")}</p>
    </div>
  );
}

export default function FeeReportPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <Report />
    </Suspense>
  );
}
