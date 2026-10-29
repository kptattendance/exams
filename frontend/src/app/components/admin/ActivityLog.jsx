"use client";

// Admin: the activity log – who did what and when, newest first, refreshed by
// itself every 20 seconds. Filters, Excel download, and archiving of entries
// older than 2 years to Google Drive.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { downloadBlob, errMsg, useApi } from "../exams/shared";

const ROLE_CHIP = {
  admin: "bg-slate-900 text-white",
  coe: "bg-indigo-100 text-indigo-800",
  acoe: "bg-indigo-50 text-indigo-700",
  hod: "bg-teal-100 text-teal-800",
  office: "bg-cyan-100 text-cyan-800",
  staff: "bg-violet-100 text-violet-800",
  chief_examiner: "bg-fuchsia-100 text-fuchsia-800",
};
// the kind of action decides its colour
const tone = (a) =>
  /FAIL|WRONG|LOCK|DENIED|ERROR/.test(a)
    ? "bg-red-100 text-red-800"
    : /DELETE|REMOVE|UNDO|CANCEL|PURGE|ARCHIVED|RETURN/.test(a)
    ? "bg-orange-100 text-orange-800"
    : /PRINT|EXPORT|DOWNLOAD|VIEW|OPEN/.test(a)
    ? "bg-sky-100 text-sky-800"
    : "bg-emerald-50 text-emerald-800";
const ago = (d) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default function ActivityLog() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null);
  const [f, setF] = useState({ q: "", action: "", role: "", from: "", to: "" });
  const [query, setQuery] = useState(f);
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(true);
  const [open, setOpen] = useState(null); // expanded entry

  // typing in the search box waits a moment before asking the server
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(f);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [f]);

  const params = useCallback(() => Object.fromEntries(Object.entries(query).filter(([, v]) => v)), [query]);

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([api("get", "/audit-logs", undefined, { params: { ...params(), page, limit: 50 } }), api("get", "/audit-logs/meta")]);
      setData(r.data);
      setMeta(m.data);
    } catch (e) {
      setData((d) => d || { data: [], total: 0, pages: 1 });
      toast.error(errMsg(e, "Could not load the activity log."));
    }
  }, [api, params, page, toast]);

  useEffect(() => {
    load();
  }, [load]);
  // live: the first page refreshes itself
  useEffect(() => {
    if (!live || page !== 1) return;
    const t = setInterval(load, 20 * 1000);
    return () => clearInterval(t);
  }, [live, page, load]);

  const archive = async () => {
    const ok = await confirm({
      title: `Archive ${meta.olderThanKeep} old entries?`,
      message: `Entries older than ${meta.keepYears} years are saved to Google Drive (“Activity logs” folder) as an Excel file and then removed from the website. A verification code is needed.`,
      confirmText: "Archive",
    });
    if (!ok) return;
    try {
      const r = await api("post", "/audit-logs/archive");
      toast.success(r.data.message, 8000);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not archive."), 8000);
    }
  };

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const sel = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm";

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
            Activity log
            {live && page === 1 && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">
            {meta ? `${meta.total.toLocaleString("en-IN")} entries in all · ${meta.today} today · kept for ${meta.keepYears} years` : "Loading… please wait"}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4" />
          Refresh by itself
        </label>
        <button onClick={() => downloadBlob(api, "/audit-logs/export", params(), "activity_log.xlsx").catch(() => toast.error("Could not download."))} className={btn.small}>
          <Icon name="download" className="h-4 w-4" />
          Download Excel
        </button>
        {meta?.olderThanKeep > 0 && (
          <button onClick={archive} className={btn.small}>
            Archive {meta.olderThanKeep} older than {meta.keepYears} years
          </button>
        )}
      </div>

      {/* filters */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input value={f.q} onChange={set("q")} placeholder="Search email, action, code, register no…" className={`${sel} lg:col-span-2`} />
        <select value={f.action} onChange={set("action")} className={sel}>
          <option value="">All actions</option>
          {(meta?.actions || []).map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <select value={f.role} onChange={set("role")} className={sel}>
          <option value="">Everybody</option>
          {(meta?.roles || []).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <input type="date" value={f.from} onChange={set("from")} aria-label="From date" className={`${sel} min-w-0 flex-1`} />
          <input type="date" value={f.to} onChange={set("to")} aria-label="To date" className={`${sel} min-w-0 flex-1`} />
        </div>
      </div>

      {/* entries */}
      <div className="mt-3 max-h-[65vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-40 px-3 py-2">When</th>
              <th className="px-3 py-2">Who</th>
              <th className="px-3 py-2">What</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {data === null && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading… please wait
                </td>
              </tr>
            )}
            {data?.data.map((l, i) => (
              <tr key={l._id} className={`border-t border-slate-100 align-top ${i % 2 ? "bg-slate-50/50" : ""}`}>
                <td className="px-3 py-2">
                  <p className="text-xs font-semibold text-slate-800">{ago(l.at)}</p>
                  <p className="text-[11px] text-slate-500">{when(l.at)}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="max-w-[220px] truncate text-xs font-semibold text-slate-800" title={l.email}>
                    {l.email || "–"}
                  </p>
                  {l.role && <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE_CHIP[l.role] || "bg-slate-100 text-slate-700"}`}>{l.role}</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${tone(l.action)}`}>{l.label}</span>
                  {l.entity && <p className="mt-0.5 text-[11px] text-slate-500">{l.entity}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  <button onClick={() => setOpen(open === l._id ? null : l._id)} className="text-left hover:underline" title="Show everything">
                    {l.summary || "–"}
                  </button>
                  {open === l._id && (
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">
                      {JSON.stringify({ ...l.details, ip: l.ip }, null, 2)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
            {data && data.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Nothing found for these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btn.small}>
            Newer
          </button>
          <span className="text-slate-500">
            Page {page} of {data.pages} · {data.total.toLocaleString("en-IN")} entries
          </span>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className={btn.small}>
            Older
          </button>
        </div>
      )}
    </section>
  );
}
