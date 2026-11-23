"use client";

// Hall tickets: see who is ready, print a class or one student.
// The printing itself happens on /print/hall-tickets/<examId> (new tab).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { confirmBox, useToast } from "../ui/Feedback";
import { ADMISSION_SHORT, errMsg, useApi } from "./shared";
import CollegeSelect, { classesFor, keepClass } from "../ui/CollegeFilter";
import { T } from "../ui/table";
import { deptTint, tintRow } from "../ui/deptTint";


export default function HallTickets({ timetableHref }) {
  const api = useApi();
  const toast = useToast();

  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);
  const [cls, setCls] = useState("");
  const [college, setCollege] = useState(""); // DAY (103) / EVENING (186)
  const [state, setState] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [printed, setPrinted] = useState(""); // "" | "YES" | "NO"
  const [summary, setSummary] = useState({}); // "cs-3" -> { total, ready, printed }
  const [reload, setReload] = useState(0);

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

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [cls, state, query, examId, college, printed]);

  const filter = useMemo(() => {
    const p = {};
    if (cls === "backlog") p.department = "backlog";
    else if (cls) {
      const [d, s] = cls.split("-");
      p.department = d;
      p.semester = s;
    }
    if (query) p.q = query;
    if (college) p.college = college;
    if (printed) p.printed = printed;
    return p;
  }, [cls, query, college, printed]);

  // ready / printed count of every class, for the class list
  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api("get", `/exams/${examId}/hall-tickets/summary`, undefined, { params: college ? { college } : {} })
      .then((r) => alive && setSummary(r.data.data || {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [api, examId, college, reload]);

  // tick / untick "printed" by hand
  const markPrinted = async (t, value) => {
    if (!value && !(await confirmBox(`Mark ${t.registerNumber} as not printed?\nIt will be counted as not printed again.`))) return;
    try {
      const r = await api("post", `/exams/${examId}/hall-tickets/printed`, { ids: [t._id], printed: value });
      toast.success(r.data.message);
      setReload((n) => n + 1);
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
  };

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api("get", `/exams/${examId}/hall-tickets`, undefined, { params: { ...filter, ...(state ? { state } : {}), page, limit: 40 } })
      .then((r) => alive && setData(r.data))
      .catch((e) => {
        toast.error(errMsg(e, "Could not load hall tickets."));
        setData({ data: [], counts: {}, total: 0, pages: 1 });
      });
    return () => {
      alive = false;
    };
  }, [api, examId, filter, state, page, toast, reload]);

  const exam = exams?.find((e) => e._id === examId);
  const printUrl = (extra = {}) => `/print/hall-tickets/${examId}?${new URLSearchParams({ ...filter, ...extra })}`;
  // evening / working professionals are small groups: they may be printed without a class
  const canPrintMany = Boolean(cls || query || college === "EVENING" || college === "WORKING");
  const classes = exam ? classesFor(exam.semesters, college) : [];
  const sel = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Hall tickets</h2>
          {!exams || exams.length <= 1 ? (
            <p className="mt-1 text-sm text-slate-500">{exam ? `${exam.name} · ${exam.academicYear}` : " "}</p>
          ) : (
            <select value={examId} onChange={(e) => setExamId(e.target.value)} className={`${sel} mt-2 h-10 max-w-full`}>
              {exams.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} · {e.academicYear}
                </option>
              ))}
            </select>
          )}
        </div>
        {examId && (
          <a
            href={canPrintMany ? printUrl() : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!canPrintMany}
            onClick={(e) => {
              if (!canPrintMany) {
                e.preventDefault();
                toast.info("Choose a class (or search for a student) first.");
              }
            }}
            className={`${btn.primary} ${canPrintMany ? "" : "opacity-40"}`}
          >
            <Icon name="ticket" className="h-4 w-4" />
            Print {cls ? "this class" : query ? "these students" : college === "EVENING" ? "evening shift" : college === "WORKING" ? "working prof." : "hall tickets"}
          </a>
        )}
      </div>

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}

      {data && !data.timetablePublished && (
        <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <Icon name="alert" className="h-4 w-4" />
          <b>The timetable is not published yet</b>, so no hall ticket can be printed.
          {timetableHref && (
            <Link href={timetableHref} className="font-semibold underline">
              Open time table
            </Link>
          )}
        </p>
      )}

      {examId && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["READY", "Ready to print", "bg-emerald-500", data?.counts?.ready],
              ["NOT_READY", "Not ready", "bg-red-500", data?.counts?.notReady],
            ].map(([k, label, dot, n]) => (
              <button
                key={k}
                onClick={() => setState(state === k ? "" : k)}
                className={`rounded-2xl border bg-white px-4 py-3 text-left transition hover:border-slate-300 ${
                  state === k ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-200"
                }`}
              >
                <p className="text-2xl font-bold tabular-nums text-slate-950">{n ?? "–"}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {label}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register number or name" className={`${T.field} w-60 pl-8`} />
            </div>
            <CollegeSelect
              value={college}
              onChange={(v) => {
                setCollege(v);
                setCls((c) => keepClass(c, v));
              }}
              className={T.field}
            />
            <select value={cls} onChange={(e) => setCls(e.target.value)} className={T.field}>
              <option value="">All classes</option>
              {classes.map(([v, l]) => {
                const o = summary[v];
                // e.g. "CS · Sem 3 — 58/60 ready · 58 printed ✓"
                const info = o
                  ? ` — ${o.ready}/${o.total} ready${o.printed ? ` · ${o.printed} printed` : ""}${o.ready && o.printed >= o.ready ? " ✓" : ""}`
                  : "";
                return (
                  <option key={v} value={v}>
                    {l}
                    {info}
                  </option>
                );
              })}
            </select>
            <select value={printed} onChange={(e) => setPrinted(e.target.value)} className={T.field} aria-label="Printed or not">
              <option value="">Printed + not printed</option>
              <option value="NO">Not printed yet</option>
              <option value="YES">Already printed</option>
            </select>
          </div>

          <div className={`mt-4 ${T.wrap}`}>
            {!data && <div className="h-48 animate-pulse" />}
            {data && data.data.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No students match.</p>}
            {data?.data.length > 0 && (
              <table className={T.table}>
                <thead>
                  <tr className={T.headRow}>
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Register no.</th>
                    <th className={T.th}>Name</th>
                    <th className={T.th}>Class</th>
                    <th className={T.th}>Subjects</th>
                    <th className={T.th}>Status</th>
                    <th className={T.th}>Printed</th>
                    <th className={`${T.th} text-right`}>Hall ticket</th>
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {data.data.map((t, i) => (
                    <tr key={t._id} className={`${T.row} ${tintRow(t.department, i)}`}>
                      <td className={T.tdNum}>{(page - 1) * 40 + i + 1}</td>
                      <td className={`${T.td} font-semibold tabular-nums text-slate-950`}>{t.registerNumber}</td>
                      <td className={T.td}>
                        <p className="font-medium text-slate-900">{t.name}</p>
                        <p className="text-[11px] text-slate-400">{ADMISSION_SHORT[t.admissionType] || t.admissionType}</p>
                      </td>
                      <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
                        {t.backPapersOnly ? (
                          "Back papers only"
                        ) : (
                          <>
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${deptTint(t.department).chip}`}>{t.department.toUpperCase()}</span> Sem {t.semester}
                          </>
                        )}
                      </td>
                      <td className={`${T.td} text-xs tabular-nums text-slate-600`}>
                        {t.permittedCount} / {t.subjects.filter((s) => !s.audit).length} permitted
                      </td>
                      <td className={`${T.td} max-w-[18rem]`}>
                        {t.ready ? (
                          <span className={`${T.pill} bg-emerald-50 text-emerald-700`}>
                            <span className={`${T.dot} bg-emerald-500`} />
                            Ready
                          </span>
                        ) : (
                          <>
                            <span className={`${T.pill} bg-red-50 text-red-700`}>
                              <span className={`${T.dot} bg-red-500`} />
                              Not ready
                            </span>
                            <p className="mt-1 text-[11px] leading-4 text-red-600">{t.reasons.join(" ")}</p>
                          </>
                        )}
                      </td>
                      <td className={`${T.td} whitespace-nowrap`}>
                        {t.printedAt ? (
                          <button
                            onClick={() => markPrinted(t, false)}
                            title={`Printed by ${t.printedBy || "?"}${t.printTimes > 1 ? ` · printed ${t.printTimes} times` : ""} – click to mark as not printed`}
                            className={`${T.pill} bg-blue-50 text-blue-700 hover:bg-blue-100`}
                          >
                            ✓ Printed {new Date(t.printedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </button>
                        ) : t.ready ? (
                          <button onClick={() => markPrinted(t, true)} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
                            Mark printed
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${T.td} text-right`}>
                        {t.ready && (
                          <a href={printUrl({ q: t.registerNumber })} target="_blank" rel="noreferrer" className={btn.small}>
                            <Icon name="ticket" className="h-3.5 w-3.5" />
                            Print
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btn.small}>
                <Icon name="chevronLeft" className="h-4 w-4" /> Previous
              </button>
              <span className="text-slate-500">
                Page {page} of {data.pages}
              </span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className={btn.small}>
                Next <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
