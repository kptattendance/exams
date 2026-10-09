"use client";

// One examination: register students, see who may write which subject,
// change a decision (with reason), add back papers by hand, download Excel.
// COE/Admin: canManage. Exam Officer / Principal: view only.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { ExamForm } from "./ExamList";
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

const PAGE_SIZE = 40;

export default function ExamDetail({ id, basePath, canManage = false, bridgeHref, feesHref }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [gen, setGen] = useState(null); // progress while registering
  const [editing, setEditing] = useState(false);
  const [addingBack, setAddingBack] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [filters, setFilters] = useState({ cls: "", overall: "", issue: "", q: "" });

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
          "Subjects and eligibility are worked out again from the latest IA, attendance, electives and bridge-course settings.\n\nYour changed decisions, back papers added by hand and fee entries are kept.",
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
          {canManage && (
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
              <button onClick={remove} className={btn.danger} title="Delete examination">
                <Icon name="trash" className="h-4 w-4" />
                <span className="sm:hidden lg:inline">Delete</span>
              </button>
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
            . This exam uses {exam.academicYear}: the HOD should open the sheet with academic year {exam.academicYear}, or edit this
            exam’s academic year if that is wrong.
          </Banner>
        )}
        {registered && relevantNotReady.length > 0 && (
          <Banner tone="blue" icon="list" title={`IA or attendance not frozen yet for ${relevantNotReady.length} classes`}>
            Students of those classes show as “Waiting”. Once the Exam Officer freezes them, click Refresh registration.
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
          <SheetStatus readiness={exam.readiness} semesters={exam.semesters} />
        </div>
      )}

      {registered && (
        <>
          {/* ------------------------------------------------ tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile n={totalStudents} label="Students" onClick={() => setFilters((f) => ({ ...f, overall: "" }))} active={!filters.overall} />
            {["ALL_CLEAR", "PARTIAL", "BLOCKED", "PENDING"].map((k) => (
              <Tile
                key={k}
                n={sum(k)}
                label={OVERALL[k].short}
                dot={OVERALL[k].dot}
                active={filters.overall === k}
                onClick={() => setFilters((f) => ({ ...f, overall: f.overall === k ? "" : k }))}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Subjects: <b className="text-emerald-700">{exam.subjectCounts.ELIGIBLE}</b> eligible ·{" "}
            <button className="font-semibold text-red-700 hover:underline" onClick={() => setFilters((f) => ({ ...f, issue: "ANS" }))}>
              {exam.subjectCounts.ANS} attendance shortage
            </button>{" "}
            ·{" "}
            <button className="font-semibold text-orange-700 hover:underline" onClick={() => setFilters((f) => ({ ...f, issue: "NE" }))}>
              {exam.subjectCounts.NE} IA below minimum
            </button>{" "}
            · {exam.subjectCounts.PENDING} waiting
          </p>
          {exam.feeCounts && (
            <p className="mt-1 text-sm text-slate-500">
              Fees: <b className="text-emerald-700">{exam.feeCounts.PAID}</b> fully paid ·{" "}
              <b className="text-orange-700">{exam.feeCounts.PARTIAL}</b> partly paid ·{" "}
              <b className="text-red-700">{exam.feeCounts.UNPAID}</b> not paid
              {feesHref && (
                <Link href={feesHref} className="ml-2 font-semibold text-blue-700 hover:underline">
                  Open fee verification →
                </Link>
              )}
            </p>
          )}

          {/* ------------------------------------------------ classes */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <ClassTable classes={exam.classes} selected={filters.cls} onSelect={(cls) => setFilters((f) => ({ ...f, cls }))} onDownload={download} />
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <SheetStatus readiness={exam.readiness} semesters={exam.semesters} compact />
            </div>
          </div>

          {/* ------------------------------------------------ students */}
          <StudentList
            key={listKey}
            examId={id}
            classes={exam.classes}
            filters={filters}
            setFilters={setFilters}
            canManage={canManage}
            onChanged={load}
          />
        </>
      )}

      {/* ------------------------------------------------ modals */}
      {gen && <ProgressModal gen={gen} />}
      {canManage && editing && (
        <EditExam exam={exam} onClose={() => setEditing(false)} onSaved={(e) => (setEditing(false), load())} />
      )}
      {canManage && (
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

function Tile({ n, label, dot, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border bg-white px-4 py-3 text-left transition hover:border-slate-300 ${
        active ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-200"
      }`}
    >
      <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-950">{n}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </p>
    </button>
  );
}

function ClassTable({ classes, selected, onSelect, onDownload }) {
  const [all, setAll] = useState(false);
  const LIMIT = 8;
  const shown = all || classes.length <= LIMIT + 2 ? classes : classes.slice(0, LIMIT);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <p className="font-semibold text-slate-900">Class-wise</p>
        {selected && (
          <button onClick={() => onSelect("")} className="text-xs font-semibold text-blue-700 hover:underline">
            Show all classes
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500">
              <th className="px-5 py-2.5">Class</th>
              <th className="px-2 py-2.5 text-right">Students</th>
              <th className="px-2 py-2.5 text-right text-emerald-700">All clear</th>
              <th className="px-2 py-2.5 text-right text-red-600">Not permitted</th>
              <th className="px-2 py-2.5 text-right">Waiting</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((c) => {
              const on = selected === c.key;
              return (
                <tr
                  key={c.key}
                  onClick={() => onSelect(on ? "" : c.key)}
                  className={`cursor-pointer ${on ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                >
                  <td className="px-5 py-2.5">
                    {c.key === "backlog" ? (
                      <span className="font-semibold text-slate-900">Back papers only</span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-900">
                          {c.department.toUpperCase()} · Sem {c.semester}
                        </span>
                        <span className="ml-2 hidden text-xs text-slate-500 sm:inline">{deptLabel(c.department)}</span>
                      </>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{c.students}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700">{c.ALL_CLEAR}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-red-600">{c.PARTIAL + c.BLOCKED || ""}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-slate-500">{c.PENDING || ""}</td>
                  <td className="px-3 py-2.5 text-right">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length < classes.length && (
        <button
          onClick={() => setAll(true)}
          className="w-full border-t border-slate-100 py-3 text-sm font-semibold text-blue-700 hover:bg-slate-50"
        >
          Show all {classes.length} classes
        </button>
      )}
    </div>
  );
}

function SheetStatus({ readiness, semesters, compact = false }) {
  return (
    <div className={compact ? "" : "mt-8 border-t border-slate-100 pt-6"}>
      <p className="font-semibold text-slate-900">HOD sheets for this academic year</p>
      <p className="mt-0.5 text-xs text-slate-500">Only frozen IA and attendance are used.</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
        {["confirmed", "submitted", "draft", "missing"].map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${SHEET_DOT[k]}`} />
            {SHEET[k].label}
          </span>
        ))}
      </div>
      {semesters.map((s) => (
        <div key={s} className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-slate-500">Semester {s}</p>
          <div className={`grid gap-1.5 ${compact ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-8"}`}>
            {readiness
              .filter((r) => r.semester === s)
              .map((r) => (
                <div
                  key={r.department}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"
                  title={`${deptLabel(r.department)} sem ${s}: IA ${SHEET[r.ia].label}, attendance ${SHEET[r.attendance].label}`}
                >
                  <p className="text-xs font-bold text-slate-800">{r.department.toUpperCase()}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${SHEET_DOT[r.ia]}`} />
                    IA
                    <span className={`ml-1 h-2 w-2 rounded-full ${SHEET_DOT[r.attendance]}`} />
                    Att
                  </p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
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

function StudentList({ examId, classes, filters, setFilters, canManage, onChanged }) {
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
  const sel = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400";

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-lg font-bold tracking-tight text-slate-950">
          Students {data && <span className="text-sm font-medium text-slate-500">({data.total})</span>}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <div className="relative col-span-2 sm:w-56">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or register no."
              className={`${sel} w-full pl-9`}
            />
          </div>
          <select value={filters.cls} onChange={(e) => setFilters((f) => ({ ...f, cls: e.target.value }))} className={sel}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.key} value={c.key}>
                {c.key === "backlog" ? "Back papers only" : `${c.department.toUpperCase()} · Sem ${c.semester}`}
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

      {(filters.overall || filters.issue || filters.cls || filters.q) && (
        <button
          onClick={() => {
            setQ("");
            setFilters({ cls: "", overall: "", issue: "", q: "" });
          }}
          className="mt-3 text-xs font-semibold text-blue-700 hover:underline"
        >
          Clear filters
        </button>
      )}

      <div className="mt-4 space-y-2">
        {data === null &&
          [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        {data && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No students match these filters.
          </p>
        )}
        {items.map((reg) => (
          <StudentRow
            key={reg._id}
            reg={reg}
            open={open === reg._id}
            onToggle={() => setOpen(open === reg._id ? null : reg._id)}
            canManage={canManage}
            onOverride={(s) => setOverriding({ reg, subject: s })}
            onRemove={(s) => removeManual(reg, s)}
          />
        ))}
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

function StudentRow({ reg, open, onToggle, canManage, onOverride, onRemove }) {
  const o = OVERALL[reg.overall];
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition ${open ? "border-slate-300 shadow-sm" : "border-slate-200"}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:items-center" aria-expanded={open}>
        {reg.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reg.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {initials(reg.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="truncate font-semibold text-slate-950">{reg.name}</p>
            <p className="text-xs font-semibold tabular-nums text-slate-500">{reg.registerNumber}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {reg.department.toUpperCase()} · Sem {reg.semester} · {ADMISSION_SHORT[reg.admissionType] || reg.admissionType}
            {reg.warnings?.length > 0 && <span className="ml-2 font-semibold text-orange-700">⚠ {reg.warnings.length}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>
        <span className={`hidden shrink-0 items-center gap-1.5 text-xs font-semibold sm:flex ${o.text}`}>
          <span className={`h-2 w-2 rounded-full ${o.dot}`} />
          {o.short}
        </span>
        <Icon name="chevronRight" className={`mt-1 h-5 w-5 shrink-0 text-slate-300 transition sm:mt-0 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
          <p className={`mb-3 flex items-center gap-1.5 text-sm font-semibold sm:hidden ${o.text}`}>
            <span className={`h-2 w-2 rounded-full ${o.dot}`} />
            {o.label}
          </p>
          {reg.warnings?.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-900">
              {reg.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            {reg.subjects.map((s) => (
              <SubjectLine key={s.subject} s={s} canManage={canManage} onOverride={() => onOverride(s)} onRemove={() => onRemove(s)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectLine({ s, canManage, onOverride, onRemove }) {
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
          {canManage && s.source === "MANUAL" && (
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
