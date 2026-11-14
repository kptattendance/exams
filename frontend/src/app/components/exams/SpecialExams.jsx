"use client";

// KPT 6.2.5 – special examinations for students on official NCC / NSS /
// Red Cross / sports / cultural duty during the regular examination (COE).
//   1. Record: activity, participation order, the papers that clash; where
//      his attendance is short because of the duty, keep him eligible.
//   2. After the special exam (and after the regular paper is decoded),
//      enter its marks – they count like the regular paper's.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const ACTIVITY = { NCC: "NCC", NSS: "NSS", RED_CROSS: "Red Cross", SPORTS: "Sports", CULTURAL: "Cultural" };

export default function SpecialExams() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);

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
    try {
      const r = await api("get", `/special-exams/exams/${examId}`);
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load."));
    }
  }, [api, examId, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const saveMarks = async (doc, code, raw) => {
    try {
      const r = await api("post", `/special-exams/${doc._id}/marks`, { code, raw });
      toast.success(r.data.message, 8000);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the marks."));
    }
  };
  const remove = async (doc) => {
    const ok = await confirm({ title: "Remove this special exam?", message: `${doc.registerNumber}\n\nOnly if recorded by mistake.`, confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/special-exams/${doc._id}`);
      toast.success(r.data.message, 8000);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Special exams (NCC / NSS / sports)</h2>
      <p className="mt-1 text-sm text-slate-500">
        Students on official duty during the exams write the clashing papers on another date – not a re-examination (KPT 6.2.5).
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {exams?.length > 0 && (
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            {exams.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} · {e.academicYear}
              </option>
            ))}
          </select>
        )}
        {data && !data.exam.published && (
          <button onClick={() => setAdding(true)} className={`${btn.primary} ml-auto`}>
            + Record a special exam
          </button>
        )}
      </div>

      {data && (
        <div className="mt-4 space-y-3">
          {data.data.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">None recorded for this exam.</p>}
          {data.data.map((d) => (
            <div key={d._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <b className="tabular-nums">{d.registerNumber}</b>
                <span className="text-sm text-slate-700">{d.name}</span>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-bold text-indigo-700">{ACTIVITY[d.activity]}</span>
                <span className="text-xs text-slate-500">
                  {d.orderRef}
                  {d.event && ` · ${d.event}`}
                </span>
                {!data.exam.published && !d.papers.some((p) => p.raw !== null) && (
                  <button onClick={() => remove(d)} className="ml-auto text-xs font-semibold text-red-600 hover:underline">
                    Remove
                  </button>
                )}
              </div>
              <ul className="mt-2 divide-y divide-slate-100">
                {d.papers.map((p) => (
                  <PaperRow key={p.code} p={p} locked={data.exam.published} onSave={(raw) => saveMarks(d, p.code, raw)} />
                ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] leading-4 text-slate-500">
            Enter the special exam&apos;s marks after the regular paper is decoded in valuation, then process the results again.
          </p>
        </div>
      )}
      {adding &&
        createPortal(
          <AddSpecial
            examId={examId}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              load();
            }}
          />,
          document.body
        )}
    </div>
  );
}

function PaperRow({ p, locked, onSave }) {
  const [raw, setRaw] = useState(p.raw ?? "");
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <b className="w-24">{p.code}</b>
      <span className="min-w-0 flex-1 text-slate-700">
        {p.name} <span className="text-xs text-slate-500">· Sem {p.semester}</span>
        {p.condoned && <span className="ml-1 text-xs font-semibold text-emerald-700">· kept eligible (attendance)</span>}
      </span>
      {locked ? (
        <span className="text-xs tabular-nums">{p.raw ?? "—"}</span>
      ) : (
        <span className="flex items-center gap-1.5">
          <input type="number" min="0" step="0.5" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Marks" className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm" />
          <button onClick={() => onSave(raw)} disabled={raw === "" || String(raw) === String(p.raw ?? "")} className={btn.small}>
            Save
          </button>
        </span>
      )}
    </li>
  );
}

function AddSpecial({ examId, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [regNo, setRegNo] = useState("");
  const [found, setFound] = useState(null);
  const [activity, setActivity] = useState("NCC");
  const [orderRef, setOrderRef] = useState("");
  const [event, setEvent] = useState("");
  const [codes, setCodes] = useState([]);
  const [condone, setCondone] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (list, set, c) => set(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);

  const find = async () => {
    try {
      const r = await api("get", `/special-exams/exams/${examId}/student`, undefined, { params: { registerNumber: regNo.trim().toUpperCase() } });
      setFound(r.data);
      setCodes([]);
      setCondone([]);
    } catch (e) {
      setFound(null);
      toast.error(errMsg(e, "Student not found."));
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/special-exams/exams/${examId}`, { registerNumber: found.student.registerNumber, activity, orderRef, event, codes, condone });
      toast.success(r.data.message, 8000);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title="Record a special exam"
      subtitle="Before the regular exams start, with the official participation order (KPT 6.2.5 c)"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !found || !codes.length || orderRef.trim().length < 3} className={btn.primary}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="flex gap-2">
        <input value={regNo} onChange={(e) => setRegNo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} autoFocus placeholder="Register number" className={`${field} flex-1 uppercase`} />
        <button onClick={find} disabled={!regNo.trim()} className={btn.secondary}>
          Find
        </button>
      </div>
      {found && (
        <>
          <p className="mt-3 text-sm">
            <b>{found.student.name}</b> · {found.student.registerNumber}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(ACTIVITY).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setActivity(v)}
                className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${activity === v ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Participation order (no. / date)</span>
              <input value={orderRef} onChange={(e) => setOrderRef(e.target.value)} className={`${field} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Camp / event and dates <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input value={event} onChange={(e) => setEvent(e.target.value)} className={`${field} mt-1.5`} />
            </label>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-800">Papers that clash with the duty</p>
          <div className="mt-1.5 space-y-1.5">
            {found.papers.map((p) => (
              <div key={p.code} className="flex flex-wrap items-center gap-x-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={codes.includes(p.code)} onChange={() => toggle(codes, setCodes, p.code)} className="h-4 w-4 accent-blue-600" />
                  <b>{p.code}</b> {p.name}
                  <span className="text-xs text-slate-500">· {p.status}</span>
                </label>
                {codes.includes(p.code) && p.status === "ANS" && (
                  <label className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <input type="checkbox" checked={condone.includes(p.code)} onChange={() => toggle(condone, setCondone, p.code)} className="h-3.5 w-3.5 accent-emerald-600" />
                    Attendance short because of this duty – keep eligible
                  </label>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
