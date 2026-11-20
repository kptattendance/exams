"use client";

// Packet tracker: every packet (= room diary) of an exam and where it stands.
// Filled in automatically – nothing to tick:
//   Exam → With valuer / not typed → Typing → Checked → Decoded
// ATS lookup (COE only): type the 6-digit ATS number (or all 8 digits) to see its packet.
// No names or register numbers on this page.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { T } from "../ui/table";

const STAGE = {
  EXAM: { label: "Exam not over", chip: "bg-slate-100 text-slate-600" },
  WITH_VALUER: { label: "Marks not typed", chip: "bg-blue-50 text-blue-700" },
  TYPING: { label: "Typing", chip: "bg-indigo-50 text-indigo-700" },
  MISMATCH: { label: "Mismatch – check", chip: "bg-red-50 text-red-700" },
  CHECKED: { label: "Checked", chip: "bg-emerald-50 text-emerald-700" },
  DECODED: { label: "Decoded", chip: "bg-emerald-100 text-emerald-800" },
  ALL_ABSENT: { label: "All absent", chip: "bg-slate-100 text-slate-500" },
};
const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

export default function PacketTracker({ backHref, canLookup = false }) {
  const api = useApi();
  const toast = useToast();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [ats, setAts] = useState("");
  const [found, setFound] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/exams");
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        setExams(list);
        if (list[0]) setExamId(list[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast]);

  const load = useCallback(async () => {
    if (!examId) return;
    setData(null);
    try {
      const r = await api("get", `/exams/${examId}/valuation-packets`);
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the packets."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const lookup = async (e) => {
    e.preventDefault();
    setFound(null);
    try {
      const r = await api("get", `/exams/${examId}/ats/${encodeURIComponent(ats.replace(/\D/g, ""))}`);
      setFound(r.data.data);
      if (r.data.data.serialFound === false) toast.error(`${r.data.data.ats}: the serial is not in packet ${r.data.data.number} – the ATS is mis-copied. Check the room diary.`, 9000);
    } catch (err) {
      toast.error(errMsg(err, "Not found."));
    }
  };

  const text = q.trim().toLowerCase();
  const rows = (data?.data || []).filter(
    (r) => (!stage || r.stage === stage) && (!text || `${r.number} ${r.code} ${r.name} ${r.room} ${r.date}`.toLowerCase().includes(text))
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <Icon name="chevronLeft" className="h-4 w-4" />
          Valuation
        </Link>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Packet tracker</h2>
      <p className="mt-1 text-sm text-slate-500">One packet per room diary. The status changes by itself as the marks are typed – nothing to tick.</p>

      {exams && exams.length > 1 && (
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-3 h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {exams.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name} · {e.academicYear}
            </option>
          ))}
        </select>
      )}

      {/* ATS lookup – the COE only (the ATS -> packet link is confidential) */}
      {canLookup && (
      <form onSubmit={lookup} className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="font-semibold text-slate-800">ATS lookup</span>
          <input
            value={ats}
            onChange={(e) => setAts(e.target.value)}
            inputMode="numeric"
            placeholder="482715 or 482715-07"
            className={`${T.field} mt-1 block w-52 tabular-nums`}
          />
        </label>
        <button disabled={!examId || ats.replace(/\D/g, "").length < 6} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-40">
          Find packet
        </button>
        {found && (
          <p className="text-sm text-slate-700">
            <b className="tabular-nums">{found.ats}</b> → packet <b>{found.number}</b> · {found.code} {found.name} · {fmtDay(found.date)} {found.session} · {found.room} ·{" "}
            {found.students} students
            {found.serialFound === false && <b className="ml-2 text-red-700">serial not in this packet</b>}
          </p>
        )}
      </form>
      )}

      {examId && !data && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {[["", "All"], ...Object.entries(STAGE).map(([k, v]) => [k, v.label])].map(([k, label]) => {
              const n = k ? data.data.filter((r) => r.stage === k).length : data.data.length;
              if (k && !n) return null;
              return (
                <button
                  key={label}
                  onClick={() => setStage(k)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${stage === k ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                >
                  {label} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Packet, subject, room or date" className={`${T.field} ml-auto w-60`} />
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Packet</th>
                  <th className="px-3 py-2">Paper</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2 text-right">Present / absent</th>
                  <th className="px-3 py-2">Valuer</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.number}>
                    <td className="px-3 py-2 font-bold tabular-nums">{r.number}</td>
                    <td className="px-3 py-2">
                      <b>{r.code}</b> <span className="text-slate-600">{r.name}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {fmtDay(r.date)} {r.session}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.room}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.present} / <span className={r.absent ? "font-semibold text-red-700" : ""}>{r.absent}</span>
                      {r.malpractice > 0 && <span className="ml-1 text-xs text-red-700">({r.malpractice} MP)</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.valuer || "–"}</td>
                    <td className="px-3 py-2">
                      <span className={`${T.pill} ${STAGE[r.stage].chip}`}>{STAGE[r.stage].label}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      {data.data.length ? "Nothing matches the filters." : "No room diaries yet. They are made when the Chief Examiner saves the rooms."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
