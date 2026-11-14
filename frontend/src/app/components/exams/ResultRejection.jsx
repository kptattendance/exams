"use client";

// KPT 9.9 – result rejection (COE). Within one week of the results, through
// the HOD, with the Dean (Academic)'s approval; once in the program for an
// odd and once for an even semester; project work cannot be rejected.

import { useCallback, useEffect, useState } from "react";

import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

export default function ResultRejection() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [list, setList] = useState(null);
  const [regNo, setRegNo] = useState("");
  const [found, setFound] = useState(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/exams");
        const done = (Array.isArray(r.data?.data) ? r.data.data : []).filter((e) => e.status === "COMPLETED");
        setExams(done);
        if (done[0]) setExamId(done[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast]);

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const r = await api("get", `/result-rejection/exams/${examId}`);
      setList(r.data.data);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load."));
    }
  }, [api, examId, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const find = async () => {
    setFound(null);
    try {
      const r = await api("get", `/result-rejection/exams/${examId}/student`, undefined, { params: { registerNumber: regNo.trim().toUpperCase() } });
      setFound(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Student not found."));
    }
  };
  const reject = async () => {
    const ok = await confirm({
      title: `Reject ${found.student.registerNumber}'s semester ${found.student.semester} result?`,
      message: `${found.check.codes.join(", ")} will not count (no CGPA, no credits). He goes back to semester ${found.student.semester} as Inactive and repeats it after readmission.\n\nAllowed only once in the program.`,
      confirmText: "Reject result",
      tone: "danger",
      requireText: "REJECT",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("post", `/result-rejection/exams/${examId}`, { registerNumber: found.student.registerNumber, reference });
      toast.success(r.data.message, 12000);
      setFound(null);
      setRegNo("");
      setReference("");
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not reject the result."));
    }
    setBusy(false);
  };
  const undo = async (c) => {
    const ok = await confirm({ title: `Undo the rejection for ${c.registerNumber}?`, message: "Only if it was recorded by mistake. His result counts again.", confirmText: "Undo", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/result-rejection/exams/${examId}/${c._id}`);
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not undo."));
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Result rejection</h2>
      <p className="mt-1 text-sm text-slate-500">
        Within one week of the results, through the HOD, with the Dean (Academic)&apos;s approval. Once in the program for an odd and once for an even semester; project
        work cannot be rejected (KPT 9.9).
      </p>

      {exams?.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No published results yet.</p>}
      {exams?.length > 0 && (
        <>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-4 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            {exams.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} · {e.academicYear}
              </option>
            ))}
          </select>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex gap-2">
              <input value={regNo} onChange={(e) => setRegNo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && find()} placeholder="Register number" className={`${field} flex-1 uppercase`} />
              <button onClick={find} disabled={!regNo.trim()} className={btn.secondary}>
                Check
              </button>
            </div>
            {found && (
              <div className="mt-3 text-sm">
                <p>
                  <b>{found.student.name}</b> · {found.student.registerNumber} · Semester {found.student.semester}
                  {found.result && (
                    <span className="text-slate-500">
                      {" "}
                      · SGPA {found.result.sgpa ?? "—"} · CGPA {found.result.cgpa ?? "—"}
                    </span>
                  )}
                </p>
                {found.check.ok ? (
                  <>
                    <p className="mt-2 text-slate-700">
                      Rejected: <b>{found.check.codes.join(", ")}</b>
                      {found.check.kept.length > 0 && <span className="text-slate-500"> · project work kept: {found.check.kept.join(", ")}</span>}
                    </p>
                    <label className="mt-3 block">
                      <span className="text-sm font-semibold text-slate-800">HOD&apos;s forwarding / Dean (Academic)&apos;s approval (no. / date)</span>
                      <input value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} mt-1.5`} />
                    </label>
                    <button onClick={reject} disabled={busy || reference.trim().length < 3} className={`${btn.danger} mt-3`}>
                      {busy ? "Saving…" : "Reject this result"}
                    </button>
                  </>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
                    {found.check.errors.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <p className="mt-5 text-sm font-semibold text-slate-900">Rejected in this exam</p>
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white">
            {!list?.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">None.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {list.map((c) => (
                  <li key={c._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                    <b className="tabular-nums">{c.registerNumber}</b>
                    <span className="min-w-0 flex-1">
                      {c.name}
                      <span className="block text-xs text-slate-500">
                        Sem {c.rejection.semester}: {c.rejection.codes.join(", ")} · {c.rejection.reference}
                      </span>
                    </span>
                    <button onClick={() => undo(c)} className="text-xs font-semibold text-red-600 hover:underline">
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
