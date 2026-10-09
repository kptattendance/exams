"use client";

// 1st-year student import (used by both Admin and COE pages).
//   Import Excel  : upload -> preview with problems -> import -> progress
//   Upload photos : photos named by roll / register number
//   Import history: continue, download register numbers, undo

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import * as XLSX from "xlsx";

import Icon from "../shell/Icon";
import { useConfirm, useToast } from "../ui/Feedback";

const API = `${process.env.NEXT_PUBLIC_API_URL}/api/student-import`;

const TYPE_LABEL = {
  regular: "Regular",
  "lateral-puc": "Lateral (PUC)",
  "lateral-iti": "Lateral (ITI)",
  "lateral-iti-cross": "Lateral (ITI, cross)",
};

const fmtDate = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (method, path, data, extra = {}) => {
      const token = await getToken();
      return axios({ method, url: `${API}${path}`, data, headers: { Authorization: `Bearer ${token}` }, ...extra });
    },
    [getToken]
  );
}

const errMsg = (e, fallback) => e?.response?.data?.error || fallback;

export default function StudentImport() {
  const [tab, setTab] = useState("import");
  const [openImportId, setOpenImportId] = useState(null);
  const [historyKey, setHistoryKey] = useState(0); // bump to reload lists
  const undo = useUndoFlow();

  const open = (id) => {
    setOpenImportId(id);
    setTab("import");
  };
  const refreshLists = () => setHistoryKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Import 1st-year students</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Upload the office Excel. Every row is checked first, and register numbers are given in roll-number order.
            Nothing is saved until you confirm.
          </p>
        </div>
        <TemplateButton />
      </div>

      <div className="no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          ["import", "New import", "New", "students"],
          ["photos", "Upload photos", "Photos", "profile"],
          ["history", "Import history", "History", "list"],
        ].map(([key, label, short, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition sm:flex-none sm:justify-start sm:px-4 ${
              tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon name={icon} className="h-4 w-4" />
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "import" && (
        <ImportTab
          key={historyKey}
          openImportId={openImportId}
          onOpened={() => setOpenImportId(null)}
          onOpen={open}
          onShowHistory={() => setTab("history")}
          undo={undo}
          onChanged={refreshLists}
        />
      )}
      {tab === "photos" && <PhotosTab />}
      {tab === "history" && <HistoryTab key={historyKey} onOpen={open} undo={undo} onChanged={refreshLists} />}

      {undo.modal}
    </div>
  );
}

// ------------------------------------------------------- shared helpers

async function downloadRegisterNumbers(api, doc) {
  const r = await api("get", `/${doc._id}/export`, undefined, { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `register_numbers_${(doc.departments || []).join("_").toUpperCase() || "students"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Confirm, then undo an import step by step with a progress window. */
function useUndoFlow() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [state, setState] = useState(null); // { fileName, removed, total }

  const run = async (doc, onDone) => {
    const created = doc.summary?.created ?? 0;
    const ok = await confirm({
      title: "Undo this import?",
      message:
        `This removes the ${created} ${created === 1 ? "student" : "students"} created from “${doc.fileName}”, ` +
        "including their login accounts and photos, and frees their register numbers so the Excel can be imported again.\n\n" +
        "Use this only if the import was a mistake. It cannot be reversed.",
      confirmText: "Undo import",
      tone: "danger",
      requireText: "UNDO",
    });
    if (!ok) return;

    setState({ fileName: doc.fileName, removed: 0, total: doc.summary?.total || 0 });
    let busyTries = 0;
    for (;;) {
      try {
        const r = await api("post", `/${doc._id}/undo`, { confirm: "UNDO" });
        setState((st) => ({ ...st, removed: r.data.removed, total: r.data.total }));
        if (r.data.done) {
          toast.success(
            r.data.numbersReleased
              ? `Import undone. ${r.data.total} students removed and their register numbers are free again.`
              : `Import undone. ${r.data.total} students removed. Some register numbers stay used because newer ones were issued after this import.`,
            7000
          );
          break;
        }
      } catch (e) {
        if (e?.response?.status === 409 && busyTries < 10) {
          busyTries++;
          await new Promise((res) => setTimeout(res, 3000));
          continue;
        }
        toast.error(errMsg(e, "Undo stopped because of a network problem. Click Undo again to finish it."));
        break;
      }
    }
    setState(null);
    onDone?.();
  };

  const modal = state && (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-red-100 border-t-red-600" />
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-tight text-slate-950">Undoing import…</p>
            <p className="truncate text-sm text-slate-500">{state.fileName}</p>
          </div>
        </div>
        <div className="mt-6 mb-2 flex justify-between text-sm">
          <span className="font-medium text-slate-700">Students removed</span>
          <span className="tabular-nums text-slate-500">
            {state.removed} / {state.total}
          </span>
        </div>
        <Bar value={state.removed} total={state.total} tone="bg-red-600" />
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Keep this page open. Login accounts and photos are deleted along with each student.
        </p>
      </div>
    </div>
  );

  return { run, modal, busy: Boolean(state) };
}

// ------------------------------------------------------------------ cards

const STATUS_CHIP = (d) => {
  const s = d.summary;
  if (d.status === "UNDOING") return ["Undo not finished", "bg-red-50 text-red-700"];
  if (d.status !== "DONE") return ["In progress", "bg-blue-50 text-blue-700"];
  if (s.failed || s.photosFailed) return ["Done – needs attention", "bg-orange-50 text-orange-700"];
  return ["Done", "bg-emerald-50 text-emerald-700"];
};

function ImportCard({ doc, onOpen, onUndo, compact }) {
  const api = useApi();
  const toast = useToast();
  const [label, cls] = STATUS_CHIP(doc);
  const s = doc.summary;
  const photoTotal = s.photosDone + s.photosFailed + s.photosPending;
  const unfinishedUndo = doc.status === "UNDOING";

  return (
    <li className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-slate-900">{doc.fileName}</p>
          <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {fmtDate(doc.createdAt)} · {(doc.departments || []).join(", ").toUpperCase()} · by {doc.createdByEmail || "—"}
        </p>
        {!compact && (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-semibold tabular-nums text-slate-900">{s.created}</span> of {s.total} students created
            {photoTotal > 0 && (
              <>
                {" "}· <span className="font-semibold tabular-nums text-slate-900">{s.photosDone}</span> of {photoTotal} photos
              </>
            )}
            {s.failed > 0 && <span className="text-red-700"> · {s.failed} failed</span>}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!unfinishedUndo && (
          <button
            onClick={() => onOpen(doc._id)}
            className="rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {doc.status === "DONE" ? "View details" : "Continue import"}
          </button>
        )}
        {!unfinishedUndo && (
          <button
            onClick={() =>
              downloadRegisterNumbers(api, doc).catch((e) => toast.error(errMsg(e, "Download failed.")))
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="report" className="h-4 w-4 text-slate-500" />
            Excel
          </button>
        )}
        <button
          onClick={() => onUndo(doc)}
          className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          {unfinishedUndo ? "Finish undo" : "Undo import"}
        </button>
      </div>
    </li>
  );
}

function useImportList(limit) {
  const api = useApi();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    api("get", "/")
      .then((r) => {
        const all = Array.isArray(r.data?.data) ? r.data.data : [];
        setList(limit ? all.slice(0, limit) : all);
      })
      .catch((e) => setError(errMsg(e, "Could not load imports.")));
  }, [api, limit]);
  useEffect(load, [load]);
  return { list, error, reload: load };
}

function RecentImports({ onOpen, onUndo, onShowHistory }) {
  const { list } = useImportList(3);
  if (!list?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-sm font-semibold text-slate-900">Recent imports</p>
        <button onClick={onShowHistory} className="text-sm font-semibold text-blue-700 hover:underline">
          See all
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {list.map((d) => (
          <ImportCard key={d._id} doc={d} onOpen={onOpen} onUndo={onUndo} compact />
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ import

function ImportTab({ openImportId, onOpened, onOpen, onShowHistory, undo, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [stage, setStage] = useState("pick"); // pick | checking | preview | starting | running
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [importDoc, setImportDoc] = useState(null);

  useEffect(() => {
    if (!openImportId) return;
    api("get", `/${openImportId}`)
      .then((r) => {
        setImportDoc(r.data.data);
        setStage("running");
      })
      .catch((e) => toast.error(errMsg(e, "Could not open that import.")))
      .finally(onOpened);
  }, [openImportId, api, onOpened, toast]);

  const check = async (f) => {
    setFile(f);
    setError("");
    setPreview(null);
    setStage("checking");
    try {
      const body = new FormData();
      body.append("file", f);
      const r = await api("post", "/preview", body);
      setPreview(r.data);
      setStage("preview");
    } catch (e) {
      setError(errMsg(e, "Could not read the Excel file."));
      setStage("pick");
    }
  };

  const start = async () => {
    setError("");
    setStage("starting");
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await api("post", "/", body);
      setImportDoc(r.data.data);
      setStage("running");
      toast.info("Register numbers reserved. Creating students now…");
    } catch (e) {
      if (e?.response?.data?.preview) setPreview(e.response.data.preview);
      setError(errMsg(e, "Import could not start."));
      setStage("preview");
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setImportDoc(null);
    setError("");
    setStage("pick");
  };

  const undoThen = (doc, after) => undo.run(doc, () => (after?.(), onChanged()));

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Icon name="close" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {(stage === "pick" || stage === "checking") && (
        <>
          <Dropzone busy={stage === "checking"} fileName={file?.name} onFile={check} />
          {stage === "pick" && <RecentImports onOpen={onOpen} onUndo={(d) => undoThen(d)} onShowHistory={onShowHistory} />}
        </>
      )}

      {(stage === "preview" || stage === "starting") && preview && (
        <Preview
          preview={preview}
          starting={stage === "starting"}
          onStart={start}
          onReset={reset}
          onRecheck={() => check(file)}
        />
      )}

      {stage === "running" && importDoc && (
        <Progress initial={importDoc} onReset={reset} onUndo={(d) => undoThen(d, reset)} undoBusy={undo.busy} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- template

function TemplateButton() {
  const download = () => {
    const headers = [
      "Roll Number", "Student Name", "Father Name", "Mother Name", "DOB", "Gender", "Email id",
      "Phone Number", "Parent Phone", "Caste", "Category", "Aadhaar Number", "Course", "AdmissionYear",
      "Batch", "Batch Number", "Semester", "Status", "Student Photo", "Admission Type", "SATS Number",
    ];
    const example = [
      "AT26001", "STUDENT NAME", "FATHER NAME", "MOTHER NAME", "24-12-2009", "male", "student@gmail.com",
      "9876543210", "9876543211", "", "GM", "234567890123", "at", "2026", "2026-2029", "1", "1", "active",
      "https://drive.google.com/file/d/…/view", "regular", "",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Allowed values"],
      ["Course", "at, ch, ce, cs, ec, ee, me, ps"],
      ["Admission Type", "regular, lateral-puc, lateral-iti, lateral-iti-cross"],
      ["Semester", "1 for regular, 3 for lateral"],
      ["AdmissionYear", "Regular: year of admission. Lateral: year of joining (2nd year)."],
      ["Batch", "Optional – worked out automatically (e.g. 2026-2029 for students admitted in 2026)"],
      ["Batch Number", "1 or 2"],
      ["DOB", "A date, or dd-mm-yyyy"],
      ["Student Photo", "Google Drive link (folder shared as 'Anyone with the link'), or leave empty"],
      ["Register Number", "Not needed – the system generates it"],
    ]);
    notes["!cols"] = [{ wch: 18 }, { wch: 70 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.utils.book_append_sheet(wb, notes, "How to fill");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };
  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      <Icon name="report" className="h-4 w-4 text-slate-500" />
      Excel template
    </button>
  );
}

function Dropzone({ busy, fileName, onFile }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) onFile(f);
        }}
        onClick={() => !busy && input.current?.click()}
        className={`ruled-paper flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition ${
          over ? "border-blue-500 bg-blue-50/40" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {busy ? (
          <>
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            <p className="mt-4 text-sm font-semibold text-slate-800">Checking {fileName}…</p>
            <p className="mt-1 text-xs text-slate-500">Reading every row and looking for duplicates</p>
          </>
        ) : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Icon name="students" className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-semibold text-slate-900">Drop the student Excel here</p>
            <p className="mt-1 text-sm text-slate-500">or click to choose a file (.xlsx, .xls, .csv – up to 4 MB)</p>
          </>
        )}
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onFile(f);
          }}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <p className="font-semibold text-slate-900">How register numbers are given</p>
        <table className="mt-3 w-full text-left text-[13px]">
          <tbody className="divide-y divide-slate-100">
            {[
              ["Regular", "103AT26001", "admission year"],
              ["Lateral (ITI)", "103AT27301", "joining year"],
              ["Lateral (ITI, cross)", "103AT27401", "joining year"],
              ["Lateral (PUC)", "103AT27701", "joining year"],
            ].map(([t, ex, y]) => (
              <tr key={t}>
                <td className="py-2 pr-2 text-slate-600">{t}</td>
                <td className="py-2 pr-2 font-semibold tabular-nums text-blue-800">{ex}</td>
                <td className="py-2 text-xs text-slate-400">{y}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-4 space-y-2 text-[13px] leading-5 text-slate-600">
          <li className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Numbers follow roll-number order and are never reused.
          </li>
          <li className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            If any row has an error, nothing is imported until it is fixed.
          </li>
          <li className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Photos are copied from Google Drive if the folder is shared as “Anyone with the link”.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Preview({ preview, starting, onStart, onReset, onRecheck }) {
  const api = useApi();
  const toast = useToast();
  const [repairing, setRepairing] = useState(false);

  const freeNumbers = async (keys) => {
    setRepairing(true);
    try {
      const r = await api("post", "/numbering/repair", { keys });
      const ch = r.data.changes || [];
      toast.success(
        ch.length
          ? `Unused numbers freed. ${ch.map((c) => `${c.series}: next number is ${c.nextNumber}`).join("; ")}.`
          : "Nothing to free – these numbers belong to real students or an open import.",
        7000
      );
      await onRecheck();
    } catch (e) {
      toast.error(errMsg(e, "Could not free the numbers."));
    } finally {
      setRepairing(false);
    }
  };

  const { summary, rows } = preview;
  const [filter, setFilter] = useState(summary.errors ? "errors" : "all");

  const shown = useMemo(() => {
    const isErr = (r) => r.problems.some((p) => p.level === "error");
    if (filter === "errors") return rows.filter(isErr);
    if (filter === "warnings") return rows.filter((r) => !isErr(r) && r.problems.length);
    return rows;
  }, [rows, filter]);

  const canImport = summary.errors === 0 && summary.ready > 0;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-500">{preview.fileName}</p>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-950">
              {canImport
                ? `${summary.ready} students ready to import`
                : summary.errors
                  ? `${summary.errors} ${summary.errors === 1 ? "row needs" : "rows need"} fixing before import`
                  : "No students to import"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onReset}
              disabled={starting}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Choose another file
            </button>
            <button
              onClick={onStart}
              disabled={!canImport || starting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {starting
                ? "Reserving register numbers…"
                : summary.errors
                  ? `Fix ${summary.errors} ${summary.errors === 1 ? "error" : "errors"} to import`
                  : `Import ${summary.ready} students`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-4 sm:divide-x">
          {[
            ["Rows in file", summary.total, "text-slate-900"],
            ["Ready", summary.ready, "text-emerald-700"],
            ["Errors", summary.errors, summary.errors ? "text-red-600" : "text-slate-400"],
            ["With photo link", summary.withPhoto, "text-slate-900"],
          ].map(([l, v, c]) => (
            <div key={l} className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">{l}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {summary.errors > 0 && (
          <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
            Correct the rows marked in red in your Excel, then choose the file again. Register numbers are shown once
            every row is correct, so they follow the roll numbers exactly.
          </div>
        )}

        {summary.errors === 0 && summary.series.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Register numbers to be given</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.series.map((s) => (
                <span
                  key={`${s.department}-${s.year}-${s.type}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-1.5 text-sm"
                >
                  <span className="font-semibold text-slate-800">
                    {s.department} {s.typeLabel}
                  </span>
                  <span className="tabular-nums text-blue-800">
                    {s.first}
                    {s.count > 1 ? ` – ${s.last.slice(-3)}` : ""}
                  </span>
                  <span className="text-xs text-slate-500">({s.count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {summary.errors === 0 &&
        summary.series
          .filter((x) => x.alreadyUsed > 0 || x.reservedOnly > 0)
          .map((x) => (
            <div
              key={`warn-${x.department}-${x.year}-${x.type}`}
              className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-orange-900"
            >
              <p className="font-semibold">
                {x.department} {x.typeLabel} numbers will start at {x.first}, not at{" "}
                {x.first.slice(0, -3)}
                {String(x.startsAt).padStart(3, "0")}
              </p>
              {x.alreadyUsed > 0 && (
                <>
                  <p className="mt-1">
                    {x.alreadyUsed === 1
                      ? "This number already belongs to a student in the system:"
                      : `These ${x.alreadyUsed} numbers already belong to students in the system:`}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {x.holders.map((h) => (
                      <li key={h.registerNumber} className="tabular-nums">
                        <span className="font-semibold">{h.registerNumber}</span> · {h.rollNumber} · {h.name}
                      </li>
                    ))}
                    {x.alreadyUsed > x.holders.length && <li>…and {x.alreadyUsed - x.holders.length} more</li>}
                  </ul>
                </>
              )}
              {x.reservedOnly > 0 && (
                <div className="mt-2 flex flex-col gap-3 rounded-xl bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {x.reservedOnly} number{x.reservedOnly === 1 ? " is" : "s are"} held back without a student – usually
                    left over from a deleted or undone import.
                  </p>
                  <button
                    onClick={() => freeNumbers([x.key])}
                    disabled={repairing}
                    className="shrink-0 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {repairing ? "Freeing…" : "Free unused numbers"}
                  </button>
                </div>
              )}
              {x.alreadyUsed > 0 && (
                <p className="mt-2 text-orange-800">
                  If {x.alreadyUsed === 1 ? "that is a test record, delete it" : "those are test records, delete them"} in
                  Students first, then click “Free unused numbers” or choose this file again. Otherwise you can import as shown.
                </p>
              )}
            </div>
          ))}

      {/* Rows */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-slate-100 p-3">
          {[
            ["all", `All rows (${summary.total})`],
            ["errors", `Errors (${summary.errors})`],
            ["warnings", `Warnings (${summary.warnings})`],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                filter === k ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nothing to show here.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                    <th className="px-4 py-2.5">Row</th>
                    <th className="px-3 py-2.5">Roll no.</th>
                    <th className="px-3 py-2.5">Register no.</th>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((r) => (
                    <tr key={r.rowNumber} className="align-top">
                      <td className="px-4 py-3 tabular-nums text-slate-400">{r.rowNumber}</td>
                      <td className="px-3 py-3 font-medium tabular-nums text-slate-700">{r.rollNumber || "—"}</td>
                      <td className="px-3 py-3 font-semibold tabular-nums text-blue-800">{r.registerNumber || "—"}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">{r.name || "—"}</p>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {r.department} · {TYPE_LABEL[r.admissionType] || "—"}
                        <p className="text-xs text-slate-400">
                          Sem {r.semester || "?"} · Batch {r.batchNumber || "?"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Problems problems={r.problems} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {shown.map((r) => (
                <li key={r.rowNumber} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{r.name || "—"}</p>
                      <p className="text-xs text-slate-500">
                        Row {r.rowNumber} · {r.rollNumber} · {TYPE_LABEL[r.admissionType] || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-blue-800">{r.registerNumber || "—"}</span>
                  </div>
                  <div className="mt-2">
                    <Problems problems={r.problems} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Problems({ problems }) {
  if (!problems.length)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.25} /> Ready
      </span>
    );
  return (
    <ul className="space-y-1">
      {problems.map((p, i) => (
        <li
          key={i}
          className={`flex gap-1.5 text-xs leading-5 ${p.level === "error" ? "font-medium text-red-700" : "text-orange-700"}`}
        >
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${p.level === "error" ? "bg-red-500" : "bg-orange-400"}`} />
          {p.message}
        </li>
      ))}
    </ul>
  );
}

function Bar({ value, total, tone = "bg-blue-600" }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Progress({ initial, onReset, onUndo, undoBusy }) {
  const api = useApi();
  const toast = useToast();
  const [doc, setDoc] = useState(initial);
  const [running, setRunning] = useState(initial.status !== "DONE");
  const [error, setError] = useState("");
  const stop = useRef(false);

  const loop = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setError("");
    while (!stop.current) {
      try {
        const r = await api("post", `/${initial._id}/process`);
        setDoc(r.data.data);
        if (r.data.done) {
          const sm = r.data.data.summary;
          if (sm.failed) toast.error(`${sm.created} students imported, ${sm.failed} failed. See “Needs attention” below.`, 8000);
          else toast.success(`All ${sm.created} students imported.`);
          break;
        }
      } catch (e) {
        setError(errMsg(e, "Processing paused because of a network problem."));
        break;
      }
    }
    setRunning(false);
  }, [api, initial._id, toast]);

  useEffect(() => {
    if (initial.status !== "DONE") loop();
    return () => {
      stop.current = true;
    };
  }, [initial, loop]);

  const retry = async () => {
    try {
      const r = await api("post", `/${initial._id}/retry`);
      setDoc(r.data.data);
      loop();
    } catch (e) {
      setError(errMsg(e, "Could not retry."));
    }
  };

  const download = () => downloadRegisterNumbers(api, doc).catch((e) => toast.error(errMsg(e, "Download failed.")));

  const undo = () => {
    stop.current = true;
    onUndo(doc);
  };

  const s = doc.summary;
  const photoTotal = s.photosDone + s.photosFailed + s.photosPending;
  const failedRows = doc.rows?.filter((r) => r.state === "FAILED" || r.photoState === "FAILED") || [];
  const finished = !running && doc.status === "DONE";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">{doc.fileName}</p>
            <p className="mt-0.5 text-lg font-bold tracking-tight text-slate-950">
              {running
                ? "Importing students…"
                : finished
                  ? s.failed
                    ? `${s.created} imported, ${s.failed} failed`
                    : `All ${s.created} students imported`
                  : "Import paused"}
            </p>
            {running && <p className="mt-1 text-xs text-slate-500">Keep this page open. You can come back later from Import history.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!running && doc.status !== "DONE" && (
              <button onClick={loop} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Continue
              </button>
            )}
            {!running && failedRows.length > 0 && (
              <button onClick={retry} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Retry failed
              </button>
            )}
            {!running && (
              <button
                onClick={undo}
                disabled={undoBusy}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Undo import
              </button>
            )}
            <button
              onClick={download}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Icon name="report" className="h-4 w-4" />
              Register numbers (Excel)
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">Students created</span>
              <span className="tabular-nums text-slate-500">
                {s.created} / {s.total}
              </span>
            </div>
            <Bar value={s.created} total={s.total} />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-700">Photos copied</span>
              <span className="tabular-nums text-slate-500">
                {s.photosDone} / {photoTotal}
              </span>
            </div>
            <Bar value={s.photosDone} total={photoTotal} tone="bg-emerald-600" />
          </div>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {failedRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Needs attention ({failedRows.length})</p>
          <ul className="divide-y divide-slate-100">
            {failedRows.map((r) => (
              <li key={r.registerNumber} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                <span className="w-28 shrink-0 font-semibold tabular-nums text-blue-800">{r.registerNumber}</span>
                <span className="w-48 shrink-0 truncate text-slate-800">{r.name}</span>
                <span className="text-xs text-red-700">
                  {r.state === "FAILED" ? `Student not created: ${r.error}` : `Photo: ${r.photoError}`}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Missing photos can also be uploaded in the “Upload photos” tab, named by roll or register number.
          </p>
        </div>
      )}

      {finished && (
        <button onClick={onReset} className="text-sm font-semibold text-blue-700 hover:underline">
          Import another file
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ photos

async function shrinkImage(file) {
  // Phone photos can be 5+ MB; resize to max 900px so uploads are quick
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function PhotosTab() {
  const api = useApi();
  const input = useRef(null);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const add = async (files) => {
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (!list.length) return;
    const start = items.length;
    setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, state: "waiting", note: "" }))]);
    setBusy(true);
    for (let i = 0; i < list.length; i++) {
      const idx = start + i;
      const update = (patch) => setItems((prev) => prev.map((it, j) => (j === idx ? { ...it, ...patch } : it)));
      update({ state: "uploading" });
      try {
        const small = await shrinkImage(list[i]);
        const body = new FormData();
        body.append("photo", small, list[i].name);
        const r = await api("post", "/photo", body);
        update({ state: "done", note: `${r.data.data.registerNumber} · ${r.data.data.name}`, url: r.data.data.imageUrl });
      } catch (e) {
        update({ state: "failed", note: errMsg(e, "Upload failed.") });
      }
    }
    setBusy(false);
  };

  const done = items.filter((i) => i.state === "done").length;
  const failed = items.filter((i) => i.state === "failed").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) add(e.dataTransfer.files);
          }}
          onClick={() => !busy && input.current?.click()}
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-center hover:border-slate-400"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon name="profile" className="h-7 w-7" />
          </span>
          <p className="mt-4 text-base font-semibold text-slate-900">Drop student photos here</p>
          <p className="mt-1 text-sm text-slate-500">Select many at once. JPG, PNG or WEBP.</p>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">Name each photo by the student</p>
          <p className="mt-1">
            Use the roll number or register number as the file name, for example{" "}
            <span className="font-semibold text-slate-800">AT26001.jpg</span> or{" "}
            <span className="font-semibold text-slate-800">103AT26001.jpg</span>. A new photo replaces the old one.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-slate-900">Uploaded</p>
          <p className="text-xs tabular-nums text-slate-500">
            {done} done{failed ? ` · ${failed} failed` : ""}
          </p>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Photos you upload will be listed here.</p>
        ) : (
          <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                {it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="h-10 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-10 w-8 shrink-0 rounded bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{it.name}</p>
                  <p className={`truncate text-xs ${it.state === "failed" ? "text-red-700" : "text-slate-500"}`}>
                    {it.state === "waiting" ? "Waiting…" : it.state === "uploading" ? "Uploading…" : it.note}
                  </p>
                </div>
                {it.state === "done" && <Icon name="check" className="h-4 w-4 text-emerald-600" strokeWidth={2.25} />}
                {it.state === "uploading" && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- history

function HistoryTab({ onOpen, undo, onChanged }) {
  const { list, error, reload } = useImportList();

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!list) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm sm:grid-cols-3">
        <p>
          <span className="font-semibold text-slate-900">View details / Continue</span> – see each student&apos;s result,
          finish an import that stopped, or retry failed rows.
        </p>
        <p>
          <span className="font-semibold text-slate-900">Excel</span> – download the list of students with their new register
          numbers for the office.
        </p>
        <p>
          <span className="font-semibold text-red-700">Undo import</span> – removes every student created by that Excel
          (with logins and photos) and frees the register numbers. Use it only for a wrong import.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No imports yet. Use “New import” to upload the first Excel.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {list.map((d) => (
            <ImportCard
              key={d._id}
              doc={d}
              onOpen={onOpen}
              onUndo={(doc) =>
                undo.run(doc, () => {
                  reload();
                  onChanged();
                })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
