"use client";

// Practical exams of an examination.
//   COE   (mode="coe")   : allots one or two examiner sets to each department,
//                          and follows the time table the HODs make
//   Admin (mode="admin") : the only one who can correct a mark after submission

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, batchState, branches, dept, deptShift, examinersOf, fmtDay, sessionLabel, usePracticalExams, when } from "./practicalShared";
import { T } from "../ui/table";
import { deptTint } from "../ui/deptTint";
import { DATE_TINTS } from "./ValuationBoard";

export default function PracticalAllotment({ mode = "coe" }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = mode === "admin";
  const { exams, examId, setExamId } = usePracticalExams();

  const [depts, setDepts] = useState(null); // departments with their examiner sets
  const [batches, setBatches] = useState(null);
  const [staff, setStaff] = useState([]);
  const [allot, setAllot] = useState(null); // { department, shift, panel? }
  const [secret, setSecret] = useState(null); // { title, name, code, emailed } shown once
  const [marks, setMarks] = useState(null); // batch id whose marks are open

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const [p, b] = await Promise.all([admin ? null : api("get", `/practicals/${examId}/panels`), api("get", `/practicals/${examId}/batches`)]);
      setDepts(p ? p.data.data : []);
      setBatches(b.data.data);
    } catch (e) {
      setDepts([]);
      setBatches([]);
      toast.error(errMsg(e, "Could not load the practical exams."));
    }
  }, [api, examId, admin, toast]);

  useEffect(() => {
    setBatches(null);
    load();
  }, [load]);

  useEffect(() => {
    if (admin) return;
    api("get", "/practicals/examiners")
      .then((r) => setStaff(r.data.data))
      .catch(() => {});
  }, [api, admin]);

  const title = (p) => `${deptShift(p.department, p.shift)} – Set ${p.number}`;

  const newCode = async (p) => {
    const ok = await confirm({
      title: `New code for ${p.external.name}?`,
      message: `${title(p)}. The old code stops working for every batch of this set. The new code is shown to you once${p.external.email ? ` and emailed to ${p.external.email}` : ""}.`,
      confirmText: "Issue new code",
    });
    if (!ok) return;
    try {
      const r = await api("post", `/practicals/panels/${p._id}/code`);
      setSecret({ title: title(p), name: p.external.name, code: r.data.code, emailed: r.data.emailed });
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not issue a new code."));
    }
  };

  const sendOrder = async (p) => {
    const ok = await confirm({
      title: "Email the office orders to both examiners?",
      message: [
        p.external.email && `External – ${p.external.name} (${p.external.email}): order with the copy to the Principal of ${p.external.college || "his college"}.`,
        p.internal?.email && `Internal – ${p.internal.name} (${p.internal.email}): order with the copy to the HOD.`,
        "Each order has the practical exam dates fixed so far.",
      ]
        .filter(Boolean)
        .join("\n"),
      confirmText: "Email order",
    });
    if (!ok) return;
    try {
      const r = await api("post", `/practicals/panels/${p._id}/order`);
      toast.success(r.data.message, 6000);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not email the office order."), 8000);
    }
  };

  const remove = async (p) => {
    const ok = await confirm({ title: `Remove ${title(p)}?`, message: examinersOf(p), confirmText: "Remove set", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/practicals/panels/${p._id}`);
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove the set."), 8000);
    }
  };

  return (
    <div className={admin ? "mx-auto max-w-[1600px] px-3 py-3 sm:px-4" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-7"}>
      {admin ? (
        <div className="flex flex-wrap items-center gap-x-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Practical marks – corrections</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical Examiners</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
          <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
            Allot one or two examiner sets (internal + external) to each department. Both examiners and the HOD get an email, and the external examiner gets a secret code. The HOD then contacts them and makes the batches and the time table. The examiners enter the marks together; submitted marks are final.
          </p>
        </>
      )}

      {exams && exams.length === 0 && <NoExam />}
      {examId && batches === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {/* ------------------------------------------------ examiner sets (COE) */}
      {!admin && batches && depts && (
        <ExaminerTable
          examId={examId}
          depts={depts}
          onAllot={(d, panel) => setAllot({ department: d.department, shift: d.shift, panel })}
          onOrder={sendOrder}
          onCode={newCode}
          onRemove={remove}
        />
      )}

      {/* ------------------------------------------------ Admin: every batch, to correct marks */}
      {batches && (
        <>
          {!admin && <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">Time table made by the HODs</h3>}
          <AdminBatches examId={examId} batches={batches} onOpen={admin ? setMarks : null} />
        </>
      )}

      {allot && (
        <AllotModal
          examId={examId}
          department={allot.department}
          shift={allot.shift}
          panel={allot.panel}
          staff={staff}
          onClose={() => setAllot(null)}
          onDone={(code) => {
            if (code) setSecret({ title: deptShift(allot.department, allot.shift), name: code.name, code: code.code, emailed: false });
            setAllot(null);
            load();
          }}
        />
      )}

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Secret code of the external examiner"
        subtitle={secret ? `${secret.title} · ${secret.name}` : ""}
        footer={
          <button onClick={() => setSecret(null)} className={btn.primary}>
            I have noted it
          </button>
        }
      >
        {secret && (
          <>
            <p className="rounded-2xl bg-slate-100 py-5 text-center text-4xl font-bold tracking-[0.3em] text-slate-950">{secret.code}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {secret.emailed ? "It was also emailed to the external examiner. " : "It could not be emailed, so give it to the external examiner yourself (phone or sealed cover). "}
              <b>This code is shown only now.</b> Never give it to the internal examiner. If it is lost, issue a new code.
            </p>
          </>
        )}
      </Modal>

      {marks && <MarksModal id={marks} admin={admin} onClose={() => setMarks(null)} onChanged={load} />}
    </div>
  );
}

// When the marks were submitted, in Indian time
const enteredAt = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";

// Every batch date by date, with filters. Admin: with the button to correct marks
// (onOpen). COE: only when the marks were entered, never the marks.
function AdminBatches({ examId, batches, onOpen }) {
  const [department, setDepartment] = useState("");
  const [date, setDate] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const deptKey = (b) => `${b.shift || "DAY"}|${b.department}`;
  const dateKey = (b) => b.date || "none";
  const departments = [...new Set(batches.map(deptKey))].sort();
  const dates = [...new Set(batches.map(dateKey))].sort((a, c) => (a === "none" ? "9" : a).localeCompare(c === "none" ? "9" : c));
  const tintOf = (k) => DATE_TINTS[dates.indexOf(k) % DATE_TINTS.length];
  const inPlace = batches.filter((b) => (!department || deptKey(b) === department) && (!date || dateKey(b) === date));
  const courses = [...new Map(inPlace.map((b) => [b.code, b.name])).entries()].sort((a, c) => a[0].localeCompare(c[0]));
  const text = q.trim().toLowerCase();
  const matches = (b) =>
    !text ||
    [b.code, b.name, b.label, `batch ${b.number}`, b.lab, b.department, deptShift(b.department, b.shift), b.internal?.name, b.external?.name, b.external?.college, ...(b.branches || [])]
      .join(" ")
      .toLowerCase()
      .includes(text);
  const beforeStatus = inPlace.filter((b) => (!course || b.code === course) && matches(b));
  const isDone = (b) => b.status === "SUBMITTED";
  const shown = beforeStatus.filter((b) => !status || (status === "DONE" ? isDone(b) : !isDone(b)));
  const doneCount = beforeStatus.filter(isDone).length;
  const perDay = new Map();
  for (const b of shown) perDay.set(dateKey(b), (perDay.get(dateKey(b)) || 0) + 1);
  const seen = new Map();

  // a chosen course that is not in the new department / date is cleared
  const keepCourse = (dep, day) => {
    if (course && !batches.some((b) => b.code === course && (!dep || deptKey(b) === dep) && (!day || dateKey(b) === day))) setCourse("");
  };
  const filtered = department || date || course || status || q;
  const [fShift, fDept] = department ? department.split("|") : ["", ""];

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {[
          ["", "All batches", beforeStatus.length, "bg-slate-200 text-slate-800"],
          ["DONE", "Marks submitted", doneCount, "bg-emerald-100 text-emerald-800"],
          ["WAIT", "Not submitted", beforeStatus.length - doneCount, "bg-yellow-100 text-yellow-900"],
        ].map(([k, label, n, chip]) => (
          <button key={label} onClick={() => setStatus(k)} aria-pressed={status === k} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${chip} ${status === k ? "ring-2 ring-slate-900" : "hover:opacity-80"}`}>
            {label} <b className="ml-1 tabular-nums">{n}</b>
          </button>
        ))}
        <a href={`/print/practical/${examId}?sheet=timetable${department ? `&department=${fDept}&shift=${fShift}` : ""}`} target="_blank" rel="noreferrer" className={`${btn.small} ml-auto`}>
          <Icon name="download" className="h-4 w-4" />
          Print time table
        </a>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            keepCourse(e.target.value, date);
          }}
          className={T.field}
          aria-label="Department"
        >
          <option value="">All departments</option>
          {departments.map((k) => (
            <option key={k} value={k}>
              {deptShift(k.split("|")[1], k.split("|")[0])}
            </option>
          ))}
        </select>
        <select
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            keepCourse(department, e.target.value);
          }}
          className={T.field}
          aria-label="Date of examination"
        >
          <option value="">All dates</option>
          {dates.map((k) => (
            <option key={k} value={k}>
              {k === "none" ? "Date not fixed" : fmtDay(k)}
            </option>
          ))}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={`${T.field} max-w-[20rem]`} aria-label="Course">
          <option value="">All courses</option>
          {courses.map(([c, n]) => (
            <option key={c} value={c}>
              {c} – {n}
            </option>
          ))}
        </select>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Course, batch, lab, examiner…" aria-label="Search" className={`${T.field} w-56 pl-8`} />
        </div>
        {filtered && (
          <button
            onClick={() => {
              setDepartment("");
              setDate("");
              setCourse("");
              setStatus("");
              setQ("");
            }}
            className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {shown.length} of {batches.length} batches
        </span>
      </div>

      <div className={`mt-2 ${T.wrap}`}>
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">{batches.length ? "No batch matches these filters." : "No batches yet. The HODs make the batches after the examiners are allotted."}</p>
        ) : (
          <table className={`${T.table} ${onOpen ? "min-w-[1180px]" : "min-w-[1060px]"}`}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.th}>Exam date</th>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Time &amp; lab</th>
                <th className={T.th}>Course code</th>
                <th className={T.th}>Course name</th>
                <th className={T.th}>Batch</th>
                <th className={T.th}>Dept</th>
                <th className={`${T.th} text-right`}>Students</th>
                <th className={T.th}>Examiners</th>
                <th className={T.th}>Status</th>
                <th className={T.th}>Marks entered on</th>
                {onOpen && <th className={`${T.th} text-right`}>Action</th>}
              </tr>
            </thead>
            <tbody className={T.body}>
              {shown.map((b, i) => {
                const key = dateKey(b);
                const t = tintOf(key);
                const nth = seen.get(key) || 0;
                seen.set(key, nth + 1);
                const st = batchState(b);
                const count = perDay.get(key);
                return (
                  <tr key={b._id} className={`${T.row} ${nth % 2 ? t.row : "bg-white"}`}>
                    {nth === 0 && (
                      <td rowSpan={count} className={`border-l-4 px-3 py-1 align-top text-xs font-bold whitespace-nowrap ${t.edge} ${t.cell}`}>
                        {key === "none" ? "Date not fixed" : fmtDay(key).replace(/, \d{4}$/, "")}
                        <span className="block text-[11px] font-medium opacity-75">
                          {count} batch{count === 1 ? "" : "es"}
                        </span>
                      </td>
                    )}
                    <td className={T.tdNum}>{i + 1}</td>
                    <td className={`${T.td} whitespace-nowrap text-xs text-slate-700`}>
                      {sessionLabel(b.session) || "–"}
                      {b.lab && <span className="block text-[11px] text-slate-500">{b.lab}</span>}
                    </td>
                    <td className={`${T.td} whitespace-nowrap font-semibold text-slate-950`}>{b.code}</td>
                    <td className={`${T.td} max-w-[15rem] text-xs text-slate-700`}>{b.name}</td>
                    <td className={`${T.td} whitespace-nowrap text-xs font-semibold text-slate-800`}>Batch {b.number}</td>
                    <td className={T.td} title={deptShift(b.department, b.shift)}>
                      <span className="flex max-w-[6.5rem] flex-wrap gap-0.5">
                        {(b.branches?.length ? b.branches : [b.department]).map((d) => (
                          <span key={d} className={`rounded px-1 py-0.5 text-[10px] font-bold ${deptTint(d).chip}`}>
                            {String(d).toUpperCase()}
                          </span>
                        ))}
                        {b.shift === "EVENING" && <span className="rounded bg-indigo-100 px-1 py-0.5 text-[10px] font-semibold text-indigo-800">Evening</span>}
                      </span>
                    </td>
                    <td className={`${T.td} text-right text-xs font-semibold tabular-nums`}>{b.count}</td>
                    <td className={`${T.td} text-xs`}>
                      {b.allotted ? (
                        <>
                          <span className="block text-slate-800">
                            <b className="text-[10px] text-indigo-700">INT</b> {b.internal?.name}
                          </span>
                          <span className="block text-slate-800">
                            <b className="text-[10px] text-fuchsia-700">EXT</b> {b.external?.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">Not chosen</span>
                      )}
                    </td>
                    <td className={T.td}>
                      <span className={`${T.pill} ${st.chip}`}>{st.label}</span>
                    </td>
                    <td className={`${T.td} whitespace-nowrap text-xs`} title={b.submitted?.by ? `Submitted by ${b.submitted.by}` : undefined}>
                      {isDone(b) && b.submitted?.at ? <b className="text-emerald-800">{enteredAt(b.submitted.at)}</b> : <span className="text-slate-400">–</span>}
                    </td>
                    {onOpen && (
                      <td className={`${T.td} text-right`}>
                        {isDone(b) && (
                          <button onClick={() => onOpen(b._id)} className={`${btn.small} whitespace-nowrap`}>
                            View / correct
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// COE: every department in one table – its practical work and its examiner sets.
// One row per examiner set (a department without a set has one row).
const STATES = {
  NEEDS: { label: "No examiners yet", chip: "bg-orange-100 text-orange-800", row: "bg-orange-50/70" },
  DONE: { label: "Allotted", chip: "bg-emerald-100 text-emerald-800", row: "" },
  NONE: { label: "No practical exams", chip: "bg-slate-100 text-slate-500", row: "bg-slate-50/80 text-slate-400" },
};
const stateOf = (d) => (d.panels.length ? "DONE" : d.subjects > 0 ? "NEEDS" : "NONE");
// alternate allotted departments get a light tint so that their rows stand apart
const ZEBRA = ["bg-white", "bg-blue-50/40"];

function ExaminerTable({ examId, depts, onAllot, onOrder, onCode, onRemove }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState("ALL");

  const counts = { ALL: depts.length, NEEDS: 0, DONE: 0, NONE: 0 };
  for (const d of depts) counts[stateOf(d)]++;

  const text = q.trim().toLowerCase();
  const list = depts.filter((d) => {
    if (show !== "ALL" && stateOf(d) !== show) return false;
    if (!text) return true;
    const hay = [deptShift(d.department, d.shift), d.department, d.shift === "EVENING" ? "evening" : "", ...d.panels.flatMap((p) => [p.internal.name, p.external.name, p.external.college, p.external.email, p.external.phone])]
      .join(" ")
      .toLowerCase();
    return hay.includes(text);
  });

  const th = "border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";
  const td = "border-b border-slate-100 px-3 py-2.5 align-top";
  const act = "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50";

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <h3 className="flex-1 text-lg font-bold tracking-tight text-slate-950">Examiners of each department</h3>
        {depts.some((d) => d.panels.length) && (
          <a href={`/print/practical-orders/${examId}`} target="_blank" rel="noreferrer" className={btn.small}>
            <Icon name="download" className="h-4 w-4" />
            Print all office orders
          </a>
        )}
      </div>

      {/* filters */}
      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search department, examiner, college, phone…" aria-label="Search" className={`${field} pl-9`} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["ALL", "All"],
            ["NEEDS", "No examiners yet"],
            ["DONE", "Allotted"],
            ["NONE", "No practical exams"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setShow(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${show === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {label} ({counts[k]})
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className={`${th} w-12`}>Sl. No</th>
              <th className={`${th} w-48`}>Department</th>
              <th className={`${th} w-40`}>Practical work</th>
              <th className={`${th} w-14`}>Set</th>
              <th className={th}>Internal examiner</th>
              <th className={th}>External examiner</th>
              <th className={`${th} w-44`}>Code / order</th>
              <th className={`${th} w-56`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d, i) => {
              const st = STATES[stateOf(d)];
              const tint = st.row || ZEBRA[i % 2];
              const rows = Math.max(d.panels.length, 1);
              const head = (
                <>
                  <td rowSpan={rows} className={`${td} font-semibold tabular-nums text-slate-500`}>
                    {i + 1}
                  </td>
                  <td rowSpan={rows} className={td}>
                    <p className="font-semibold text-slate-950">{dept(d.department)}</p>
                    {d.shift === "EVENING" && <span className="mr-1 mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">Evening college</span>}
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>{st.label}</span>
                    {(d.subjects > 0 || d.panels.length > 0) && (
                      <button onClick={() => onAllot(d)} className={`mt-2 ${d.panels.length ? act : "inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"}`}>
                        <Icon name="plus" className="h-3.5 w-3.5" />
                        {d.panels.length ? "Add another set" : "Allot examiners"}
                      </button>
                    )}
                  </td>
                  <td rowSpan={rows} className={`${td} text-xs leading-5 text-slate-600`}>
                    {d.subjects === 0 ? (
                      "—"
                    ) : (
                      <>
                        {d.subjects} course{d.subjects > 1 ? "s" : ""}
                        <br />
                        {d.students} student entries
                        <br />
                        {d.batches} batch{d.batches === 1 ? "" : "es"}
                        {d.batches ? `, ${d.submitted} submitted` : ""}
                      </>
                    )}
                  </td>
                </>
              );
              if (!d.panels.length)
                return (
                  <tr key={`${d.shift}-${d.department}`} className={tint}>
                    {head}
                    <td colSpan={5} className={`${td} text-xs ${d.subjects ? "font-semibold text-orange-700" : ""}`}>
                      {d.subjects ? "Allot the internal and external examiners." : "Nothing to allot."}
                    </td>
                  </tr>
                );
              return d.panels.map((p, k) => (
                <tr key={p._id} className={tint}>
                  {k === 0 && head}
                  <td className={`${td} text-center font-bold text-slate-800`}>{p.number}</td>
                  <td className={td}>
                    <p className="font-semibold text-slate-900">{p.internal.name}</p>
                    {p.internal.phone && <p className="text-xs text-slate-500">{p.internal.phone}</p>}
                  </td>
                  <td className={td}>
                    <p className="font-semibold text-slate-900">{p.external.name}</p>
                    {p.external.college && <p className="text-xs text-slate-600">{p.external.college}</p>}
                    {(p.external.phone || p.external.email) && <p className="text-xs text-slate-500">{[p.external.phone, p.external.email].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className={`${td} text-xs leading-5`}>
                    {p.codeLocked ? (
                      <span className="font-semibold text-red-700">Code locked – issue a new code</span>
                    ) : p.codeSentTo ? (
                      <span className="text-emerald-700">Code emailed</span>
                    ) : (
                      <span className="text-slate-600">Code given by COE office</span>
                    )}
                    <br />
                    {p.orderSentAt ? (
                      <span className="text-emerald-700">Order emailed {new Date(p.orderSentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    ) : (
                      <span className="text-orange-700">Order not emailed</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1.5">
                      <button onClick={() => onAllot(d, p)} className={act}>
                        <Icon name="edit" className="h-3.5 w-3.5" />
                        Change
                      </button>
                      <a href={`/print/practical-orders/${examId}?panel=${p._id}`} target="_blank" rel="noreferrer" className={act}>
                        <Icon name="download" className="h-3.5 w-3.5" />
                        Order
                      </a>
                      {(p.external.email || p.internal?.email) && (
                        <button onClick={() => onOrder(p)} className={act}>
                          <Icon name="paper" className="h-3.5 w-3.5" />
                          Email order
                        </button>
                      )}
                      <button onClick={() => onCode(p)} className={act}>
                        <Icon name="key" className="h-3.5 w-3.5" />
                        New code
                      </button>
                      <button onClick={() => onRemove(p)} className={`${act} text-red-700 hover:bg-red-50`}>
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ));
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                  No department matches the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AllotModal({ examId, department, shift, panel, staff, onClose, onDone }) {
  const api = useApi();
  const toast = useToast();
  const [internalId, setInternalId] = useState(panel?.internal.user || "");
  const [ext, setExt] = useState({ name: panel?.external.name || "", college: panel?.external.college || "", phone: panel?.external.phone || "", email: panel?.external.email || "" });
  const [busy, setBusy] = useState(false);

  // staff of the department itself first; faculty of other colleges are external examiners
  const sorted = useMemo(
    () => staff.filter((u) => !u.college?.external).sort((a, b) => (b.department === department) - (a.department === department)),
    [staff, department]
  );
  const outside = useMemo(
    () => staff.filter((u) => u.college?.external).sort((a, b) => (b.department === department) - (a.department === department) || a.name.localeCompare(b.name)),
    [staff, department]
  );
  const [extId, setExtId] = useState(() => outside.find((u) => u.name === panel?.external.name && (!panel?.external.email || u.email === panel.external.email))?._id || "");
  const set = (k) => (e) => setExt((x) => ({ ...x, [k]: e.target.value }));
  // picking a faculty member fills in the details (they can still be corrected)
  const pickExternal = (id) => {
    setExtId(id);
    const u = outside.find((x) => x._id === id);
    if (u) setExt({ name: u.name, college: [u.college.code, u.college.name].filter(Boolean).join(" – "), phone: u.phone || "", email: u.email || "" });
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = { department, shift, internalId, external: { ...ext, userId: extId || null } };
      const r = panel ? await api("patch", `/practicals/panels/${panel._id}`, body) : await api("post", `/practicals/${examId}/panels`, body);
      toast.success(r.data.message, 8000);
      onDone(r.data.code ? { code: r.data.code, name: ext.name } : null);
    } catch (e) {
      toast.error(errMsg(e, "Could not save the examiners."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={panel ? `Change examiners – Set ${panel.number}` : "Allot an examiner set"}
      subtitle={
        shift === "EVENING"
          ? `${dept(department)} – Evening college · they conduct the evening students' practical exams the Evening Principal gives them`
          : `${dept(department)} department · they conduct the practical exams the HOD gives them`
      }
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !internalId || ext.name.trim().length < 3} className={btn.primary}>
            {busy ? "Saving and sending emails…" : "Save and inform"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Internal examiner</span>
        <select value={internalId} onChange={(e) => setInternalId(e.target.value)} className={`${field} mt-1`}>
          <option value="">Choose a staff member</option>
          {sorted.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} · {String(u.department || "").toUpperCase()}
              {u.role === "hod" ? " (HOD)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block">
        <span className="text-sm font-medium text-slate-700">External examiner</span>
        <select value={extId} onChange={(e) => pickExternal(e.target.value)} className={`${field} mt-1`}>
          <option value="">{outside.length ? "Choose from other colleges' faculty (or type below)" : "No faculty of other colleges added yet – type below"}</option>
          {outside.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} · {String(u.department || "").toUpperCase()} · {u.college.code}
              {u.college.name ? ` ${u.college.name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input value={ext.name} onChange={set("name")} placeholder="Name" className={field} aria-label="External examiner's name" />
        <input value={ext.college} onChange={set("college")} placeholder="College / organisation" className={field} aria-label="College" />
        <input value={ext.phone} onChange={set("phone")} placeholder="Phone" inputMode="tel" className={field} aria-label="Phone" />
        <input value={ext.email} onChange={set("email")} placeholder="Email" type="email" className={field} aria-label="Email" />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        The external examiner&apos;s secret code is emailed to this address; one code works for all his batches. Without an email, the code is shown to you once so that you can give it
        to him.{panel && " Changing the external examiner issues a new code."}
      </p>
    </Modal>
  );
}

function MarksModal({ id, admin, onClose, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [b, setB] = useState(null);
  const [edit, setEdit] = useState(null); // { registerNumber, attendance, marks, reason }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/practicals/batches/${id}`);
      setB(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the marks."));
      onClose();
    }
  }, [api, id, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/practicals/batches/${id}/correct`, edit);
      toast.success(r.data.message);
      setEdit(null);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the correction."));
    }
    setBusy(false);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title={b ? `${b.label} – marks out of ${b.max}` : "Marks"}
      subtitle={b ? `${b.name} · Internal: ${b.internal.name} · External: ${b.external.name}` : ""}
      footer={
        b && (
          <a href={`/print/practical/${b.exam}?batch=${b._id}`} target="_blank" rel="noreferrer" className={btn.secondary}>
            <Icon name="download" className="h-4 w-4" />
            Print mark list
          </a>
        )
      }
    >
      {!b && <div className="h-40 animate-pulse rounded-xl bg-slate-100" />}
      {b && (
        <>
          <ul className="divide-y divide-slate-100">
            {b.students.map((s) => (
              <li key={s.registerNumber} className="py-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-28 font-semibold tabular-nums text-slate-900">{s.registerNumber}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{s.name}</span>
                  <span className="font-bold tabular-nums text-slate-950">{s.attendance === "PRESENT" ? s.marks : s.attendance === "ABSENT" ? "AB" : "MP"}</span>
                  {admin && edit?.registerNumber !== s.registerNumber && (
                    <button onClick={() => setEdit({ registerNumber: s.registerNumber, attendance: s.attendance, marks: s.marks ?? "", reason: "" })} className={btn.small}>
                      <Icon name="edit" className="h-4 w-4" />
                      Correct
                    </button>
                  )}
                </div>
                {edit?.registerNumber === s.registerNumber && (
                  <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[150px_100px_1fr]">
                    <select value={edit.attendance} onChange={(e) => setEdit({ ...edit, attendance: e.target.value })} className={field} aria-label="Attendance">
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="MALPRACTICE">Malpractice</option>
                    </select>
                    <input
                      disabled={edit.attendance !== "PRESENT"}
                      value={edit.attendance === "PRESENT" ? edit.marks : ""}
                      onChange={(e) => setEdit({ ...edit, marks: e.target.value })}
                      inputMode="numeric"
                      placeholder={`0–${b.max}`}
                      className={field}
                      aria-label="Marks"
                    />
                    <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="Reason for the correction" className={field} aria-label="Reason" />
                    <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                      <button onClick={() => setEdit(null)} disabled={busy} className={btn.secondary}>
                        Cancel
                      </button>
                      <button onClick={save} disabled={busy || edit.reason.trim().length < 5} className={btn.primary}>
                        {busy ? "Saving…" : "Save correction"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {b.corrections?.length > 0 && (
            <div className="mt-4 rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">
              <p className="font-semibold">Corrections made by the Admin</p>
              {b.corrections.map((c, i) => (
                <p key={i}>
                  {c.registerNumber}: {c.from.attendance === "PRESENT" ? c.from.marks : c.from.attendance} → {c.to.attendance === "PRESENT" ? c.to.marks : c.to.attendance} · {c.reason} · {c.by} ·{" "}
                  {new Date(c.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
