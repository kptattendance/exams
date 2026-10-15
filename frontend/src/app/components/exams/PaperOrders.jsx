"use client";

// Appointment orders of question paper setters, for the office to print and
// post. Lists who sets which paper; the papers themselves are never shown here.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { useToast } from "../ui/Feedback";
import { T } from "../ui/table";
import { errMsg, useApi } from "./shared";

// Odd semesters are examined Nov/Dec, even semesters May/June
const defaultSession = () => {
  const d = new Date();
  return d.getMonth() >= 6 ? `NOV-${d.getFullYear()}` : `MAY-${d.getFullYear()}`;
};
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const up = (v) => String(v || "").toUpperCase();

export default function PaperOrders() {
  const api = useApi();
  const toast = useToast();
  const [session, setSession] = useState(defaultSession);
  const [orders, setOrders] = useState(null);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState("");
  const [kind, setKind] = useState(""); // INTERNAL | EXTERNAL

  const load = useCallback(async () => {
    setOrders(null);
    try {
      const r = await api("get", "/paper-setting/orders", undefined, { params: { examSession: session || undefined } });
      setOrders(r.data.data);
    } catch (e) {
      setOrders([]);
      toast.error(errMsg(e, "Could not load the orders."));
    }
  }, [api, session, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const all = orders || [];
  const departments = [...new Set(all.map((o) => up(o.subject?.department)).filter(Boolean))].sort();
  const semesters = [...new Set(all.map((o) => o.subject?.semester).filter(Boolean))].sort((a, b) => a - b);
  const q = search.trim().toLowerCase();
  const shown = all.filter(
    (o) =>
      (!dept || up(o.subject?.department) === dept) &&
      (!sem || String(o.subject?.semester) === sem) &&
      (!kind || (kind === "EXTERNAL") === (o.examinerType === "EXTERNAL")) &&
      (!q || `${o.subject?.code} ${o.subject?.name} ${o.examiner?.name}`.toLowerCase().includes(q))
  );
  const external = all.filter((o) => o.examinerType === "EXTERNAL").length;
  const printUrl = (params) => `/print/paper-orders?${new URLSearchParams(params)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Paper setter orders</h2>
          <p className="mt-1 text-sm text-slate-500">Print the appointment order of each question paper setter and send it by post.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={session}
            onChange={(e) => setSession(e.target.value.toUpperCase())}
            placeholder="Session e.g. NOV-2026"
            className={`${T.field} w-40 font-semibold tracking-wide`}
            aria-label="Exam session"
          />
          {all.length > 0 && (
            <a
              href={printUrl({ session })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Icon name="report" className="h-3.5 w-3.5" />
              Print all {all.length}
            </a>
          )}
        </div>
      </div>

      {/* counts */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Orders", all.length],
          ["Internal", all.length - external],
          ["External", external],
        ].map(([label, n]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{orders ? n : "–"}</p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject or setter" className={`${T.field} w-52 pl-8`} />
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={T.field}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={T.field}>
          <option value="">All semesters</option>
          {semesters.map((n) => (
            <option key={n} value={String(n)}>
              Sem {n}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={T.field}>
          <option value="">Internal & external</option>
          <option value="INTERNAL">Internal only</option>
          <option value="EXTERNAL">External only</option>
        </select>
        {(search || dept || sem || kind) && (
          <button
            onClick={() => {
              setSearch("");
              setDept("");
              setSem("");
              setKind("");
            }}
            className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {shown.length} of {all.length}
        </span>
      </div>

      <div className={`mt-3 ${T.wrap}`}>
        {!orders && <div className="h-48 animate-pulse" />}
        {orders && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {all.length ? "No order matches these filters." : `No paper setter appointed for ${session || "this session"}.`}
          </p>
        )}
        {shown.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Subject</th>
                <th className={T.th}>Dept · Sem</th>
                <th className={T.th}>Set</th>
                <th className={T.th}>Paper setter</th>
                <th className={T.th}>Ordered</th>
                <th className={T.th}>Last date</th>
                <th className={`${T.th} text-right`}>Order</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {shown.map((o, i) => (
                <tr key={o._id} className={T.row}>
                  <td className={T.tdNum}>{i + 1}</td>
                  <td className={T.td}>
                    <p className="font-semibold text-slate-950">{o.subject?.code}</p>
                    <p className="max-w-[16rem] truncate text-xs text-slate-500">
                      {o.subject?.name}
                      {o.paperType === "PRACTICAL" && " · Practical"}
                    </p>
                  </td>
                  <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{up(o.subject?.department)}</span>
                    <span className="ml-1.5">Sem {o.subject?.semester}</span>
                  </td>
                  <td className={`${T.td} text-xs font-semibold text-slate-700`}>{o.setNo}</td>
                  <td className={T.td}>
                    <p className="font-medium text-slate-900">{o.examiner?.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {o.examiner?.designation || "Lecturer"}
                      {o.examiner?.department && ` · ${up(o.examiner.department)}`}
                    </p>
                    {o.examinerType === "EXTERNAL" && (
                      <span className={`${T.pill} mt-0.5 bg-violet-50 text-violet-700`}>
                        External{o.examiner?.college?.code ? ` · ${o.examiner.college.code}` : ""}
                      </span>
                    )}
                  </td>
                  <td className={`${T.td} whitespace-nowrap text-xs text-slate-500`}>{fmt(o.assignedAt)}</td>
                  <td className={`${T.td} whitespace-nowrap text-xs text-slate-700`}>{fmt(o.deadline)}</td>
                  <td className={`${T.td} text-right`}>
                    <a
                      href={printUrl({ id: o._id })}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Icon name="report" className="h-3.5 w-3.5" />
                      Print
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
