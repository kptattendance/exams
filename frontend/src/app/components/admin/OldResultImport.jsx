"use client";

// Admin: bring last year's semester results (from the old results software)
// into the website, so back papers and marks history are known.
//   choose the "Results" Excel → everything is checked, nothing saved
//   → Import (asks for the verification code) → saved.
// Uploading the same file again only updates – nothing is doubled.
// Students who are not in the website yet are listed; import them first,
// then upload the same file again.

import { useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

const STATUS = {
  FAIL: "Fail",
  ABSENT: "Absent",
  NE: "Not eligible",
  WITHHELD: "Withheld (MP)",
};

export default function OldResultImport() {
  const api = useApi();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [show, setShow] = useState("ALL"); // ALL | BACK | EVENING
  const [q, setQ] = useState("");

  const check = async (f) => {
    setFile(f);
    setPreview(null);
    setSaved(null);
    setError("");
    if (!f) return;
    setBusy("check");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api("post", "/old-results/preview", fd);
      setPreview(r.data);
    } catch (e) {
      setError(errMsg(e, "Could not read the Excel file."));
    }
    setBusy("");
  };

  const save = async () => {
    setBusy("import");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api("post", "/old-results", fd);
      setPreview(r.data);
      setSaved(r.data.saved);
      toast.success(r.data.message, 10000);
    } catch (e) {
      if (e?.response?.data?.preview) setPreview(e.response.data.preview);
      setError(errMsg(e, "The results could not be imported."));
    }
    setBusy("");
  };

  const students = useMemo(() => {
    const list = preview?.students || [];
    const s = q.trim().toUpperCase();
    return list.filter(
      (x) =>
        (show === "ALL" || (show === "BACK" && x.backPapers.length) || (show === "EVENING" && x.evening)) &&
        (!s || x.regNo.includes(s) || String(x.name || "").toUpperCase().includes(s))
    );
  }, [preview, show, q]);

  const t = preview?.totals;
  const errors = (preview?.problems || []).filter((p) => p.level === "error");
  const warnings = (preview?.problems || []).filter((p) => p.level === "warning");
  const withBack = (preview?.students || []).filter((x) => x.backPapers.length).length;

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-950">Import old results</h1>
      <p className="mt-1 text-sm text-slate-600">
        Semester results of earlier exams (e.g. 25S, 26A) from the old results software – for back papers and the marks history of 2nd / 3rd-year
        students. Upload the <b>Results</b> Excel (.xlsx) as it comes from that software – not the PDF.
      </p>
      <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
        <li>Import the students first (Import 2nd / 3rd-year students). Rows of students not yet in the website are left out and listed below.</li>
        <li>Uploading the same file again is safe: results are updated, never doubled.</li>
        <li>Evening college students (register numbers 186…) are taken in the same way.</li>
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => check(e.target.files?.[0] || null)} className="text-sm" />
        {busy === "check" && <span className="text-sm text-slate-600">Checking… please wait</span>}
        {preview && !errors.length && t?.ready > 0 && (
          <button onClick={save} disabled={!!busy} className={btn.primary}>
            <Icon name="check" className="h-4 w-4" />
            {busy === "import" ? "Importing… please wait" : saved ? "Import again" : `Import ${t.ready} results`}
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Saved ✓ {saved.added} added · {saved.updated} updated · {saved.unchanged} unchanged.
        </p>
      )}

      {preview && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Rows in file", t.rows],
              ["Ready", t.ready],
              ["Students not in website", preview.missingStudents.length],
              ["Errors", t.errors],
              ["Warnings", t.warnings],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</p>
                <p className="text-xl font-bold tabular-nums text-slate-900">{Number(v || 0).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          {preview.exams.length > 0 && (
            <p className="mt-3 text-sm text-slate-700">
              Exams in this file:{" "}
              {preview.exams.map((e) => (
                <span key={e.code} className="mr-3">
                  <b>{e.code}</b> – {e.rows} rows, {e.pass} pass, {e.notPass} not pass
                </span>
              ))}
              {t.skipped > 0 && <span className="text-slate-500">· {t.skipped} “not registered (X)” rows left out</span>}
            </p>
          )}

          {errors.length > 0 && (
            <Problems title={`Errors – fix these in the Excel (or add the subject) and upload again. Nothing can be imported until then.`} list={errors} tone="red" />
          )}
          {warnings.length > 0 && <Problems title="Warnings – will be imported, but please check" list={warnings} tone="yellow" />}
          {preview.moreProblems > 0 && <p className="mt-1 text-xs text-slate-500">…and {preview.moreProblems} more not shown.</p>}

          {preview.missingStudents.length > 0 && (
            <details className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <summary className="cursor-pointer font-semibold">
                {preview.missingStudents.length} students are not in the website yet ({t.missingStudentRows} rows left out) – import them, then upload this file again
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preview.missingStudents.map((m) => (
                  <span key={m.regNo} className="rounded bg-white px-2 py-0.5 font-mono text-xs">
                    {m.regNo}
                    {m.evening ? " (evening)" : ""}
                  </span>
                ))}
              </div>
            </details>
          )}

          {preview.students.length > 0 && (
            <section className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-lg font-bold text-slate-950">Students ({preview.students.length}) · {withBack} with back papers</h2>
                {[
                  ["ALL", "All"],
                  ["BACK", "With back papers"],
                  ["EVENING", "Evening college"],
                ].map(([k, l]) => (
                  <button key={k} onClick={() => setShow(k)} className={show === k ? btn.primary : btn.small}>
                    {l}
                  </button>
                ))}
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reg no / name" className="h-9 w-52 rounded-xl border border-slate-300 px-3 text-sm" />
              </div>
              <div className="mt-2 max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Register no.</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Dept</th>
                      <th className="px-3 py-2 text-right">Passed</th>
                      <th className="px-3 py-2">Back papers (latest attempt)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.regNo} className={`border-t border-slate-100 ${s.backPapers.length ? "bg-red-50/40" : ""}`}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {s.regNo}
                          {s.evening && <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-indigo-800">Evening</span>}
                        </td>
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2">{s.department}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.passed} / {s.subjects}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {s.backPapers.length ? (
                            s.backPapers.map((b) => (
                              <span key={b.subjectId} className="mr-1.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-red-800" title={`${b.examCode} · semester ${b.semester}`}>
                                {b.subjectId} · {STATUS[b.status] || b.status}
                              </span>
                            ))
                          ) : (
                            <span className="text-emerald-700">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Problems({ title, list, tone }) {
  const box = tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-yellow-200 bg-yellow-50 text-yellow-900";
  return (
    <details open={tone === "red"} className={`mt-4 rounded-xl border p-3 text-sm ${box}`}>
      <summary className="cursor-pointer font-semibold">
        {title} ({list.length})
      </summary>
      <ul className="mt-2 max-h-64 space-y-0.5 overflow-auto text-xs">
        {list.map((p, i) => (
          <li key={i}>
            Row {p.row} · {p.regNo} · {p.subId} · {p.examCode}: {p.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
