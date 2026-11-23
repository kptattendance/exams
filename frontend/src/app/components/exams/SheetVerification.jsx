"use client";

// COE: verification of the frozen Final IA / Final attendance sheets.
//   1. HOD prints the BEFORE verification copy; the verifier marks changes on it
//   2. The COE or the Admin types those changes here – each one is recorded, old -> new
//   3. The COE gives the FINAL freeze: nobody can change the sheet after that
//   4. The HOD prints the AFTER verification copy

import { Fragment, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../shell/Icon";
import Modal, { btn } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { deptTint } from "../ui/deptTint";
import { deptLabel, errMsg, useApi } from "./shared";
import { T } from "../ui/table";
import { openSignatureSheet } from "../HodSheetPanel";
import { useRole } from "../useRole";

const TITLE = { ia: "Final IA", attendance: "Final attendance" };
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const shownOf = (type, c) => (c.value === null || c.value === undefined ? "" : type === "ia" ? round2(c.value) : c.pct === null || c.pct === undefined ? "" : round2(c.pct));
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function SheetVerification() {
  const api = useApi();
  const toast = useToast();
  const role = useRole();
  const canEdit = role === "coe" || role === "admin";
  const [type, setType] = useState("ia");
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState("");
  const [show, setShow] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/sheet-review", undefined, { params: { type, status: "confirmed" } });
      setList(r.data.data || []);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load the sheets."));
    }
  }, [api, type, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const departments = [...new Set((list || []).map((x) => x.department))].sort();
  const semesters = [...new Set((list || []).map((x) => x.semester))].sort((a, b) => a - b);
  // the day college first, the evening college separately at the end;
  // inside each: department by department, semester by semester
  const shown = (list || [])
    .filter((x) => (!dept || x.department === dept) && (!sem || String(x.semester) === sem) && (!show || (show === "done" ? x.verified : !x.verified)))
    .sort((a, b) => (a.shift === "EVENING") - (b.shift === "EVENING") || a.department.localeCompare(b.department) || a.semester - b.semester);
  const dayCount = shown.filter((x) => x.shift !== "EVENING").length;
  const done = (list || []).filter((x) => x.verified).length;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-950">IA &amp; attendance verification</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {Object.entries(TITLE).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setList(null);
                setType(k);
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${type === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={T.field} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d.toUpperCase()} – {deptLabel(d)}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={T.field} aria-label="Semester">
          <option value="">All semesters</option>
          {semesters.map((n) => (
            <option key={n} value={String(n)}>
              Sem {n}
            </option>
          ))}
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value)} className={T.field} aria-label="Status">
          <option value="">All</option>
          <option value="wait">Waiting for final freeze</option>
          <option value="done">Finally frozen</option>
        </select>
        {list && (
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${list.length && done === list.length ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
            {done} / {list.length} finally frozen
          </span>
        )}
      </div>

      <div className={`mt-2 ${T.wrap}`}>
        {list === null && <div className="h-40 animate-pulse" />}
        {list && shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No frozen sheets here.</p>}
        {shown.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Department</th>
                <th className={T.th}>Sem</th>
                <th className={T.th}>Batch</th>
                <th className={`${T.th} text-right`}>Students</th>
                <th className={`${T.th} text-right`}>Corrections</th>
                <th className={T.th}>Status</th>
                <th className={`${T.th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {shown.map((s, i) => {
                const t = deptTint(s.department);
                const evening = s.shift === "EVENING";
                return (
                  <Fragment key={s._id}>
                  {evening && i === dayCount && (
                    <tr className="bg-indigo-100">
                      <td colSpan={8} className="px-3 py-1 text-xs font-bold text-indigo-900">
                        Evening college
                      </td>
                    </tr>
                  )}
                  <tr className={`${T.row} border-l-4 ${t.edge} ${i % 2 ? t.row : "bg-white"}`}>
                    <td className={T.tdNum}>{evening ? i - dayCount + 1 : i + 1}</td>
                    <td className={T.td}>
                      <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${t.chip}`}>{s.department.toUpperCase()}</span>
                      <span className="ml-2 text-xs text-slate-600">{deptLabel(s.department)}</span>
                    </td>
                    <td className={`${T.td} text-xs font-semibold`}>{s.semester}</td>
                    <td className={`${T.td} text-xs text-slate-600`}>{s.batch}</td>
                    <td className={`${T.td} text-right text-xs tabular-nums`}>{s.students}</td>
                    <td className={`${T.td} text-right text-xs font-semibold tabular-nums`}>{s.corrections || "–"}</td>
                    <td className={T.td}>
                      {s.verified ? (
                        <span className={`${T.pill} bg-emerald-100 text-emerald-800`}>
                          <Icon name="lock" className="h-3 w-3" />
                          Finally frozen · {fmt(s.verifiedAt)}
                        </span>
                      ) : (
                        <span className={`${T.pill} bg-sky-100 text-sky-800`}>Waiting for verification</span>
                      )}
                    </td>
                    <td className={`${T.td} text-right`}>
                      <button onClick={() => setOpen(s._id)} className={btn.small}>
                        {s.verified || !canEdit ? "View" : "Open & correct"}
                      </button>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <SheetModal
          type={type}
          id={open}
          canEdit={canEdit}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function SheetModal({ type, id, canEdit, onClose, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [sheet, setSheet] = useState(null);
  const [edits, setEdits] = useState({}); // "studentId|subjectId" -> typed value
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState(null); // the student whose photo is open full page

  // Esc closes the photo only, not the sheet behind it
  useEffect(() => {
    if (!photo) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPhoto(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [photo]);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/sheet-review/${type}/${id}`);
      setSheet(r.data.data);
      setEdits({});
    } catch (e) {
      toast.error(errMsg(e, "Could not open the sheet."));
      onClose();
    }
  }, [api, type, id, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  // nothing below may run before the sheet has arrived
  if (!sheet)
    return (
      <Modal open full onClose={onClose} title="Loading…">
        <div className="h-64 animate-pulse rounded-xl bg-slate-50" />
      </Modal>
    );

  const verified = sheet?.verification?.state === "verified";
  const editable = canEdit && sheet && !verified && !sheet.resultsPublished;
  const fixOf = new Map((sheet ? sheet.verification?.corrections || [] : []).map((c) => [`${c.studentId}|${c.subjectId}`, c]));

  const changes = [];
  if (sheet)
    for (const st of sheet.students)
      sheet.subjects.forEach((sub, i) => {
        const k = `${st.studentId}|${sub.subjectId}`;
        if (edits[k] === undefined) return;
        if (String(edits[k]).trim() !== String(shownOf(type, st.cells[i]))) changes.push({ studentId: st.studentId, subjectId: sub.subjectId, value: String(edits[k]).trim() });
      });

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/sheet-review/${type}/${id}/corrections`, { changes });
      toast.success(r.data.message, 9000);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the corrections."), 9000);
    }
    setBusy(false);
  };

  const finalFreeze = async () => {
    const n = sheet.verification.corrections.length;
    const ok = await confirm({
      title: "Give the final freeze?",
      message: `${sheet.department.toUpperCase()} · Semester ${sheet.semester} · ${TITLE[type]} · ${n} correction${n === 1 ? "" : "s"}.\n\nAfter this NOBODY can change this sheet – not the HOD, the office, the Admin or the COE.`,
      confirmText: "Final freeze",
      tone: "danger",
      requireText: "FREEZE",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("post", `/sheet-review/${type}/${id}/verify`);
      toast.success(r.data.message, 8000);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not give the final freeze."), 8000);
    }
    setBusy(false);
  };

  const print = (copy) =>
    openSignatureSheet({
      kind: type === "ia" ? "ia" : "attendance",
      copy,
      academicYear: sheet.academicYear,
      semester: sheet.semester,
      batch: sheet.batch,
      status: sheet.status,
      department: sheet.department,
      verification: sheet.verification,
      subjects: sheet.subjects.map((s) => ({
        subjectId: String(s.subjectId),
        code: s.code,
        name: s.name,
        iaMin: s.iaMin,
        iaMax: s.max ?? s.iaMax,
        bridge: s.subjectCategory ? String(s.subjectCategory).toUpperCase() === "BRIDGE" : undefined,
      })),
      students: sheet.students.map((st) => ({
        registerNumber: st.registerNumber,
        studentName: st.name,
        values: Object.fromEntries(sheet.subjects.map((s, i) => [String(s.subjectId), st.cells[i]?.flag === "na" ? "NA" : type === "ia" ? st.cells[i]?.value ?? "" : st.cells[i]?.pct ?? ""])),
      })),
    });

  const text = q.trim().toLowerCase();
  const rows = (sheet?.students || []).filter((st) => !text || `${st.registerNumber} ${st.name}`.toLowerCase().includes(text));

  return (
    <Modal
      open
      full
      onClose={onClose}
      busy={busy}
      title={sheet ? `${sheet.department.toUpperCase()}${sheet.shift === "EVENING" ? " (Evening)" : ""} · Semester ${sheet.semester} · ${TITLE[type]}` : "Loading…"}
      subtitle={sheet ? `Batch ${sheet.batch} · ${sheet.academicYear} · ${sheet.students.length} students` : ""}
      footer={
        sheet && (
          <>
            <button onClick={() => print("verification")} className={`${btn.secondary} sm:mr-0`}>
              <Icon name="download" className="h-4 w-4" />
              Before verification copy
            </button>
            {verified && (
              <button onClick={() => print("after")} className={btn.secondary}>
                <Icon name="download" className="h-4 w-4" />
                After verification copy
              </button>
            )}
            <span className="hidden flex-1 sm:block" />
            <button onClick={onClose} className={btn.secondary}>
              Close
            </button>
            {editable && (
              <>
                <button onClick={save} disabled={busy || !changes.length} className={btn.primary}>
                  Save {changes.length || ""} correction{changes.length === 1 ? "" : "s"}
                </button>
                <button
                  onClick={finalFreeze}
                  disabled={busy || changes.length > 0}
                  title={changes.length ? "Save the corrections first" : ""}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
                >
                  <Icon name="lock" className="h-4 w-4" />
                  Final freeze
                </button>
              </>
            )}
          </>
        )
      }
    >
      {!sheet && <div className="h-64 animate-pulse rounded-xl bg-slate-50" />}
      {sheet && (
        <>
          {verified && (
            <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
              Verified and finally frozen on {fmt(sheet.verification.verifiedAt)}. Nobody can change this sheet.
            </p>
          )}
          {!verified && sheet.resultsPublished && (
            <p className="mb-3 rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700">The results of this class are published, so it can no longer be corrected.</p>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no. or name" className={`${T.field} w-56`} />
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-5 rounded-sm border border-yellow-400 bg-yellow-200" />
              Corrected
            </span>
            <span className="ml-auto font-semibold">{sheet.verification.corrections.length} saved correction{sheet.verification.corrections.length === 1 ? "" : "s"}</span>
          </div>
          <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600">Student</th>
                  {sheet.subjects.map((s) => (
                    <th key={s.subjectId} className="px-2 py-2 text-center font-semibold text-slate-600" title={s.name}>
                      {s.code}
                      <span className="block font-normal text-slate-500">{type === "ia" ? `of ${s.max ?? "?"}${s.iaMin ? ` · min ${s.iaMin}` : ""}` : "%"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((st, n) => (
                  <tr key={st.studentId} className={n % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className={`sticky left-0 px-3 py-1 ${n % 2 ? "bg-slate-50" : "bg-white"}`}>
                      <div className="flex items-center gap-2.5">
                        {st.imageUrl ? (
                          <button type="button" onClick={() => setPhoto(st)} title="Click to see the full photo" aria-label={`Full photo of ${st.name}`} className="group shrink-0 cursor-zoom-in rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            <img src={st.imageUrl} alt="" loading="lazy" className="pointer-events-none h-10 w-10 rounded-full border border-slate-300 object-cover group-hover:border-indigo-500" />
                          </button>
                        ) : (
                          <span title="No photo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                            {String(st.name || "S").charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="block font-semibold tabular-nums text-slate-900">{st.registerNumber}</span>
                          <span className="block max-w-[11rem] truncate text-xs text-slate-500">{st.name}</span>
                        </div>
                      </div>
                    </td>
                    {sheet.subjects.map((sub, i) => {
                      const c = st.cells[i];
                      const k = `${st.studentId}|${sub.subjectId}`;
                      const fix = fixOf.get(k);
                      const tone = fix ? "bg-yellow-200" : c.flag === "low" ? "bg-red-100 text-red-800" : c.flag === "empty" ? "bg-orange-50" : "";
                      if (c.flag === "na")
                        return (
                          <td key={k} className="px-2 py-1 text-center text-slate-300">
                            –
                          </td>
                        );
                      return (
                        <td key={k} className={`px-1 py-1 text-center tabular-nums ${tone}`} title={fix ? `Before verification: ${fix.from ?? "–"}` : undefined}>
                          {editable ? (
                            <input
                              inputMode="decimal"
                              value={edits[k] ?? shownOf(type, c)}
                              onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))}
                              aria-label={`${st.registerNumber} ${sub.code}`}
                              className={`h-8 w-16 rounded-md border bg-white/80 px-1 text-center text-sm font-semibold tabular-nums outline-none focus:border-slate-500 ${
                                edits[k] !== undefined && String(edits[k]).trim() !== String(shownOf(type, c)) ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                              }`}
                            />
                          ) : (
                            <span className="font-semibold">{shownOf(type, c) === "" ? "–" : type === "ia" ? shownOf(type, c) : Number(shownOf(type, c)).toFixed(2)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {photo &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-950/95 p-4" data-photo-view role="dialog" aria-modal="true" aria-label={`Photo of ${photo.name}`} onClick={() => setPhoto(null)}>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Close photo" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <Icon name="close" className="h-5 w-5" />
            </button>
            <img src={photo.imageUrl} alt={photo.name} className="max-h-[calc(100vh-6rem)] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
            <p className="mt-3 text-center text-base font-semibold text-white">
              {photo.registerNumber} · {photo.name}
            </p>
          </div>,
          document.body
        )}
    </Modal>
  );
}
