"use client";

// Admin → Settings
//   1. The running academic year (used by HOD sheets and new exams)
//   2. IA / attendance sheets saved under another year – move them in one click

import { useCallback, useEffect, useState } from "react";

import Icon from "./shell/Icon";
import { btn } from "./ui/Modal";
import { useConfirm, useToast } from "./ui/Feedback";
import { errMsg, useApi } from "./exams/shared";
import { clearAcademicYearCache, currentAcademicYear } from "./academicYear";

const around = () => {
  const y = Number(currentAcademicYear().slice(0, 4));
  return [y - 1, y, y + 1].map((s) => `${s}-${String(s + 1).slice(2)}`);
};

export default function AcademicYearSettings() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [year, setYear] = useState(null);
  const [choice, setChoice] = useState("");
  const [stray, setStray] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [y, s] = await Promise.all([api("get", "/settings/academic-year"), api("get", "/settings/stray-sheets")]);
      setYear(y.data.data.academicYear);
      setChoice(y.data.data.academicYear);
      setStray(s.data.data.sheets);
    } catch (e) {
      toast.error(errMsg(e, "Could not load settings."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const ok = await confirm({
      title: `Change the running year to ${choice}?`,
      message: `From now on HODs enter IA and attendance for ${choice}, and new exams are created for ${choice}.\n\nSheets and exams of ${year} are kept as they are.`,
      confirmText: `Use ${choice}`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("put", "/settings/academic-year", { value: choice });
      clearAcademicYearCache();
      toast.success(r.data.message);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setBusy(false);
  };

  const move = async (s) => {
    try {
      const r = await api("post", "/settings/stray-sheets/move", { type: s.type, id: s._id });
      toast.success(`${s.department.toUpperCase()} sem ${s.semester} ${s.type === "ia" ? "IA" : "attendance"}: ${r.data.message}`);
      setStray((list) => list.filter((x) => x._id !== s._id));
    } catch (e) {
      toast.error(errMsg(e, "Could not move."), 8000);
    }
  };

  const options = [...new Set([...around(), year].filter(Boolean))].sort();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Settings</h2>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-950">Running academic year</p>
        <p className="mt-1 text-sm text-slate-500">
          HODs, the COE and the Exam Officer cannot choose the year – everyone works in this one. Change it once a year, when the
          new academic year starts.
        </p>
        {year === null ? (
          <div className="mt-4 h-11 w-60 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {options.map((y) => (
              <button
                key={y}
                onClick={() => setChoice(y)}
                className={`h-11 rounded-xl border px-4 text-sm font-bold transition ${
                  choice === y ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {y}
                {y === year && <span className="ml-2 text-xs font-medium opacity-80">(now)</span>}
              </button>
            ))}
            {choice !== year && (
              <button onClick={save} disabled={busy} className={`${btn.primary} ml-2`}>
                Save
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-950">Sheets saved under another year</p>
        <p className="mt-1 text-sm text-slate-500">
          IA and attendance sheets that were entered before the year was fixed. If one belongs to {year || "the running year"}, move
          it.
        </p>
        {stray === null && <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" />}
        {stray?.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Icon name="check" className="h-4 w-4" strokeWidth={2.5} /> All sheets are in {year}.
          </p>
        )}
        {stray?.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {stray.map((s) => (
              <li key={s._id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <b>
                    {s.department.toUpperCase()} · Sem {s.semester}
                  </b>{" "}
                  {s.type === "ia" ? "Final IA" : "Final attendance"}
                  <span className="block text-xs text-slate-500">
                    Saved under {s.academicYear} · Batch {s.batch} · {s.status === "confirmed" ? "Frozen" : s.status === "submitted" ? "Submitted" : "Draft"}
                  </span>
                </span>
                <button onClick={() => move(s)} className={btn.small}>
                  Move to {year}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
