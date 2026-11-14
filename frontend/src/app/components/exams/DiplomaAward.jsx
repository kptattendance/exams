"use client";

// Award of the Diploma (KPT 11), class (KPT 12) and ranks (KPT 14.8) – COE.
// Pick a programme and batch: every final-year student is checked (credits,
// every course passed, bridge / audit / internship, duration, CGPA), with his
// class and rank. Tick the eligible, enter the Academic Council's approval
// and award; then print the list, the rank list and provisional certificates.

import { useCallback, useEffect, useMemo, useState } from "react";

import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import CollegeSelect, { EveningTag } from "../ui/CollegeFilter";
import { DEPARTMENTS, errMsg, useApi } from "./shared";

const MEDAL = { 1: "🥇 1st", 2: "🥈 2nd", 3: "🥉 3rd" };
const thisYear = new Date().getFullYear();

export default function DiplomaAward() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [department, setDepartment] = useState(DEPARTMENTS[0].value);
  const [startYear, setStartYear] = useState(String(thisYear - 3));
  const [college, setCollege] = useState("");
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [reference, setReference] = useState("");
  const [awardedOn, setAwardedOn] = useState(new Date().toISOString().slice(0, 10));
  const [cleared, setCleared] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRows(null);
    setPicked(new Set());
    try {
      const r = await api("get", "/diploma", undefined, { params: { department, startYear, ...(college ? { college } : {}) } });
      setRows(r.data.data);
    } catch (e) {
      setRows([]);
      toast.error(errMsg(e, "Could not check the students."));
    }
  }, [api, department, startYear, college, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const awardable = useMemo(() => (rows || []).filter((r) => r.eligible && !r.award), [rows]);
  const counts = useMemo(() => {
    const c = { total: rows?.length || 0, eligible: 0, awarded: 0, ranked: 0 };
    for (const r of rows || []) {
      if (r.eligible) c.eligible++;
      if (r.award) c.awarded++;
      if (r.rank) c.ranked++;
    }
    return c;
  }, [rows]);
  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const award = async () => {
    const ok = await confirm({
      title: `Award the Diploma to ${picked.size} student${picked.size === 1 ? "" : "s"}?`,
      message: "They become “passed”. Do this after the Academic Council has approved the list (KPT 11.2).",
      confirmText: "Award",
      requireText: "AWARD",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("post", "/diploma/award", { studentIds: [...picked], reference, awardedOn, cleared });
      toast.success(r.data.message, 10000);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not award."));
    }
    setBusy(false);
  };
  const undo = async (r) => {
    const ok = await confirm({ title: `Remove the award for ${r.registerNumber}?`, message: "Only if recorded by mistake.", confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      const x = await api("delete", `/diploma/award/${r.award._id}`);
      toast.success(x.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };

  const printUrl = (mode) => `/print/diploma?${new URLSearchParams({ mode, department, startYear, ...(college ? { college } : {}) })}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Diploma award, class and ranks</h2>
      <p className="mt-1 text-sm text-slate-500">KPT 11 (award), KPT 12 (class), KPT 14.8 (ranks) – final-year students of one programme and batch.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Batch started in
          <select value={startYear} onChange={(e) => setStartYear(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            {Array.from({ length: 8 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <CollegeSelect value={college} onChange={setCollege} />
        <div className="ml-auto flex gap-2">
          <a href={printUrl("list")} target="_blank" rel="noreferrer" className={btn.secondary}>
            Print list
          </a>
          <a href={printUrl("ranks")} target="_blank" rel="noreferrer" className={btn.secondary}>
            Rank list
          </a>
          <a href={printUrl("certificates")} target="_blank" rel="noreferrer" className={btn.secondary}>
            Provisional certificates
          </a>
        </div>
      </div>

      {!rows && <div className="mt-4 h-48 animate-pulse rounded-2xl bg-white" />}
      {rows && (
        <>
          <p className="mt-4 text-sm text-slate-600">
            {counts.total} final-year students · <b className="text-emerald-700">{counts.eligible} eligible</b> · {counts.awarded} awarded · {counts.ranked} ranked
          </p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No final-year (semester 6) student in this programme and batch.</p>
            ) : (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="w-8 px-3 py-2.5" />
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5 text-right">Credits</th>
                    <th className="px-3 py-2.5 text-right">CGPA</th>
                    <th className="px-3 py-2.5">Class</th>
                    <th className="px-3 py-2.5">Rank</th>
                    <th className="px-3 py-2.5">Diploma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.student} className="align-top">
                      <td className="px-3 py-2.5">
                        {r.eligible && !r.award && (
                          <input type="checkbox" checked={picked.has(String(r.student))} onChange={() => toggle(String(r.student))} className="h-4 w-4 accent-emerald-600" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <b className="tabular-nums">{r.registerNumber}</b>
                        <EveningTag registerNumber={r.registerNumber} />
                        <span className="block text-xs text-slate-500">{r.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                        {r.earned}/{r.prescribed}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.cgpa?.toFixed(2) ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.classLabel || "—"}
                        {r.cgpa >= 7.75 && r.eligible && r.class !== "FIRST_CLASS_DISTINCTION" && (
                          <span className="block text-slate-500">no distinction: {!r.withinMin ? "beyond minimum duration" : !r.firstAttempt ? "not all in first attempt" : "malpractice record"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold">{r.rank ? MEDAL[r.rank] || `${r.rank}th` : "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.award ? (
                          <span className="text-emerald-700">
                            Awarded {new Date(r.award.awardedOn).toLocaleDateString("en-IN")}
                            <button onClick={() => undo(r)} className="ml-2 font-semibold text-red-600 hover:underline">
                              Remove
                            </button>
                          </span>
                        ) : r.eligible ? (
                          <span className="font-semibold text-emerald-700">Eligible</span>
                        ) : (
                          <ul className="list-disc space-y-0.5 pl-4 text-amber-800">
                            {r.reasons.map((m) => (
                              <li key={m}>{m}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {awardable.length > 0 && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Award the Diploma ({picked.size} ticked)</p>
                <button onClick={() => setPicked(new Set(awardable.map((r) => String(r.student))))} className="text-xs font-semibold text-blue-700 hover:underline">
                  Tick all eligible ({awardable.length})
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_11rem]">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Academic Council approval (resolution no. / date)</span>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} mt-1.5`} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Awarded on</span>
                  <input type="date" value={awardedOn} onChange={(e) => setAwardedOn(e.target.value)} className={`${field} mt-1.5`} />
                </label>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={cleared} onChange={(e) => setCleared(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
                No dues to the institute, no pending disciplinary case and clearance from all departments for the ticked students (KPT 11.1.4).
              </label>
              <button onClick={award} disabled={busy || !picked.size || reference.trim().length < 3 || !cleared} className={`${btn.primary} mt-3`}>
                {busy ? "Saving…" : `Award the Diploma (${picked.size})`}
              </button>
            </div>
          )}
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Ranks (KPT 14.8): first attempt in every course, within the minimum duration, no malpractice, no NE / ANS, CGPA ≥ 8.00 (two decimals, not rounded). Equal
            CGPA: more semesters with a better SGPA, then final-year grades; still equal – same rank. The number of ranks is decided by the Academic Council.
          </p>
        </>
      )}
    </div>
  );
}
