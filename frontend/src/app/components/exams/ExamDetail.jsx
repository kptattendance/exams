"use client";

// One examination: register students, see who may write which subject,
// change a decision (with reason), add back papers by hand, download Excel.
// COE/Admin: canManage. Office: canEditSubjects (back papers on hall tickets). Principal: view only.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { ExamForm } from "./ExamList";
import ExamFeeSettings from "./ExamFeeSettings";
import { T } from "../ui/table";
import {
  ADMISSION_SHORT,
  DECISION,
  KIND,
  OVERALL,
  SHEET,
  deptLabel,
  downloadBlob,
  errMsg,
  useApi,
} from "./shared";
import { useIsAdmin } from "../useRole";

const PAGE_SIZE = 40;

export default function ExamDetail({ id, basePath, canManage = false, canEditSubjects = canManage, bridgeHref, feesHref }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  const [exam, setExam] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [gen, setGen] = useState(null); // progress while registering
  const [editing, setEditing] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const [addingBack, setAddingBack] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [filters, setFilters] = useState({ cls: "", overall: "", issue: "", q: "" });
  const [tab, setTab] = useState("classes"); // classes | students | sheets
  const [openClass, setOpenClass] = useState(null); // class shown in the pop-up
  // a tile / count was clicked: show the students with that filter
  const showStudents = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setTab("students");
  };

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/exams/${id}`);
      setExam(r.data.data);
    } catch (e) {
      setLoadError(errMsg(e, "Could not load this examination."));
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadAll = () => {
    load();
    setListKey((k) => k + 1);
  };

  // ---------------------------------------------------------------- register
  const processLoop = async () => {
    let busy = 0;
    for (let i = 0; i < 300; i++) {
      const r = await api("post", `/exams/${id}/process`);
      const g = r.data.data.generation;
      setGen(g);
      if (r.data.busy) {
        if (++busy > 15) throw new Error("busy");
        await new Promise((res) => setTimeout(res, 2000));
        continue;
      }
      if (!g.running) return g;
    }
    throw new Error("timeout");
  };

  const register = async ({ again }) => {
    if (again) {
      const ok = await confirm({
        title: "Refresh registration?",
        message:
          "Subjects and eligibility are worked out again from the latest IA, attendance, electives and bridge-course settings.\n\nThis normally happens by itself for the class concerned whenever something changes – use this only to update every class at once.\n\nYour changed decisions, back papers added by hand and fee entries are kept.",
        confirmText: "Refresh",
      });
      if (!ok) return;
    }
    setGen({ total: 0, done: 0, running: true });
    try {
      await api("post", `/exams/${id}/generate`, {});
      const g = await processLoop();
      if (g.failed?.length) {
        toast.error(`Finished, but ${g.failed.length} class(es) failed: ${g.failed.map((f) => f.key).join(", ")}. Try Refresh again.`, 9000);
      } else {
        toast.success(again ? "Registration refreshed." : "Students registered. Check the list below.");
      }
    } catch (e) {
      toast.error(
        e.message === "busy" ? "Someone else is registering students for this exam right now. Try again in a minute." : errMsg(e, "Registration stopped because of a network problem. Click Continue to finish it.")
      );
    }
    setGen(null);
    reloadAll();
  };

  const continueRegister = async () => {
    setGen({ ...exam.generation });
    try {
      await processLoop();
      toast.success("Registration finished.");
    } catch (e) {
      toast.error(errMsg(e, "Registration stopped again. Please try once more."));
    }
    setGen(null);
    reloadAll();
  };

  // ---------------------------------------------------------------- delete
  const remove = async () => {
    const ok = await confirm({
      title: "Delete this examination?",
      message: `“${exam.name}” and all ${exam.classes?.reduce((n, c) => n + c.students, 0) || 0} student registrations will be removed. This cannot be undone.`,
      confirmText: "Delete examination",
      tone: "danger",
      requireText: "DELETE",
    });
    if (!ok) return;
    try {
      await api("delete", `/exams/${id}`, { confirm: "DELETE" });
      toast.success("Examination deleted.");
      router.push(basePath);
    } catch (e) {
      toast.error(errMsg(e, "Could not delete."));
    }
  };

  const download = async (params = {}) => {
    try {
      await downloadBlob(api, `/exams/${id}/export`, params, "eligibility.xlsx");
    } catch (e) {
      toast.error("Could not download the Excel file.");
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-7">
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
        <Link href={basePath} className={`${btn.secondary} mt-4`}>
          Back to examinations
        </Link>
      </div>
    );
  }
  if (!exam) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-7">
        <div className="h-24 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const totalStudents = exam.classes.reduce((n, c) => n + c.students, 0);
  const sum = (k) => exam.classes.reduce((n, c) => n + (c[k] || 0), 0);
  const registered = totalStudents > 0;
  const interrupted = exam.generation.running && !gen;
  const notReady = exam.readiness.filter((r) => r.ia !== "confirmed" || r.attendance !== "confirmed");
  const classKeys = new Set(exam.classes.map((c) => c.key));
  const relevantNotReady = notReady.filter((r) => classKeys.has(`${r.department}-${r.semester}`));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Icon name="chevronLeft" className="h-4 w-4" />
        All examinations
      </Link>

      {/* ------------------------------------------------ header */}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">{exam.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <Chip>{exam.academicYear}</Chip>
            <Chip>Semester {exam.semesters.join(", ")}</Chip>
            <Chip>Attendance ≥ {exam.minAttendance}%</Chip>
            <Chip>
              {{ SAME_PARITY: "Back papers: matching semesters", ALL: "Back papers: all semesters", NONE: "No back papers" }[exam.backPapers]}
            </Chip>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && registered && (
            <button onClick={() => register({ again: true })} disabled={Boolean(gen)} className={btn.primary}>
              <Icon name="refresh" className="h-4 w-4" />
              Refresh registration
            </button>
          )}
          {registered && canManage && (
            <Link href={`${basePath}/${id}/timetable`} className={btn.secondary}>
              <Icon name="calendar" className="h-4 w-4" />
              Time table
            </Link>
          )}
          {canEditSubjects && (
            <button onClick={() => setAddingBack(true)} className={btn.secondary}>
              <Icon name="plus" className="h-4 w-4" />
              Add back paper
            </button>
          )}
          {registered && (
            <button onClick={() => download()} className={btn.secondary}>
              <Icon name="download" className="h-4 w-4" />
              Excel
            </button>
          )}
          {canManage && (
            <>
              <button onClick={() => setEditing(true)} className={btn.secondary} title="Edit exam details">
                <Icon name="edit" className="h-4 w-4" />
                <span className="sm:hidden lg:inline">Edit</span>
              </button>
              <button onClick={() => setFeeOpen(true)} className={btn.secondary} title="Exam fee per subject, per back paper and late fees">
                <Icon name="money" className="h-4 w-4" />
                <span className="sm:hidden lg:inline">Exam fee</span>
              </button>
              {isAdmin && (
              <button onClick={remove} className={btn.danger} title="Delete examination">
                <Icon name="trash" className="h-4 w-4" />
                <span className="sm:hidden lg:inline">Delete</span>
              </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ banners */}
      <div className="mt-5 space-y-3">
        {interrupted && canManage && (
          <Banner tone="amber" icon="alert" title="Registration was interrupted">
            {exam.generation.done} of {exam.generation.total} classes are done.
            <button onClick={continueRegister} className="ml-2 font-semibold underline">
              Continue
            </button>
          </Banner>
        )}
        {exam.unmappedBridge?.length > 0 && (
          <Banner tone="amber" icon="bridge" title={`${exam.unmappedBridge.length} bridge courses don’t say which lateral students take them`}>
            Until you set it, they are given to every lateral student.{" "}
            {bridgeHref && (
              <Link href={bridgeHref} className="font-semibold underline">
                Set bridge courses
              </Link>
            )}
          </Banner>
        )}
        {exam.readiness.some((r) => r.iaOtherYears?.length || r.attendanceOtherYears?.length) && (
          <Banner tone="amber" icon="alert" title="Some HOD sheets were saved under a different academic year">
            {exam.readiness
              .filter((r) => r.iaOtherYears?.length || r.attendanceOtherYears?.length)
              .map(
                (r) =>
                  `${r.department.toUpperCase()} sem ${r.semester}: ${[
                    r.iaOtherYears?.length ? `IA in ${r.iaOtherYears.join(", ")}` : "",
                    r.attendanceOtherYears?.length ? `attendance in ${r.attendanceOtherYears.join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join(", ")}`
              )
              .join(" · ")}
            . This exam uses {exam.academicYear}. The Admin can move these sheets to the running year in Admin → Settings (one
            click each).
          </Banner>
        )}
        {registered && exam.generation.stale?.length > 0 && (
          <Banner tone="amber" icon="refresh" title={`Registration is out of date for ${exam.generation.stale.length} class${exam.generation.stale.length === 1 ? "" : "es"}`}>
            {exam.generation.stale.map((s) => `${s.key === "backlog" ? "Back-paper students" : `${String(s.department).toUpperCase()} sem ${s.semester}`} (${s.reason})`).join(" · ")}. It is
            normally updated by itself; this time it could not run. Hall tickets update it before printing.
            {canManage && (
              <button onClick={() => register({ again: true })} disabled={Boolean(gen)} className="ml-2 font-semibold underline">
                Update now
              </button>
            )}
          </Banner>
        )}
        {registered && relevantNotReady.length > 0 && (
          <Banner tone="blue" icon="list" title={`IA or attendance not frozen yet for ${relevantNotReady.length} classes`}>
            Students of those classes show as “Waiting”. As soon as the Exam Officer freezes a sheet, that class is updated by itself.
          </Banner>
        )}
      </div>

      {/* ------------------------------------------------ first time */}
      {!registered && !gen && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <p className="text-lg font-bold text-slate-950">Register students for this exam</p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            {[
              "Every active student of the chosen semesters is registered for his semester’s subjects.",
              "Lateral students get the bridge courses of their type (PUC / ITI / ITI cross) and department.",
              "Electives come from the HOD’s Electives page. Back papers come from earlier results.",
              `Each subject is checked: attendance below ${exam.minAttendance}% → ANS, IA below minimum → NE.`,
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
          {canManage ? (
            <button onClick={() => register({ again: false })} className={`${btn.primary} mt-6`}>
              <Icon name="students" className="h-4 w-4" />
              Register students
            </button>
          ) : (
            <p className="mt-6 text-sm font-medium text-slate-500">The COE has not registered students yet.</p>
          )}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <SheetTable readiness={exam.readiness} semesters={exam.semesters} />
          </div>
        </div>
      )}

      {registered && (
        <>
          {/* ------------------------------------------------ summary */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile n={totalStudents} label="Students" tone="slate" icon="students" active={tab === "students" && !filters.overall} onClick={() => showStudents({ overall: "" })} />
            {[
              ["ALL_CLEAR", "emerald", "check"],
              ["PARTIAL", "orange", "alert"],
              ["BLOCKED", "red", "close"],
              ["PENDING", "slate", "list"],
            ].map(([k, tone, icon]) => (
              <Tile key={k} n={sum(k)} label={OVERALL[k].short} tone={tone} icon={icon} active={tab === "students" && filters.overall === k} onClick={() => showStudents({ overall: filters.overall === k ? "" : k })} />
            ))}
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
              <span className="font-semibold text-slate-800">Subjects</span>
              <span>
                <b className="tabular-nums text-emerald-700">{exam.subjectCounts.ELIGIBLE}</b> <span className="text-slate-500">eligible</span>
              </span>
              <button className="hover:underline" onClick={() => showStudents({ issue: "ANS" })}>
                <b className="tabular-nums text-red-700">{exam.subjectCounts.ANS}</b> <span className="text-slate-500">attendance shortage (ANS)</span>
              </button>
              <button className="hover:underline" onClick={() => showStudents({ issue: "NE" })}>
                <b className="tabular-nums text-orange-700">{exam.subjectCounts.NE}</b> <span className="text-slate-500">IA below minimum (NE)</span>
              </button>
              <button className="hover:underline" onClick={() => showStudents({ issue: "PENDING" })}>
                <b className="tabular-nums text-slate-700">{exam.subjectCounts.PENDING}</b> <span className="text-slate-500">waiting</span>
              </button>
            </div>
            {exam.feeCounts && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-semibold text-slate-800">Fees</span>
                <span>
                  <b className="tabular-nums text-emerald-700">{exam.feeCounts.PAID}</b> <span className="text-slate-500">fully paid</span>
                </span>
                <span>
                  <b className="tabular-nums text-orange-700">{exam.feeCounts.PARTIAL}</b> <span className="text-slate-500">partly paid</span>
                </span>
                <span>
                  <b className="tabular-nums text-red-700">{exam.feeCounts.UNPAID}</b> <span className="text-slate-500">not paid</span>
                </span>
                {feesHref && (
                  <Link href={feesHref} className="ml-auto font-semibold text-blue-700 hover:underline">
                    Fee verification →
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* ------------------------------------------------ tabs */}
          <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
            {[
              ["classes", "Classes", exam.classes.length],
              ["students", "Students", totalStudents],
              ["sheets", "HOD sheets (IA / attendance)", notReady.length ? `${notReady.length} not frozen` : "all frozen"],
            ].map(([k, label, badge]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === k ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{badge}</span>
              </button>
            ))}
          </div>

          {tab === "classes" && <ClassTable classes={exam.classes} onOpen={setOpenClass} onDownload={download} />}

          {tab === "students" && (
            <StudentList
              key={listKey}
              examId={id}
              classes={exam.classes}
              filters={filters}
              setFilters={setFilters}
              canManage={canManage}
              canEditSubjects={canEditSubjects}
              onChanged={load}
            />
          )}

          {tab === "sheets" && (
            <div className="mt-4">
              <SheetTable readiness={exam.readiness} semesters={exam.semesters} />
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------ one class in a pop-up */}
      {openClass && (
        <ClassModal
          cls={openClass}
          examId={id}
          classes={exam.classes}
          canManage={canManage}
          canEditSubjects={canEditSubjects}
          onChanged={load}
          onDownload={download}
          onClose={() => {
            setOpenClass(null);
            setListKey((k) => k + 1);
          }}
        />
      )}

      {/* ------------------------------------------------ modals */}
      {gen && <ProgressModal gen={gen} />}
      {canManage && editing && (
        <EditExam exam={exam} onClose={() => setEditing(false)} onSaved={(e) => (setEditing(false), load())} />
      )}
      {canManage && feeOpen && <ExamFeeSettings exam={exam} onClose={() => setFeeOpen(false)} onSaved={() => (setFeeOpen(false), load())} />}
      {canEditSubjects && (
        <AddBackPaper
          open={addingBack}
          examId={id}
          onClose={() => setAddingBack(false)}
          onAdded={() => {
            setAddingBack(false);
            reloadAll();
          }}
        />
      )}
    </div>
  );
}

// ==================================================================== bits

const Chip = ({ children }) => <span className="rounded-lg bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">{children}</span>;

function Banner({ tone, icon, title, children }) {
  const tones = {
    amber: "border-orange-200 bg-orange-50 text-orange-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm leading-6">
        <p className="font-semibold">{title}</p>
        <p className="opacity-90">{children}</p>
      </div>
    </div>
  );
}

const TONE = {
  slate: { box: "from-slate-50 to-white", icon: "bg-slate-100 text-slate-600", num: "text-slate-950" },
  emerald: { box: "from-emerald-50 to-white", icon: "bg-emerald-100 text-emerald-700", num: "text-emerald-800" },
  orange: { box: "from-orange-50 to-white", icon: "bg-orange-100 text-orange-700", num: "text-orange-800" },
  red: { box: "from-red-50 to-white", icon: "bg-red-100 text-red-700", num: "text-red-800" },
};

function Tile({ n, label, tone = "slate", icon, active, onClick }) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br ${t.box} px-4 py-3 text-left transition hover:shadow-sm ${
        active ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-200"
      }`}
    >
      {icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className={`block text-2xl font-bold tabular-nums tracking-tight ${t.num}`}>{n}</span>
        <span className="block truncate text-xs font-semibold text-slate-500">{label}</span>
      </span>
    </button>
  );
}

// Every class of the exam – click a row to see its students in a pop-up
function ClassTable({ classes, onOpen, onDownload }) {
  const [sem, setSem] = useState("");
  const [q, setQ] = useState("");
  const sems = [...new Set(classes.filter((c) => c.key !== "backlog").map((c) => c.semester))].sort();
  const shown = classes.filter(
    (c) =>
      (!sem || (sem === "backlog" ? c.key === "backlog" : String(c.semester) === sem && c.key !== "backlog")) &&
      (!q || `${c.department} ${deptLabel(c.department)}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const num = "px-3 py-3 text-right tabular-nums";
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-60">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Department" className={`${T.field} w-full pl-8`} />
        </div>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={T.field}>
          <option value="">All semesters</option>
          {sems.map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
          {classes.some((c) => c.key === "backlog") && <option value="backlog">Back papers only</option>}
        </select>
        <span className="ml-auto text-xs text-slate-500">Click a class to see its students</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-12 px-3 py-3 text-center">Sl.</th>
                <th className="px-3 py-3">Class</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3 text-right">Students</th>
                <th className="px-3 py-3 text-right text-emerald-700">All clear</th>
                <th className="px-3 py-3 text-right text-orange-700">Partly blocked</th>
                <th className="px-3 py-3 text-right text-red-700">Blocked</th>
                <th className="px-3 py-3 text-right">Waiting</th>
                <th className="w-36 px-3 py-3">Ready</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No class matches.
                  </td>
                </tr>
              )}
              {shown.map((c, i) => {
                const pct = c.students ? Math.round((c.ALL_CLEAR / c.students) * 100) : 0;
                return (
                  <tr key={c.key} onClick={() => onOpen(c)} className="cursor-pointer transition hover:bg-blue-50/50">
                    <td className="px-3 py-3 text-center text-xs tabular-nums text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3">
                      {c.key === "backlog" ? (
                        <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">Back papers</span>
                      ) : (
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
                          {c.department.toUpperCase()} · Sem {c.semester}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{c.key === "backlog" ? "Students writing only back papers" : deptLabel(c.department)}</td>
                    <td className={`${num} font-semibold text-slate-900`}>{c.students}</td>
                    <td className={`${num} text-emerald-700`}>{c.ALL_CLEAR || "–"}</td>
                    <td className={`${num} text-orange-700`}>{c.PARTIAL || "–"}</td>
                    <td className={`${num} text-red-700`}>{c.BLOCKED || "–"}</td>
                    <td className={`${num} text-slate-500`}>{c.PENDING || "–"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">View</span>
                        {c.key !== "backlog" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownload({ department: c.department, semester: c.semester });
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-800"
                            title="Download this class (Excel)"
                            aria-label={`Download ${c.key}`}
                          >
                            <Icon name="download" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// The HOD sheets (IA / attendance) of every department and semester, as a table
const SHEET_PILL = {
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  submitted: "bg-blue-50 text-blue-700 ring-blue-200",
  draft: "bg-orange-50 text-orange-700 ring-orange-200",
  missing: "bg-slate-50 text-slate-500 ring-slate-200",
};

function SheetTable({ readiness, semesters }) {
  const [sem, setSem] = useState("");
  const [show, setShow] = useState("");
  const ready = (r) => r.ia === "confirmed" && r.attendance === "confirmed";
  const rows = readiness
    .filter((r) => (!sem || String(r.semester) === sem) && (!show || (show === "ready" ? ready(r) : !ready(r))))
    .sort((a, b) => a.semester - b.semester || a.department.localeCompare(b.department));
  const pill = (state) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${SHEET_PILL[state] || SHEET_PILL.missing}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SHEET_DOT[state] || SHEET_DOT.missing}`} />
      {SHEET[state]?.label || state}
    </span>
  );
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-slate-600">
          Exam eligibility uses only <b>frozen</b> sheets. HOD submits → Exam Officer freezes.
        </p>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={T.field}>
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value)} className={T.field}>
          <option value="">All sheets</option>
          <option value="pending">Not frozen yet</option>
          <option value="ready">Both frozen</option>
        </select>
      </div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-12 px-3 py-3 text-center">Sl.</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Semester</th>
                <th className="px-3 py-3">IA sheet</th>
                <th className="px-3 py-3">Attendance sheet</th>
                <th className="px-3 py-3">For the exam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Nothing to show.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={`${r.department}-${r.semester}`} className="hover:bg-slate-50/60">
                  <td className="px-3 py-3 text-center text-xs tabular-nums text-slate-400">{i + 1}</td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-slate-900">{r.department.toUpperCase()}</span>
                    <span className="ml-2 text-xs text-slate-500">{deptLabel(r.department)}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">Sem {r.semester}</td>
                  <td className="px-3 py-3">{pill(r.ia)}</td>
                  <td className="px-3 py-3">{pill(r.attendance)}</td>
                  <td className="px-3 py-3">
                    {ready(r) ? (
                      <span className="text-xs font-semibold text-emerald-700">✓ Ready</span>
                    ) : (
                      <span className="text-xs text-slate-500">Students show as “Waiting”</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// One class's students in a pop-up (same list, filters and actions as the Students tab)
function ClassModal({ cls, examId, classes, canManage, canEditSubjects, onChanged, onDownload, onClose }) {
  const [filters, setFilters] = useState({ cls: cls.key, overall: "", issue: "", q: "" });
  const title = cls.key === "backlog" ? "Back papers only" : `${cls.department.toUpperCase()} · Semester ${cls.semester}`;
  return (
    <Modal
      open
      xl
      onClose={onClose}
      title={title}
      subtitle={`${cls.key === "backlog" ? "Students writing only back papers" : deptLabel(cls.department)} · ${cls.students} students · ${cls.ALL_CLEAR} all clear · ${cls.PARTIAL + cls.BLOCKED} not permitted in some subject · ${cls.PENDING} waiting`}
      footer={
        <>
          {cls.key !== "backlog" && (
            <button onClick={() => onDownload({ department: cls.department, semester: cls.semester })} className={btn.secondary}>
              <Icon name="download" className="h-4 w-4" />
              Excel of this class
            </button>
          )}
          <button onClick={onClose} className={btn.primary}>
            Close
          </button>
        </>
      }
    >
      <StudentList
        examId={examId}
        classes={classes}
        filters={filters}
        setFilters={setFilters}
        fixedClass
        canManage={canManage}
        canEditSubjects={canEditSubjects}
        onChanged={onChanged}
      />
    </Modal>
  );
}

const SHEET_DOT = { confirmed: "bg-emerald-500", submitted: "bg-blue-500", draft: "bg-orange-300", missing: "bg-slate-300" };

function ProgressModal({ gen }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-950">Registering students…</p>
            <p className="text-sm text-slate-500">Working out subjects and eligibility class by class</p>
          </div>
        </div>
        <div className="mb-2 mt-6 flex justify-between text-sm">
          <span className="font-medium text-slate-700">Classes done</span>
          <span className="tabular-nums text-slate-500">
            {gen.done || 0} / {gen.total || "…"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${gen.total ? Math.max(4, (gen.done / gen.total) * 100) : 4}%` }}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Keep this page open. It takes about a minute.</p>
      </div>
    </div>
  );
}

// ==================================================================== student list

function StudentList({ examId, classes, filters, setFilters, fixedClass = false, canManage, canEditSubjects, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(filters.q);
  const [open, setOpen] = useState(null);
  const [overriding, setOverriding] = useState(null); // { reg, subject }

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === q ? f : { ...f, q })), 350);
    return () => clearTimeout(t);
  }, [q, setFilters]);

  useEffect(() => setPage(1), [filters]);

  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    if (filters.cls === "backlog") p.department = "backlog";
    else if (filters.cls) {
      const [d, s] = filters.cls.split("-");
      p.department = d;
      p.semester = s;
    }
    if (filters.overall) p.overall = filters.overall;
    if (filters.issue) p.issue = filters.issue;
    if (filters.q) p.q = filters.q;
    return p;
  }, [filters, page]);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/exams/${examId}/registrations`, undefined, { params });
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load students."));
      setData({ data: [], total: 0, pages: 1 });
    }
  }, [api, examId, params, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (reg) => {
    setData((d) => ({ ...d, data: d.data.map((x) => (x._id === reg._id ? reg : x)) }));
    onChanged?.();
  };

  const removeManual = async (reg, s) => {
    try {
      const r = await api("delete", `/exams/${examId}/registrations/${reg._id}/subjects/${s.subject}`);
      toast.success(r.data.message || `${s.code} removed.`);
      if (r.data.data) replace(r.data.data);
      else load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };

  const items = data?.data || [];
  const sel = T.field;

  return (
    <section className={fixedClass ? "" : "mt-4"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-lg font-bold tracking-tight text-slate-950">
          Students {data && <span className="text-sm font-medium text-slate-500">({data.total})</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or register no."
              className={`${sel} w-full pl-8`}
            />
          </div>
          {!fixedClass && (
          <select value={filters.cls} onChange={(e) => setFilters((f) => ({ ...f, cls: e.target.value }))} className={sel}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key === "backlog" ? "Back papers only" : `${c.department.toUpperCase()} · Sem ${c.semester}`}
              </option>
            ))}
          </select>
          )}
          <select value={filters.overall} onChange={(e) => setFilters((f) => ({ ...f, overall: e.target.value }))} className={sel}>
            <option value="">Any result</option>
            {Object.entries(OVERALL).map(([k, o]) => (
              <option key={k} value={k}>
                {o.short}
              </option>
            ))}
          </select>
          <select value={filters.issue} onChange={(e) => setFilters((f) => ({ ...f, issue: e.target.value }))} className={sel}>
            <option value="">Any subject</option>
            <option value="ANS">Has ANS</option>
            <option value="NE">Has NE</option>
            <option value="PENDING">Has waiting subject</option>
            <option value="BACKLOG">Has back paper</option>
            <option value="OVERRIDDEN">Decision changed by COE</option>
            <option value="WARNING">Has a warning</option>
          </select>
        </div>
      </div>

      {(filters.overall || filters.issue || (filters.cls && !fixedClass) || filters.q) && (
        <button
          onClick={() => {
            setQ("");
            setFilters((f) => ({ cls: fixedClass ? f.cls : "", overall: "", issue: "", q: "" }));
          }}
          className="mt-3 text-xs font-semibold text-blue-700 hover:underline"
        >
          Clear filters
        </button>
      )}

      <div className={`mt-4 ${T.wrap}`}>
        {data === null && <div className="h-48 animate-pulse" />}
        {data && items.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No students match these filters.</p>}
        {items.length > 0 && (
        <table className={T.table}>
          <thead>
            <tr className={T.headRow}>
              <th className={T.thNum}>Sl.</th>
              <th className={T.th}>Student</th>
              <th className={T.th}>Class</th>
              <th className={T.th}>Subjects</th>
              <th className={T.th}>Eligibility</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className={T.body}>
        {items.map((reg, i) => (
          <StudentRow
            key={reg._id}
            sl={(page - 1) * PAGE_SIZE + i + 1}
            reg={reg}
            open={open === reg._id}
            onToggle={() => setOpen(open === reg._id ? null : reg._id)}
            canManage={canManage}
            canEditSubjects={canEditSubjects}
            onOverride={(s) => setOverriding({ reg, subject: s })}
            onRemove={(s) => removeManual(reg, s)}
          />
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

      {overriding && (
        <OverrideModal
          examId={examId}
          reg={overriding.reg}
          subject={overriding.subject}
          onClose={() => setOverriding(null)}
          onSaved={(reg) => {
            setOverriding(null);
            replace(reg);
          }}
        />
      )}
    </section>
  );
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StudentRow({ sl, reg, open, onToggle, canManage, canEditSubjects, onOverride, onRemove }) {
  const o = OVERALL[reg.overall];
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer ${T.row} ${open ? "bg-slate-50" : ""}`} aria-expanded={open}>
        <td className={T.tdNum}>{sl}</td>
        <td className={T.td}>
          <div className="flex items-center gap-2.5">
            {reg.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reg.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                {initials(reg.name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">{reg.name}</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-500">
                {reg.registerNumber}
                {reg.warnings?.length > 0 && <span className="ml-2 text-orange-700">⚠ {reg.warnings.length}</span>}
              </p>
            </div>
          </div>
        </td>
        <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
          {reg.department.toUpperCase()} · Sem {reg.semester}
          <p className="text-[11px] text-slate-400">{ADMISSION_SHORT[reg.admissionType] || reg.admissionType}</p>
        </td>
        <td className={T.td}>
          <div className="flex flex-wrap gap-1">
            {reg.subjects.map((s) => (
              <span
                key={s.subject}
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${DECISION[s.effective].chip} ${
                  s.effective === "ANS" || s.effective === "NE" ? "line-through decoration-2" : ""
                }`}
                title={`${s.code} ${s.name}: ${DECISION[s.effective].label}`}
              >
                {s.code}
                {s.kind === "BACKLOG" && <sup className="ml-0.5">B</sup>}
              </span>
            ))}
          </div>
        </td>
        <td className={T.td}>
          <span className={`${T.pill} bg-slate-50 ${o.text}`}>
            <span className={`${T.dot} ${o.dot}`} />
            {o.short}
          </span>
        </td>
        <td className="pr-3">
          <Icon name="chevronRight" className={`h-4 w-4 text-slate-300 transition ${open ? "rotate-90" : ""}`} />
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50/60">
          <td />
          <td colSpan={5} className="px-3 pb-4 pt-2">
            {reg.warnings?.length > 0 && (
              <ul className="mb-3 space-y-1 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-900">
                {reg.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              {reg.subjects.map((s) => (
                <SubjectLine key={s.subject} s={s} canManage={canManage} canEditSubjects={canEditSubjects} onOverride={() => onOverride(s)} onRemove={() => onRemove(s)} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SubjectLine({ s, canManage, canEditSubjects, onOverride, onRemove }) {
  const d = DECISION[s.effective];
  const blocked = s.effective === "ANS" || s.effective === "NE";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold text-slate-900 ${blocked ? "line-through decoration-red-400 decoration-2" : ""}`}>
            {s.code} <span className="font-normal text-slate-600">{s.name}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
            {KIND[s.kind] && <span className="font-semibold text-blue-700">{KIND[s.kind]}{s.kind === "BACKLOG" && s.semester ? ` (sem ${s.semester})` : ""}</span>}
            {!s.hasTheory && <span>Practical only</span>}
            {s.iaMarks !== null && s.iaMarks !== undefined && (
              <span>
                IA {s.iaMarks}
                {s.iaMax ? `/${s.iaMax}` : ""}
              </span>
            )}
            {s.attendancePct !== null && s.attendancePct !== undefined && <span>Attendance {s.attendancePct}%</span>}
            {s.source === "MANUAL" && <span>Added by hand</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${d.chip}`}>
            {blocked ? `Not permitted (${s.effective})` : d.label}
          </span>
          {canManage && (
            <button onClick={onOverride} className={btn.small}>
              <Icon name="edit" className="h-3.5 w-3.5" />
              Change
            </button>
          )}
          {canEditSubjects && s.source === "MANUAL" && (
            <button onClick={onRemove} className={`${btn.small} text-red-600`} title="Remove this back paper">
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {(s.override || s.reasons?.length > 0) && (
        <div className="mt-2 space-y-1 text-xs leading-5">
          {s.override && (
            <p className="rounded-lg bg-blue-50 px-2 py-1 text-blue-900">
              Changed by COE from <b>{s.status}</b> to <b>{s.override.status}</b>: {s.override.reason}{" "}
              <span className="text-blue-700/70">({s.override.by})</span>
            </p>
          )}
          {s.reasons?.map((r, i) => (
            <p key={i} className="text-slate-500">
              {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================================================================== modals

function OverrideModal({ examId, reg, subject, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [status, setStatus] = useState(subject.override?.status || (subject.status === "ELIGIBLE" ? "ANS" : "ELIGIBLE"));
  const [reason, setReason] = useState(subject.override?.reason || "");
  const [busy, setBusy] = useState(false);

  const save = async (clear = false) => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/registrations/${reg._id}/override`, {
        subjectId: subject.subject,
        status: clear ? null : status,
        reason,
      });
      toast.success(clear ? "Back to the software’s decision." : "Decision changed.");
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={`${subject.code} – ${reg.registerNumber}`}
      subtitle={`${reg.name} · ${subject.name}`}
      footer={
        <>
          {subject.override && (
            <button onClick={() => save(true)} disabled={busy} className={`${btn.secondary} sm:mr-auto`}>
              Undo change
            </button>
          )}
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={() => save(false)} disabled={busy || reason.trim().length < 3} className={btn.primary}>
            Save decision
          </button>
        </>
      }
    >
      <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
        <p className="text-slate-500">The software decided</p>
        <p className="font-semibold text-slate-900">{DECISION[subject.status].label}</p>
        {subject.reasons?.map((r, i) => (
          <p key={i} className="mt-1 text-xs text-slate-500">
            {r}
          </p>
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-800">Change it to</p>
      <div className="mt-2 space-y-2">
        {[
          ["ELIGIBLE", "Allow – may write this exam"],
          ["ANS", "Not permitted – attendance shortage (ANS)"],
          ["NE", "Not permitted – IA below minimum (NE)"],
        ].map(([v, label]) => (
          <label
            key={v}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
              status === v ? "border-blue-600 bg-blue-50/60" : "border-slate-200"
            }`}
          >
            <input type="radio" name="decision" checked={status === v} onChange={() => setStatus(v)} className="accent-blue-600" />
            {label}
          </label>
        ))}
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-slate-800">Reason (kept in the record)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Condoned on medical grounds – Principal’s order dated 12-11-2026"
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
        />
      </label>
    </Modal>
  );
}

function AddBackPaper({ open, examId, onClose, onAdded }) {
  const api = useApi();
  const toast = useToast();
  const [regNo, setRegNo] = useState("");
  const [codes, setCodes] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/back-papers`, {
        registerNumber: regNo,
        codes: codes.split(/[\s,;]+/).filter(Boolean),
      });
      toast.success(r.data.message || "Back paper added.");
      setRegNo("");
      setCodes("");
      onAdded();
    } catch (e) {
      toast.error(errMsg(e, "Could not add."));
    }
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="Add back paper"
      subtitle="For seniors whose earlier results are not in the software yet."
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Close
          </button>
          <button onClick={save} disabled={busy || !regNo.trim() || !codes.trim()} className={btn.primary}>
            {busy ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Register number</span>
        <input
          value={regNo}
          onChange={(e) => setRegNo(e.target.value.toUpperCase())}
          placeholder="103CS25012"
          className={`${field} mt-1.5 uppercase tracking-wide`}
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-800">Subject codes</span>
        <span className="block text-xs text-slate-500">Separate with commas, e.g. 25SC11T0, 25CS11T0</span>
        <input
          value={codes}
          onChange={(e) => setCodes(e.target.value.toUpperCase())}
          placeholder="25SC11T0"
          className={`${field} mt-1.5 uppercase tracking-wide`}
        />
      </label>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
        The subject is marked eligible (IA carried forward). Refreshing the registration keeps it. You can remove it from the
        student’s row if added by mistake.
      </p>
    </Modal>
  );
}

function EditExam({ exam, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [form, setForm] = useState({
    name: exam.name,
    academicYear: exam.academicYear,
    semesters: exam.semesters,
    backPapers: exam.backPapers,
    minAttendance: exam.minAttendance,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("patch", `/exams/${exam._id}`, { ...form, minAttendance: Number(form.minAttendance) });
      toast.success(r.data.message || "Saved.", 7000);
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Edit examination"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !form.semesters.length} className={btn.primary}>
            Save
          </button>
        </>
      }
    >
      <ExamForm value={form} onChange={setForm} />
    </Modal>
  );
}
