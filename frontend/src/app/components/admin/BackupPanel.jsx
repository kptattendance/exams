"use client";

// Admin: database backups – made automatically every night (about 2 AM) and by
// hand ("Back up now"); old ones are removed by the keep rule (7 days, 4 weeks,
// 6 months, and any marked "Keep"). Open in Google Drive / download for an offline copy.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast, usePopupMessage } from "../ui/Feedback";
import { downloadBlob, errMsg, useApi } from "../exams/shared";

const when = (d) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const daysSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
// never null (see ActivityLog: the React Compiler may read fields early)
const EMPTY = { data: [], lastOk: null, keyFromBackupKey: true, nightly: null, loaded: false };

export default function BackupPanel() {
  const api = useApi();
  const toast = useToast();
  const [d, setD] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  usePopupMessage(error); // shown as a popup too

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/backups");
      setD({
        data: Array.isArray(r.data?.data) ? r.data.data : [],
        lastOk: r.data?.lastOk || null,
        keyFromBackupKey: Boolean(r.data?.keyFromBackupKey),
        nightly: r.data?.nightly || null,
        loaded: true,
      });
      setEmail(r.data?.nightly?.alertEmail || "");
      setError("");
    } catch (e) {
      setD((x) => ({ ...x, loaded: true }));
      setError(e?.response?.status === 404 ? "The server does not have backups yet – redeploy the backend with the latest code." : errMsg(e, "Could not load the backups."));
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const backUp = async () => {
    setBusy(true);
    try {
      const r = await api("post", "/backups", { reason });
      toast.success(r.data.message, 8000);
      setReason("");
      load();
    } catch (e) {
      toast.error(errMsg(e, "The backup could not be made."), 10000);
      load();
    }
    setBusy(false);
  };

  const keep = async (b) => {
    try {
      const r = await api("patch", `/backups/${b._id}`, { keep: !b.keep });
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
  };
  const saveEmail = async () => {
    try {
      const r = await api("put", "/backups/alert-email", { email });
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
  };

  const last = d.lastOk;
  const age = last ? daysSince(last.at) : null;
  // a backup is made every night: more than 2 days without one means something is wrong
  const state = !last ? "NONE" : age >= 2 ? "OLD" : "OK";
  const banner = {
    NONE: "border-red-200 bg-red-50 text-red-900",
    OLD: "border-orange-200 bg-orange-50 text-orange-900",
    OK: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[state];

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-950">Database backup</h2>
          <p className="text-xs text-slate-500">
            Every collection (students, marks, results, fees, logs…) in one encrypted file, saved to Google Drive → “Backups”.
          </p>
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Note (optional), e.g. before results" className="h-10 w-64 max-w-full rounded-xl border border-slate-300 px-3 text-sm" />
        <button onClick={backUp} disabled={busy} className={btn.primary}>
          <Icon name="download" className="h-4 w-4" />
          {busy ? "Backing up… please wait" : "Back up now"}
        </button>
      </div>

      <div className={`mt-3 rounded-xl border px-4 py-3 text-sm ${banner}`}>
        {!d.loaded
          ? "Loading… please wait"
          : state === "NONE"
          ? "No backup has been made yet. The free Atlas plan keeps NO backups – click “Back up now”."
          : state === "OLD"
          ? `Last good backup ${age} days ago (${when(last.at)}). The nightly backup is not working – click “Back up now” and check the failed attempts below.`
          : `Last backup ${age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`} · ${when(last.at)} · ${last.records.toLocaleString("en-IN")} records · ${kb(last.size)}.`}
      </div>
      {error && <p className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">{error}</p>}
      {d.loaded && d.nightly && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs text-slate-600">
          <span>
            <b className={d.nightly.on ? "text-emerald-700" : "text-red-700"}>{d.nightly.on ? "Nightly backup ON" : "Nightly backup OFF"}</b>
            {d.nightly.on
              ? ` · about 2 AM every night · keeps ${d.nightly.keep.days} days, ${d.nightly.keep.weeks} weeks, ${d.nightly.keep.months} months and every backup marked “Keep”`
              : " · CRON_SECRET is not set on the server (Vercel)"}
          </span>
          <span className="flex items-center gap-2">
            If it fails, email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email address" className="h-8 w-60 rounded-lg border border-slate-300 px-2 text-xs" />
            <button onClick={saveEmail} disabled={email === (d.nightly.alertEmail || "")} className={btn.small}>
              Save
            </button>
          </span>
        </div>
      )}
      {d.loaded && !d.keyFromBackupKey && (
        <p className="mt-2 text-xs text-slate-500">
          Backups are encrypted with the website’s data key. Keep a copy of that key offline (sealed envelope / password manager) – without it a backup cannot be opened.
        </p>
      )}

      {d.data.length > 0 && (
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2 text-right">Records</th>
                <th className="px-3 py-2 text-right">Size</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {d.data.map((b) => (
                <tr key={b._id} className={`border-t border-slate-100 ${b.status === "FAILED" ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">
                    <p className="text-xs font-semibold text-slate-800">{when(b.at)}</p>
                    {b.reason && <p className="text-[11px] text-slate-500">{b.reason}</p>}
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{b.auto ? "Automatic" : "By hand"}</p>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-slate-600">{b.by}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.status === "OK" ? b.records.toLocaleString("en-IN") : "–"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.status === "OK" ? kb(b.size) : "–"}</td>
                  <td className="px-3 py-2">
                    {b.status === "OK" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Saved ✓</span>
                    ) : (
                      <span className="text-xs font-semibold text-red-700" title={b.error}>
                        Failed: {b.error}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {b.status === "OK" && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button
                          onClick={() => keep(b)}
                          title={b.keep ? "Kept for good – click to let the normal rule remove it later" : "Never remove this backup automatically"}
                          className={`${btn.small} ${b.keep ? "border-amber-300 bg-amber-50 text-amber-800" : ""}`}
                        >
                          {b.keep ? "★ Kept" : "Keep"}
                        </button>
                        {b.driveLink && (
                          <a href={b.driveLink} target="_blank" rel="noreferrer" className={btn.small}>
                            Open in Drive
                          </a>
                        )}
                        <button onClick={() => downloadBlob(api, `/backups/${b._id}/download`, {}, b.name).catch(() => toast.error("Could not download – open it in Drive instead."))} className={btn.small}>
                          <Icon name="download" className="h-3.5 w-3.5" />
                          Download
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
