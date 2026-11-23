"use client";

// Chief Examiner (and Admin): today's frozen question papers. Each one opens for
// printing from 1 hour before its session until the session ends, only on a
// computer approved by the COE / Admin. Every opening needs a verification code,
// every copy carries a watermark of the person's name, and it is logged.

import { useCallback, useEffect, useState } from "react";

import Icon from "../components/shell/Icon";
import { useToast } from "../components/ui/Feedback";
import { T } from "../components/ui/table";
import { errMsg, useApi } from "../components/exams/shared";
import { computerKey, signForPrint } from "../components/exams/examComputer";

const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const STATE = {
  BEFORE: { label: "Not yet", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  OPEN: { label: "Open now", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  CLOSED: { label: "Closed", chip: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

// Error text from a blob response
async function blobError(e, fallback) {
  try {
    const d = e?.response?.data;
    if (d instanceof Blob) return JSON.parse(await d.text()).error || fallback;
  } catch {}
  return errMsg(e, fallback);
}

export default function ChiefExaminerPage() {
  const api = useApi();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [ready, setReady] = useState({}); // paper id -> PDF address, opened only on click
  const [computer, setComputer] = useState(null); // is this computer approved?
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/paper-setting/exam-day");
      setData(r.data);
    } catch (e) {
      setData({ data: [], today: "" });
      toast.error(errMsg(e, "Could not load today's papers."));
    }
    try {
      const key = await computerKey();
      const r = await api("post", "/exam-computers/this", { publicKey: key.publicKey });
      setComputer(r.data.data);
    } catch {
      setComputer({ failed: true, allowed: false });
    }
  }, [api, toast]);

  const askAccess = async () => {
    setAsking(true);
    try {
      const key = await computerKey();
      const r = await api("post", "/exam-computers/request", { publicKey: key.publicKey });
      toast.success(r.data.message, 12000);
      setComputer(r.data.data);
    } catch (e) {
      toast.error(e?.response ? errMsg(e, "Could not send the request.") : e.message);
    }
    setAsking(false);
  };

  useEffect(() => {
    load();
    // the open / closed state changes with the clock
    const t = setInterval(load, 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  // Gets the stamped copy (after the verification code). Nothing opens by itself:
  // the "View / Print PDF" button then opens it in a new tab.
  const open = async (p) => {
    setBusy(p._id);
    try {
      // this computer proves who it is, for this one print
      const key = await computerKey();
      const c = await api("post", "/exam-computers/challenge", { paperId: p._id });
      const signature = await signForPrint(c.data.message);
      const r = await api("get", `/paper-setting/${p._id}/exam-print`, undefined, {
        responseType: "blob",
        headers: { "X-Exam-Computer": key.keyId, "X-Exam-Proof": `${c.data.challengeId}.${signature}` },
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      setReady((m) => ({ ...m, [p._id]: url }));
      setTimeout(() => {
        URL.revokeObjectURL(url);
        setReady((m) => {
          const n = { ...m };
          delete n[p._id];
          return n;
        });
      }, 10 * 60 * 1000);
      toast.success("Copy ready. Click “View / Print PDF”.");
      load();
    } catch (e) {
      toast.error(e?.response ? await blobError(e, "Could not open the paper.") : e.message || "Could not open the paper.", 8000);
    } finally {
      setBusy("");
    }
  };

  const papers = data?.data || [];
  const today = data?.today
    ? new Date(`${data.today}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Question papers today</h2>
      <p className="mt-1 text-sm text-slate-500">
        {today && <b className="text-slate-700">{today}. </b>}
        Each paper opens 1 hour before its session and closes when the session ends. Every copy carries your name as a watermark.
      </p>

      {computer && !computer.allowed && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-950">
          <Icon name="lock" className="h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1">
            {computer.failed ? (
              "This browser cannot be checked. Use Chrome, and not an Incognito window."
            ) : (
              <>
                <b>This computer is not approved for printing question papers.</b> Use a registered exam-section computer.
                {computer.status === "REQUESTED" ? " Request sent – tell the COE / Admin" : " In an emergency, ask the COE / Admin for access and tell them"} this code: <b className="font-mono">{computer.code}</b>
              </>
            )}
          </p>
          {!computer.failed && computer.status !== "REQUESTED" && (
            <button onClick={askAccess} disabled={asking} className="h-8 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
              {asking ? "Sending…" : "Ask for emergency access"}
            </button>
          )}
        </div>
      )}
      {computer?.allowed && computer.status !== "ACTIVE" && computer.unlockedUntil && (
        <p className="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-950">Emergency access for this computer until {time(computer.unlockedUntil)}.</p>
      )}

      {data?.noSet?.length > 0 && (
        <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <b>No set chosen by the COE for:</b> {data.noSet.join(", ")}. Contact the COE office.
        </p>
      )}

      <div className={`mt-5 ${T.wrap}`}>
        {!data && <div className="h-40 animate-pulse" />}
        {data && papers.length === 0 && (
          <div className="px-6 py-14 text-center">
            <Icon name="lock" className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">No question paper is scheduled for today.</p>
          </div>
        )}
        {papers.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Course</th>
                <th className={T.th}>Set</th>
                <th className={T.th}>Session</th>
                <th className={T.th}>Opens</th>
                <th className={T.th}>Status</th>
                <th className={`${T.th} text-right`}>Copies</th>
                <th className={`${T.th} text-right`}>Paper</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {papers.map((p, i) => {
                const st = STATE[p.state];
                return (
                  <tr key={p._id} className={T.row}>
                    <td className={T.tdNum}>{i + 1}</td>
                    <td className={T.td}>
                      <p className="font-semibold text-slate-950">{p.subject?.code}</p>
                      <p className="max-w-[18rem] truncate text-xs text-slate-500">
                        {p.subject?.name}
                        {p.paperType === "PRACTICAL" && " · Practical"}
                      </p>
                    </td>
                    <td className={`${T.td} text-xs font-semibold text-slate-700`}>{p.setNo}</td>
                    <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
                      {p.session === "FN" ? "Morning" : "Afternoon"} · {time(p.startsAt)}
                    </td>
                    <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
                      {time(p.opensAt)} – {time(p.closesAt)}
                    </td>
                    <td className={T.td}>
                      <span className={`${T.pill} ${st.chip}`}>
                        <span className={`${T.dot} ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className={`${T.td} text-right text-xs tabular-nums text-slate-600`}>{p.prints}</td>
                    <td className={`${T.td} text-right`}>
                      {ready[p._id] ? (
                        <a
                          href={ready[p._id]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <Icon name="report" className="h-3.5 w-3.5" />
                          View / Print PDF
                        </a>
                      ) : (
                      <button
                        disabled={p.state !== "OPEN" || busy === p._id || !computer?.allowed}
                        onClick={() => open(p)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Icon name="report" className="h-3.5 w-3.5" />
                        {busy === p._id ? "Preparing…" : "Open & print"}
                      </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
