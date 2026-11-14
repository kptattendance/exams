"use client";

// Results of an exam:
//   Check that every mark is in → Process (grades, SGPA, CGPA) → look through
//   the classes → Publish (back papers then appear in the next exam).

import { Fragment, useCallback, useEffect, useState } from "react";

import { useConfirm, useToast } from "../ui/Feedback";
import { DEPARTMENTS, KIND, errMsg, useApi } from "./shared";
import MalpracticeCases from "./MalpracticeCases";
import CollegeSelect from "../ui/CollegeFilter";

const OUTCOME = {
  PASS: { label: "Pass", chip: "bg-emerald-50 text-emerald-700" },
  FAIL: { label: "Fail", chip: "bg-red-50 text-red-700" },
  WITHHELD: { label: "Withheld", chip: "bg-orange-50 text-orange-700" },
};

const STATUS_TEXT = {
  PASS: "text-emerald-700",
  FAIL: "text-red-700",
  ABSENT: "text-red-700",
  NE: "text-orange-700",
  ANS: "text-orange-700",
  WITHHELD: "text-orange-700",
};

const fmtTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const show = (v) => (v === null || v === undefined ? "–" : v);

export default function Results() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [state, setState] = useState(null);
  const [moderation, setModeration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [department, setDepartment] = useState(DEPARTMENTS[0].value);
  const [semester, setSemester] = useState("");
  const [college, setCollege] = useState(""); // DAY (103) / EVENING (186)
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState("");

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
    setState(null);
    try {
      const r = await api("get", `/exams/${examId}/results/readiness`);
      setState(r.data);
      setModeration(r.data.exam.results?.moderationMarks || 0);
      setSemester((s) => (r.data.exam.semesters.includes(Number(s)) ? s : String(r.data.exam.semesters[0] || "")));
    } catch (e) {
      toast.error(errMsg(e, "Could not load the results."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const processedAt = state?.exam?.results?.processedAt;
  const publishedAt = state?.exam?.results?.publishedAt;

  const loadRows = useCallback(async () => {
    if (!examId || !processedAt) return setRows(null);
    setRows(null);
    try {
      const r = await api("get", `/exams/${examId}/results`, undefined, { params: { department, semester, ...(college ? { college } : {}) } });
      setRows(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the class."));
    }
  }, [api, examId, processedAt, department, semester, college, toast]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/results/process`, { moderation: Number(moderation) || 0 });
      toast.success(r.data.message);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not process the results."));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    const ok = await confirm({
      title: "Publish the results?",
      message:
        "The results become final and the exam is marked completed. Students who did not pass get the subject as a back paper in the next exam.\n\nStudents are also promoted to the next semester or detained (KPT 9.3: semester 1 to 2 automatic; from semester 2 on, half the year's credits and CGPA 4.0).\n\nThis cannot be undone here.",
      confirmText: "Publish results",
      requireText: "PUBLISH",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/results/publish`);
      toast.success(r.data.message, 12000);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not publish the results."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Results</h2>
      {exams && exams.length > 1 ? (
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-2 h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {exams.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name} · {e.academicYear}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{exams?.[0] ? `${exams[0].name} · ${exams[0].academicYear}` : " "}</p>
      )}

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}
      {examId && !state && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />}

      {state && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          {publishedAt ? (
            <p className="text-sm text-slate-700">
              <b className="text-emerald-700">Published</b> on {fmtTime(publishedAt)}. The exam is completed.
            </p>
          ) : state.issues.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-slate-950">Marks are still missing – results cannot be processed yet</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Course</th>
                      <th className="px-3 py-2">What is missing</th>
                      <th className="px-3 py-2 text-right">Students</th>
                      <th className="px-3 py-2">By class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.issues.map((i) => (
                      <tr key={`${i.code}|${i.name}|${i.note}`} className="align-top">
                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-950">{i.code}</td>
                        <td className="px-3 py-2 text-slate-700">{i.name}</td>
                        <td className="px-3 py-2 text-slate-600">{i.note}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{i.students}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(i.classes || []).map((c) => (
                              <span key={c.label} className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                                {c.label} <b className="tabular-nums text-slate-950">{c.students}</b>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <td colSpan={5} className="px-3 py-2">
                        {state.issues.length} course{state.issues.length > 1 ? "s" : ""} with something missing. A student is counted once per course.
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : state.students === 0 ? (
            <p className="text-sm text-slate-500">No student is registered for this exam.</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">All marks are in for {state.students} students.</p>
                <p className="mt-0.5">{processedAt ? `Last processed ${fmtTime(processedAt)}.` : "Results are not processed yet."}</p>
              </div>
              <label className="text-xs text-slate-600">
                Moderation marks (Academic Council)
                <select
                  value={moderation}
                  onChange={(e) => setModeration(e.target.value)}
                  className="mt-1 block h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {Array.from({ length: state.maxModeration + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "None" : `Up to ${n} per student`}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={run} disabled={busy} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                {processedAt ? "Process again" : "Process results"}
              </button>
              {processedAt && (
                <button onClick={publish} disabled={busy} className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                  Publish
                </button>
              )}
            </div>
          )}

          {state.processed > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
              <span>
                Students <b className="text-slate-900">{state.processed}</b>
              </span>
              <span>
                Passed all <b className="text-emerald-700">{state.outcomes.PASS}</b>
              </span>
              <span>
                Not passed <b className="text-red-700">{state.outcomes.FAIL}</b>
              </span>
              {state.outcomes.WITHHELD > 0 && (
                <span>
                  Withheld <b className="text-orange-700">{state.outcomes.WITHHELD}</b>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {state && <MalpracticeCases examId={examId} published={Boolean(publishedAt)} onChanged={load} />}

      {state && processedAt && (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <CollegeSelect value={college} onChange={setCollege} />
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
              <option value="backlog">Back papers only</option>
            </select>
            {department !== "backlog" && (
              <select value={semester} onChange={(e) => setSemester(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {state.exam.semesters.map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            )}
            {publishedAt && (
              <a
                href={`/print/grade-cards/${examId}?${new URLSearchParams({ department, ...(department !== "backlog" && semester ? { semester } : {}), ...(college ? { college } : {}) })}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Print grade cards
              </a>
            )}
          </div>

          {!rows && <div className="mt-3 h-64 animate-pulse rounded-2xl bg-white" />}
          {rows && (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No students in this class.</p>}
              {rows.length > 0 && (
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs font-semibold text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2.5 text-right">Sl.</th>
                      <th className="px-4 py-2.5">Register no.</th>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5 text-right">Credits</th>
                      <th className="px-4 py-2.5 text-right">SGPA</th>
                      <th className="px-4 py-2.5 text-right">CGPA</th>
                      <th className="px-4 py-2.5">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <Fragment key={r._id}>
                        <tr onClick={() => setOpen(open === r._id ? "" : r._id)} className="cursor-pointer hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{i + 1}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-950">{r.registerNumber}</td>
                          <td className="px-4 py-2.5 text-slate-700">{r.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                            {r.result.credits.earned}/{r.result.credits.registered}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{show(r.result.sgpa?.toFixed(2))}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{show(r.result.cgpa?.toFixed(2))}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${OUTCOME[r.result.outcome]?.chip || ""}`}>
                              {OUTCOME[r.result.outcome]?.label || r.result.outcome}
                            </span>
                            <Progression p={r.result.progression} />
                          </td>
                        </tr>
                        {open === r._id && (
                          <tr className="bg-slate-50">
                            <td colSpan={7} className="px-4 py-3">
                              <Courses courses={r.result.courses} />
                              {publishedAt && (
                                <a
                                  href={`/print/grade-cards/${examId}?q=${encodeURIComponent(r.registerNumber)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                                >
                                  Print his grade card
                                </a>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// KPT 9.3 – what publishing decided
function Progression({ p }) {
  if (!p?.decision || p.decision === "NONE") return null;
  const tone = p.decision === "PROMOTE" ? "text-emerald-700" : p.decision === "DETAIN" ? "text-red-700" : "text-orange-700";
  const text = p.decision === "PROMOTE" ? `→ Sem ${p.toSemester}` : p.decision === "DETAIN" ? "Detained" : "Not decided";
  return (
    <span className={`ml-2 text-xs font-semibold ${tone}`} title={p.note}>
      {text}
    </span>
  );
}

function Courses({ courses }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-left font-semibold text-slate-500">
        <tr>
          <th className="py-1 pr-3">Subject</th>
          <th className="py-1 pr-3 text-right">CIE</th>
          <th className="py-1 pr-3 text-right">Theory</th>
          <th className="py-1 pr-3 text-right">Practical</th>
          <th className="py-1 pr-3 text-right">Total</th>
          <th className="py-1 pr-3">Grade</th>
          <th className="py-1">Result</th>
        </tr>
      </thead>
      <tbody>
        {courses.map((c) => (
          <tr key={c.code} className="border-t border-slate-200/70 align-top">
            <td className="py-1.5 pr-3 text-slate-700">
              <b className="text-slate-950">{c.code}</b> {c.name}
              {KIND[c.kind] && <span className="ml-1 text-slate-500">· {KIND[c.kind]}</span>}
            </td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{c.cieMax ? `${show(c.cie)}/${c.cieMax}` : "–"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{c.theoryMax ? `${show(c.theory)}/${c.theoryMax}` : "–"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{c.practicalMax ? `${show(c.practical)}/${c.practicalMax}` : "–"}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{c.total === null ? "–" : `${c.total}/${c.max}`}</td>
            <td className="py-1.5 pr-3 font-semibold text-slate-950">{c.grade || "–"}</td>
            <td className={`py-1.5 font-semibold ${STATUS_TEXT[c.status] || "text-slate-700"}`}>
              {c.status}
              {c.moderation > 0 && <span className="ml-1 font-normal text-slate-500">(+{c.moderation} moderation)</span>}
              {c.note && c.status !== "PASS" && <span className="ml-1 font-normal text-slate-500">{c.note}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
