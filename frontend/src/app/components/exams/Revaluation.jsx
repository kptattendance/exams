"use client";

// Revaluation, answer script copy and in-person viewing (KPT 9.8), after the
// results of an exam are published.
//   Office / COE : record an application with the fee; give the copy / show the script
//   COE          : last date; revaluation marks (a different examiner); third
//                  evaluation when the two differ by more than 15 % (a senior examiner)
// When the final marks change, the student's published result and grade card change too.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { useRole } from "../useRole";
import { errMsg, useApi } from "./shared";
import { deptOfReg, deptTint } from "../ui/deptTint";

const TYPE = { REVALUATION: "Revaluation", COPY: "Script copy", VIEW: "Viewing" };
const STATUS = {
  APPLIED: { label: "Applied", chip: "bg-amber-50 text-amber-800" },
  ISSUED: { label: "Given", chip: "bg-emerald-50 text-emerald-700" },
  NEEDS_THIRD: { label: "Third evaluation needed", chip: "bg-orange-50 text-orange-800" },
  DONE: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
};
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function Revaluation() {
  const api = useApi();
  const toast = useToast();
  const role = useRole();
  const isCoe = ["coe", "acoe", "admin"].includes(role);
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [marking, setMarking] = useState(null);
  const [show, setShow] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/exams");
        const list = (Array.isArray(r.data?.data) ? r.data.data : []).filter((e) => e.results?.publishedAt || e.status === "COMPLETED");
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
      const r = await api("get", `/revaluation/exams/${examId}`);
      setData(r.data);
    } catch (e) {
      setData({ data: [], exam: null });
      toast.error(errMsg(e, "Could not load the applications."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (a) => setData((d) => ({ ...d, data: d.data.map((x) => (x._id === a._id ? a : x)) }));
  const list = (data?.data || []).filter((a) => !show || a.type === show || a.status === show);
  const waiting = (data?.data || []).filter((a) => a.status === "APPLIED" || a.status === "NEEDS_THIRD").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Revaluation</h2>
      <p className="mt-1 text-sm text-slate-500">Answer script copy, in-person viewing and revaluation after the results are published (KPT 9.8).</p>

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has published results yet. Revaluation starts after the results are published.
        </p>
      )}

      {exams && exams.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
            {exams.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} · {e.academicYear}
              </option>
            ))}
          </select>
          {data?.exam && <LastDate exam={data.exam} canEdit={isCoe} onSaved={load} />}
          <button onClick={() => setAdding(true)} className={`${btn.primary} ml-auto`}>
            + New application
          </button>
        </div>
      )}

      {examId && !data && <div className="mt-4 h-48 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {[
              ["", "All"],
              ["REVALUATION", "Revaluation"],
              ["COPY", "Script copy"],
              ["VIEW", "Viewing"],
              ["NEEDS_THIRD", "Third evaluation needed"],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => setShow(v)}
                className={`rounded-full px-3 py-1.5 font-semibold ${show === v ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
              >
                {l}
              </button>
            ))}
            <span className="ml-auto text-slate-500">{waiting ? `${waiting} waiting` : "Nothing waiting"}</span>
          </div>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            {list.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No application here yet.</p>
            ) : (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Course</th>
                    <th className="px-3 py-2.5">Asked for</th>
                    <th className="px-3 py-2.5">Fee</th>
                    <th className="px-3 py-2.5 text-right">Marks</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((a) => (
                    <Row key={a._id} a={a} isCoe={isCoe} onChanged={replace} onRemoved={load} onMarks={() => setMarking(a)} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Marks are the paper&apos;s marks as valued (out of 50). Revaluation: within 15 % the higher marks count; more than 15 % apart, a senior examiner
            evaluates a third time and the average of the two highest counts (KPT 9.8.2). A changed mark updates the result, SGPA, CGPA and grade card at once.
          </p>
        </>
      )}

      {adding && data?.exam && createPortal(<NewApplication examId={examId} onClose={() => setAdding(false)} onSaved={() => (setAdding(false), load())} />, document.body)}
      {marking &&
        createPortal(
          <MarksModal
            a={marking}
            onClose={() => setMarking(null)}
            onSaved={(a) => {
              setMarking(null);
              replace(a);
            }}
          />,
          document.body
        )}
    </div>
  );
}

function LastDate({ exam, canEdit, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [value, setValue] = useState(exam.lastDate ? String(exam.lastDate).slice(0, 10) : "");
  const save = async (v) => {
    setValue(v);
    try {
      const r = await api("put", `/revaluation/exams/${exam._id}/last-date`, { lastDate: v });
      toast.success(r.data.message);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the last date."));
    }
  };
  if (!canEdit) return <span className="text-xs text-slate-500">{exam.lastDate ? `Last date: ${fmt(exam.lastDate)}` : "No last date set"}</span>;
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      Last date to apply
      <input type="date" value={value} onChange={(e) => save(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm" />
    </label>
  );
}

function Row({ a, isCoe, onChanged, onRemoved, onMarks }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const st = STATUS[a.status] || STATUS.APPLIED;

  const issue = async () => {
    try {
      const r = await api("post", `/revaluation/${a._id}/issue`);
      toast.success(r.data.message);
      onChanged(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
  };
  const remove = async () => {
    const ok = await confirm({ title: "Remove this application?", message: `${a.registerNumber} · ${a.code} · ${TYPE[a.type]}

Only for an application entered by mistake.`, confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/revaluation/${a._id}`, { reason: "Entered by mistake" });
      toast.success(r.data.message);
      onRemoved();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };

  return (
    <tr className={`align-top border-l-4 ${deptTint(deptOfReg(a.registerNumber)).edge}`}>
      <td className="px-3 py-2.5">
        <b className="tabular-nums text-slate-950">{a.registerNumber}</b>
        <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${deptTint(deptOfReg(a.registerNumber)).chip}`}>{deptOfReg(a.registerNumber).toUpperCase()}</span>
        <span className="block text-xs text-slate-500">{a.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <b className="text-slate-900">{a.code}</b>
        <span className="block text-xs text-slate-500">
          {a.subjectName} · Sem {a.subjectSemester}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-700">{TYPE[a.type]}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600">
        {a.fee?.amount != null && <b className="text-slate-900">₹{a.fee.amount} </b>}
        {a.fee?.receiptNo}
        <span className="block">{fmt(a.fee?.paidOn)}</span>
      </td>
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-700">
        {a.type === "REVALUATION" ? (
          <>
            <span className="block">
              Original <b>{a.original ?? "—"}</b>/{a.rawMax}
            </span>
            {a.reval && (
              <span className="block" title={`by ${a.reval.valuer}`}>
                Revaluation <b>{a.reval.marks}</b>
              </span>
            )}
            {a.third && (
              <span className="block" title={`by ${a.third.valuer}`}>
                Third <b>{a.third.marks}</b>
              </span>
            )}
            {a.final != null && (
              <span className={`block font-bold ${a.changed ? "text-emerald-700" : "text-slate-900"}`}>
                Final {a.final}
                {a.changed && a.resultAfter && ` · ${a.resultAfter}`}
              </span>
            )}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{st.label}</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1.5">
          {a.type !== "REVALUATION" && a.status === "APPLIED" && (
            <button onClick={issue} className={btn.small}>
              {a.type === "COPY" ? "Copy given" : "Shown"}
            </button>
          )}
          {a.type === "REVALUATION" && isCoe && (a.status === "APPLIED" || a.status === "NEEDS_THIRD") && (
            <button onClick={onMarks} className={btn.small}>
              {a.status === "NEEDS_THIRD" ? "Third evaluation" : "Enter marks"}
            </button>
          )}
          {isCoe && !a.reval && a.status !== "DONE" && (
            <button onClick={remove} className="text-xs font-semibold text-red-600 hover:underline">
              Remove
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function NewApplication({ examId, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [regNo, setRegNo] = useState("");
  const [student, setStudent] = useState(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState("REVALUATION");
  const [amount, setAmount] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setStudent(null);
    setCode("");
    try {
      const r = await api("get", `/revaluation/exams/${examId}/student`, undefined, { params: { registerNumber: regNo.trim().toUpperCase() } });
      setStudent(r.data);
      const first = r.data.papers.find((p) => !p.blocked);
      if (first) setCode(first.code);
    } catch (e) {
      toast.error(errMsg(e, "Student not found."));
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/revaluation/exams/${examId}`, { registerNumber: student.student.registerNumber, code, type, amount, receiptNo, paidOn });
      toast.success(r.data.message);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      setBusy(false);
    }
  };

  const applied = (c, t) => student?.applied?.some((x) => x.code === c && x.type === t);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title="New application"
      subtitle="Revaluation, answer script copy or viewing – after the fee is paid"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !student || !code || !receiptNo.trim() || applied(code, type)} className={btn.primary}>
            {busy ? "Saving…" : "Save application"}
          </button>
        </>
      }
    >
      <div className="flex gap-2">
        <input
          value={regNo}
          onChange={(e) => setRegNo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && find()}
          autoFocus
          placeholder="Register number"
          className={`${field} flex-1 uppercase`}
        />
        <button onClick={find} disabled={!regNo.trim()} className={btn.secondary}>
          Find
        </button>
      </div>

      {student && (
        <div className="mt-4">
          <p className="text-sm">
            <b>{student.student.name}</b> · {student.student.registerNumber}
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-800">Course (written paper)</p>
          <div className="mt-1.5 space-y-1.5">
            {student.papers.length === 0 && <p className="text-sm text-slate-500">No written paper in this exam.</p>}
            {student.papers.map((p) => (
              <label key={p.code} className={`flex items-center gap-2 text-sm ${p.blocked ? "text-slate-400" : ""}`}>
                <input type="radio" disabled={Boolean(p.blocked)} checked={code === p.code} onChange={() => setCode(p.code)} className="h-4 w-4 accent-blue-600" />
                <b>{p.code}</b> {p.name}
                <span className="text-xs text-slate-500">· Sem {p.semester}</span>
                {p.blocked ? <span className="text-xs">({p.blocked})</span> : <span className="text-xs text-slate-500">· marks {p.raw}/{p.rawMax}</span>}
              </label>
            ))}
          </div>

          <p className="mt-4 text-sm font-semibold text-slate-800">Asked for</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {Object.entries(TYPE).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${type === v ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700"}`}
              >
                {l}
                {code && applied(code, v) && <span className="ml-1 text-xs font-normal text-slate-500">(already)</span>}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Receipt / challan no.</span>
              <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} className={`${field} mt-1.5 font-mono`} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Fee (₹)</span>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1.5`} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Paid on</span>
              <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} className={`${field} mt-1.5`} />
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}

function MarksModal({ a, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const third = a.status === "NEEDS_THIRD";
  const [marks, setMarks] = useState("");
  const [valuer, setValuer] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/revaluation/${a._id}/marks`, { round: third ? "THIRD" : "REVAL", marks, valuer });
      toast.success(r.data.message, 12000);
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save the marks."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={third ? "Third evaluation" : "Revaluation marks"}
      subtitle={`${a.registerNumber} · ${a.code}`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || marks === "" || valuer.trim().length < 2} className={btn.primary}>
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
        Original marks <b>{a.original}</b>/{a.rawMax}
        {a.reval && (
          <>
            {" "}
            · revaluation <b>{a.reval.marks}</b> by {a.reval.valuer}
          </>
        )}
        .{" "}
        {third
          ? "They differ by more than 15 %: a senior examiner evaluates again; the average of the two highest counts."
          : "Enter the marks given by a different examiner. Within 15 % the higher marks count."}
      </p>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-800">Marks (out of {a.rawMax})</span>
        <input type="number" min="0" max={a.rawMax} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} autoFocus className={`${field} mt-1.5`} />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-slate-800">{third ? "Senior examiner" : "Examiner"} (name)</span>
        <input value={valuer} onChange={(e) => setValuer(e.target.value)} placeholder="Must not be the one who valued it before" className={`${field} mt-1.5`} />
      </label>
    </Modal>
  );
}
