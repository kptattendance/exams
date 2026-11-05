"use client";

// Admin: the Recycle bin – deleted students (with all their records),
// subjects and IA / attendance sheets, kept 30 days. Restore puts them back;
// "Delete for good" removes them (and a student's login and photo) for ever.

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../../components/shell/Icon";
import { btn } from "../../components/ui/Modal";
import { useConfirm, useToast } from "../../components/ui/Feedback";
import { errMsg, useApi } from "../../components/exams/shared";
import { T } from "../../components/ui/table";

const KINDS = [
  ["", "Everything"],
  ["STUDENT", "Students"],
  ["SUBJECT", "Subjects"],
  ["IA_SHEET", "IA sheets"],
  ["ATTENDANCE_SHEET", "Attendance sheets"],
];
const KIND_LABEL = { STUDENT: "Student", SUBJECT: "Subject", IA_SHEET: "IA sheet", ATTENDANCE_SHEET: "Attendance sheet" };
const KIND_CHIP = {
  STUDENT: "bg-blue-50 text-blue-700",
  SUBJECT: "bg-violet-50 text-violet-700",
  IA_SHEET: "bg-amber-50 text-amber-800",
  ATTENDANCE_SHEET: "bg-emerald-50 text-emerald-700",
};
const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");
const daysLeft = (d) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 864e5));

function what(e) {
  const r = e.records || {};
  if (e.kind === "STUDENT")
    return [r.registrations && `${r.registrations} exam registration${r.registrations > 1 ? "s" : ""}`, r.results && `${r.results} old results`, r.electives && "elective choice", r.sheetRows && `${r.sheetRows} IA / attendance rows`]
      .filter(Boolean)
      .join(", ") || "student record";
  if (e.kind === "SUBJECT") return "subject";
  return `${r.students || 0} students${r.status ? ` · was ${r.status === "confirmed" ? "frozen" : r.status}` : ""}`;
}

export default function RecycleBinPage() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/recycle-bin", undefined, { params: kind ? { kind } : {} });
      setData(r.data);
    } catch (e) {
      setData({ data: [], counts: {} });
      toast.error(errMsg(e, "Could not open the Recycle bin."));
    }
  }, [api, kind, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.data || []).filter((e) => !t || `${e.label} ${e.department} ${e.reason} ${e.deletedBy}`.toLowerCase().includes(t));
  }, [data, q]);

  const restore = async (e) => {
    const ok = await confirm({
      title: `Restore ${KIND_LABEL[e.kind].toLowerCase()}?`,
      message: `${e.label}\n\nIt is put back exactly as it was when it was deleted${e.kind === "STUDENT" ? ", with all his records" : ""}.`,
      confirmText: "Restore",
    });
    if (!ok) return;
    setBusy(e._id);
    try {
      const r = await api("post", `/recycle-bin/${e._id}/restore`);
      toast.success(r.data.message, 7000);
      load();
    } catch (err) {
      toast.error(errMsg(err, "Could not restore."), 9000);
    }
    setBusy("");
  };

  const destroy = async (e) => {
    const ok = await confirm({
      title: "Delete for good?",
      message: `${e.label}\n\nAfter this it can never be restored.${e.kind === "STUDENT" ? " His login and photo are removed too." : ""}`,
      confirmText: "Delete for good",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(e._id);
    try {
      const r = await api("delete", `/recycle-bin/${e._id}`);
      toast.success(r.data.message, 7000);
      load();
    } catch (err) {
      toast.error(errMsg(err, "Could not delete."));
    }
    setBusy("");
  };

  const counts = data?.counts || {};
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Recycle bin</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
        Deleted students (with all their records), subjects and IA / attendance sheets stay here for <b>30 days</b>. Restore puts them back exactly as they were. After 30
        days they are deleted for good by themselves.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map(([k, label]) => (
            <button
              key={k || "all"}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {label}
              {k && counts[k] ? ` (${counts[k]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register number, name, code…" className={`${T.field} h-10 w-64 pl-8 text-sm`} />
        </div>
      </div>

      <div className={`mt-3 ${T.wrap}`}>
        {data === null && <div className="h-40 animate-pulse" />}
        {data && list.length === 0 && <p className="px-4 py-12 text-center text-sm text-slate-500">The Recycle bin is empty.</p>}
        {list.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Deleted</th>
                <th className={T.th}>What comes back</th>
                <th className={T.th}>Deleted by / why</th>
                <th className={T.th}>Days left</th>
                <th className={`${T.th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {list.map((e, i) => (
                <tr key={e._id} className={T.row}>
                  <td className={T.tdNum}>{i + 1}</td>
                  <td className={T.td}>
                    <span className={`${T.pill} ${KIND_CHIP[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                    <p className="mt-1 font-semibold text-slate-950">{e.label}</p>
                    <p className="text-[11px] text-slate-500">{fmt(e.deletedAt)}</p>
                  </td>
                  <td className={`${T.td} text-xs text-slate-600`}>{what(e)}</td>
                  <td className={`${T.td} text-xs text-slate-600`}>
                    {e.deletedBy || "—"}
                    {e.reason && <p className="text-[11px] text-slate-500">{e.reason}</p>}
                  </td>
                  <td className={`${T.td} text-xs font-semibold ${daysLeft(e.expiresAt) <= 3 ? "text-red-700" : "text-slate-700"}`}>{daysLeft(e.expiresAt)}</td>
                  <td className={`${T.td} text-right`}>
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => restore(e)} disabled={busy === e._id} className={btn.small}>
                        <Icon name="check" className="h-3.5 w-3.5" />
                        Restore
                      </button>
                      <button onClick={() => destroy(e)} disabled={busy === e._id} className={`${btn.small} !text-red-700`}>
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        Delete for good
                      </button>
                    </div>
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
