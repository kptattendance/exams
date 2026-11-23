"use client";

// COE / Admin: the computers that may print question papers on the exam day.
// Register each one while sitting at it. A computer not on the list gets a
// 30-minute emergency access only, with a written reason.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { T } from "../ui/table";
import { errMsg, useApi } from "./shared";
import { computerKey } from "./examComputer";

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "–");
const clock = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Status({ c }) {
  if (c.status === "ACTIVE") return <span className={`${T.pill} bg-emerald-100 text-emerald-800`}>Registered</span>;
  if (c.unlockedUntil) return <span className={`${T.pill} bg-yellow-100 text-yellow-900`}>Emergency · until {clock(c.unlockedUntil)}</span>;
  if (c.status === "REQUESTED") return <span className={`${T.pill} bg-sky-100 text-sky-800`}>Asking for access</span>;
  return <span className={`${T.pill} bg-slate-100 text-slate-600`}>Removed</span>;
}

export default function ExamComputers() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = useState(null);
  const [mine, setMine] = useState(null); // this computer
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlocking, setUnlocking] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/exam-computers");
      setList(r.data.data || []);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load the computers."));
    }
    try {
      const key = await computerKey();
      const r = await api("post", "/exam-computers/this", { publicKey: key.publicKey });
      setMine(r.data.data);
    } catch (e) {
      setMine({ failed: true });
      toast.error(e?.response ? errMsg(e) : e.message);
    }
  }, [api, toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000); // requests from the exam hall show up by themselves
    return () => clearInterval(t);
  }, [load]);

  const register = async () => {
    setBusy(true);
    try {
      const key = await computerKey();
      const r = await api("post", "/exam-computers", { name, publicKey: key.publicKey });
      toast.success(r.data.message, 7000);
      setName("");
      await load();
    } catch (e) {
      toast.error(e?.response ? errMsg(e, "Could not register this computer.") : e.message, 8000);
    }
    setBusy(false);
  };

  const remove = async (c) => {
    const ok = await confirm({ title: `Remove "${c.name}"?`, message: "It will no longer be able to print question papers.", confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("post", `/exam-computers/${c._id}/remove`);
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove the computer."));
    }
  };

  const unlock = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/exam-computers/${unlocking._id}/unlock`, { reason });
      toast.success(r.data.message, 7000);
      setUnlocking(null);
      setReason("");
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not give the emergency access."));
    }
    setBusy(false);
  };

  const active = (list || []).filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">Exam computers</h2>
        {list && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{active} registered</span>}
      </div>

      {/* this computer */}
      <div className={`mt-2 flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${mine?.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50" : "border-indigo-200 bg-indigo-50"}`}>
        <Icon name="lock" className="h-5 w-5 shrink-0 text-slate-600" />
        <div className="min-w-0 flex-1 text-sm text-slate-900">
          {!mine && "Checking this computer…"}
          {mine?.failed && "This browser cannot be registered. Use Chrome, and not an Incognito window."}
          {mine && !mine.failed && (
            <>
              <b>This computer:</b> {mine.status === "ACTIVE" ? mine.name : "not registered"}
              <span className="ml-2 font-mono text-xs text-slate-600">Code {mine.code}</span>
            </>
          )}
        </div>
        {mine && !mine.failed && mine.status !== "ACTIVE" && (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && !busy && register()}
              maxLength={40}
              placeholder="Name, e.g. Exam Cell Desktop"
              aria-label="Name of this computer"
              className={`${T.field} w-64 bg-white`}
            />
            <button onClick={register} disabled={busy || name.trim().length < 2} className={btn.primary}>
              Register this computer
            </button>
          </>
        )}
      </div>

      <div className={`mt-2 ${T.wrap}`}>
        {list === null && <div className="h-40 animate-pulse" />}
        {list && list.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No computer is registered yet. Open this page on each exam computer and register it.</p>}
        {list && list.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Computer</th>
                <th className={T.th}>Code</th>
                <th className={T.th}>Status</th>
                <th className={T.th}>Registered by</th>
                <th className={T.th}>Last print</th>
                <th className={`${T.th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {list.map((c, i) => (
                <tr key={c._id} className={`${T.row} ${c.status === "REQUESTED" ? "bg-sky-50/60" : ""}`}>
                  <td className={T.tdNum}>{i + 1}</td>
                  <td className={`${T.td} font-semibold text-slate-900`}>
                    {c.name}
                    {mine?.code === c.code && <span className="ml-2 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800">This computer</span>}
                  </td>
                  <td className={`${T.td} whitespace-nowrap font-mono text-xs text-slate-600`}>{c.code}</td>
                  <td className={T.td} title={c.unlockReason ? `Reason: ${c.unlockReason} (${c.unlockedBy})` : undefined}>
                    <Status c={c} />
                  </td>
                  <td className={`${T.td} text-xs text-slate-600`}>
                    {c.status === "REQUESTED" ? c.requestedBy : c.registeredBy || "–"}
                    <span className="block text-slate-500">{when(c.status === "REQUESTED" ? c.requestedAt : c.registeredAt)}</span>
                  </td>
                  <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>{when(c.lastUsedAt)}</td>
                  <td className={`${T.td} text-right`}>
                    <div className="flex justify-end gap-1">
                      {c.status !== "ACTIVE" && !c.unlockedUntil && (
                        <button onClick={() => setUnlocking(c)} className={`${btn.small} whitespace-nowrap`}>
                          Allow 30 minutes
                        </button>
                      )}
                      {(c.status !== "REMOVED" || c.unlockedUntil) && (
                        <button onClick={() => remove(c)} className={`${btn.small} !text-red-700`}>
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {unlocking && (
        <Modal
          open
          busy={busy}
          onClose={() => setUnlocking(null)}
          title="Emergency access"
          subtitle={`${unlocking.name} · Code ${unlocking.code}`}
          footer={
            <>
              <button onClick={() => setUnlocking(null)} disabled={busy} className={btn.secondary}>
                Cancel
              </button>
              <button onClick={unlock} disabled={busy || reason.trim().length < 5} className={btn.primary}>
                Allow for 30 minutes
              </button>
            </>
          }
        >
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Check the code with the person at that computer, and write the reason</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={200} autoFocus placeholder="e.g. Exam cell desktop not working" className={`${field} mt-1.5 h-auto py-2.5`} />
          </label>
        </Modal>
      )}
    </div>
  );
}
