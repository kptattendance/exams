"use client";

// Written (theory) exam – one session at a time, as the Chief Examiner runs it:
//   1. Question papers  (print from 1 hour before – "Question papers today")
//   2. Rooms            allot register numbers to rooms, print the room diaries
//   3. Absentees        from 30 minutes after the start until the session ends
//   4. Coding           done by the COE (Valuation) once absentees are in
// The server enforces the times; this screen only shows them.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const SESSION = { FN: "Morning (FN)", AN: "Afternoon (AN)" };
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const STATE = {
  BEFORE: { label: "Not yet", chip: "bg-slate-100 text-slate-600" },
  OPEN: { label: "Open now", chip: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "Closed", chip: "bg-red-100 text-red-700" },
};
// a light colour per paper, so that the papers of one session stand apart
const PAPER_TINTS = ["bg-cyan-50", "bg-violet-50", "bg-lime-50", "bg-pink-50", "bg-teal-50", "bg-indigo-50", "bg-fuchsia-50", "bg-emerald-50"];
const PAPER_CHIPS = ["bg-cyan-100 text-cyan-900", "bg-violet-100 text-violet-900", "bg-lime-100 text-lime-900", "bg-pink-100 text-pink-900", "bg-teal-100 text-teal-900", "bg-indigo-100 text-indigo-900", "bg-fuchsia-100 text-fuchsia-900", "bg-emerald-100 text-emerald-900"];

export default function ExamSessions({ qpHref = "/chief-examiner", codingHref = "" }) {
  const api = useApi();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [key, setKey] = useState(""); // examId|date|session

  const loadList = useCallback(async () => {
    try {
      const r = await api("get", "/exam-sessions");
      const list = r.data.data || [];
      setSessions(list);
      // today's open session first, else the next one to come, else the last
      setKey((k) => {
        if (k) return k;
        const now = Date.now();
        const pick = list.find((s) => s.today && new Date(s.endsAt) > now) || list.find((s) => new Date(s.endsAt) > now) || list[list.length - 1];
        return pick ? `${pick.examId}|${pick.date}|${pick.session}` : "";
      });
    } catch (e) {
      setSessions([]);
      toast.error(errMsg(e, "Could not load the exam sessions."));
    }
  }, [api, toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Exam sessions – rooms &amp; absentees</h2>
      <p className="mt-1 text-sm text-slate-500">Written examinations, one session (date + morning / afternoon) at a time.</p>

      {sessions === null && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />}
      {sessions?.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No published time table. The COE publishes the time table first.
        </p>
      )}

      {sessions?.length > 0 && (
        <label className="mt-4 block max-w-xl">
          <span className="text-xs font-semibold text-slate-500">Session</span>
          <select value={key} onChange={(e) => setKey(e.target.value)} className={`${field} mt-1`}>
            {sessions.map((s) => (
              <option key={`${s.examId}|${s.date}|${s.session}`} value={`${s.examId}|${s.date}|${s.session}`}>
                {s.today ? "TODAY · " : ""}
                {day(s.date)} · {SESSION[s.session]} · {s.papers.join(", ")}
              </option>
            ))}
          </select>
        </label>
      )}

      {key && <Session key={key} id={key} qpHref={qpHref} codingHref={codingHref} />}
    </div>
  );
}

function Session({ id, qpHref, codingHref }) {
  const api = useApi();
  const toast = useToast();
  const [examId, date, session] = id.split("|");
  const path = `/exam-sessions/${examId}/${date}/${session}`;
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("rooms");

  const load = useCallback(async () => {
    try {
      const r = await api("get", path);
      setD(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the session."));
    }
  }, [api, path, toast]);

  useEffect(() => {
    load();
    // the open / closed state changes with the clock
    const t = setInterval(() => api("get", path).then((r) => setD((old) => (old ? { ...old, times: r.data.times } : r.data))).catch(() => {}), 60 * 1000);
    return () => clearInterval(t);
  }, [load, api, path]);

  if (!d) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />;

  const tint = Object.fromEntries(d.papers.map((p, i) => [p.code, i % PAPER_TINTS.length]));
  const anyCoded = d.papers.some((p) => p.coded);
  const allCoded = d.papers.length > 0 && d.papers.every((p) => p.coded);
  const t = d.times;
  const steps = [
    { n: 1, title: "Question papers", when: `from ${time(t.printOpensAt)}`, state: t.print, href: qpHref },
    { n: 2, title: "Rooms & room diary", when: `until ${time(t.endsAt)}`, state: t.absent === "CLOSED" ? "CLOSED" : "OPEN", tab: "rooms" },
    { n: 3, title: "Mark absentees", when: `${time(t.absentOpensAt)} – ${time(t.endsAt)}`, state: t.absent, tab: "absent" },
    { n: 4, title: "Coding (COE)", when: allCoded ? "coded" : anyCoded ? "partly coded" : "after absentees", state: allCoded ? "DONE" : "BEFORE", href: codingHref },
  ];

  return (
    <>
      {/* the four steps with their times */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => {
          const st = s.state === "DONE" ? { label: "Done", chip: "bg-emerald-100 text-emerald-800" } : STATE[s.state];
          const box = (
            <div className={`h-full rounded-xl border p-3 ${s.state === "OPEN" ? "border-emerald-300 bg-emerald-50/60" : s.state === "CLOSED" ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{s.n}</span>
                <p className="flex-1 text-sm font-semibold text-slate-900">{s.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.when}</p>
            </div>
          );
          if (s.tab) return <li key={s.n}><button onClick={() => setTab(s.tab)} className="block h-full w-full text-left">{box}</button></li>;
          if (s.href) return <li key={s.n}><Link href={s.href}>{box}</Link></li>;
          return <li key={s.n}>{box}</li>;
        })}
      </ol>

      {/* papers of the session */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Paper</th>
              <th className="px-3 py-2 text-right">Candidates</th>
              <th className="px-3 py-2 text-right">Absent</th>
              <th className="px-3 py-2">Coding</th>
            </tr>
          </thead>
          <tbody>
            {d.papers.map((p) => (
              <tr key={p.code} className={`border-t border-slate-100 ${PAPER_TINTS[tint[p.code]]}`}>
                <td className="px-3 py-2">
                  <b>{p.code}</b> <span className="text-slate-600">{p.name}</span>
                  {p.drawing && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">Drawing · 4 hours</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.candidates}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${p.absent ? "font-bold text-red-700" : ""}`}>{p.absent}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.coded ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                    {p.coded ? "Coded" : "Not coded yet"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {[
          ["rooms", "Rooms & room diary"],
          ["absent", "Absentees"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-slate-900 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "rooms" ? (
        <Rooms d={d} path={path} tint={tint} onSaved={load} />
      ) : (
        <Absentees d={d} path={path} tint={tint} locked={anyCoded} onSaved={load} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ rooms

function Rooms({ d, path, tint, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const closed = d.times.absent === "CLOSED";
  const [rooms, setRooms] = useState(() => d.rooms.map((r) => ({ name: r.name, invigilator: r.invigilator, students: [...r.students] })));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState(d.rooms[0]?.name || "");
  const [newRoom, setNewRoom] = useState("");
  const [size, setSize] = useState("30");
  const [paper, setPaper] = useState("");
  const [show, setShow] = useState("ALL"); // ALL | FREE | <room name>
  const [q, setQ] = useState("");

  const roomOf = useMemo(() => {
    const m = new Map();
    for (const r of rooms) for (const n of r.students) m.set(n, r.name);
    return m;
  }, [rooms]);
  const free = d.candidates.filter((c) => !roomOf.has(c.registerNumber));
  const list = d.candidates.filter(
    (c) =>
      (!paper || c.code === paper) &&
      (show === "ALL" || (show === "FREE" ? !roomOf.has(c.registerNumber) : roomOf.get(c.registerNumber) === show)) &&
      (!q || `${c.registerNumber} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  );

  const change = (fn) => {
    setRooms((rs) => fn(rs.map((r) => ({ ...r, students: [...r.students] }))));
    setDirty(true);
  };
  const addRoom = () => {
    const name = newRoom.trim();
    if (!name) return;
    if (rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) return toast.error("A room with this name is already there.");
    change((rs) => [...rs, { name, invigilator: "", students: [] }]);
    setTarget(name);
    setNewRoom("");
  };
  const put = (numbers, room) =>
    change((rs) => {
      for (const r of rs) r.students = r.students.filter((n) => !numbers.includes(n));
      const t = rs.find((r) => r.name === room);
      if (t) t.students.push(...numbers);
      for (const r of rs) r.students.sort();
      return rs;
    });
  const putPicked = () => {
    if (!target) return toast.error("Add a room first.");
    put([...picked], target);
    setPicked(new Set());
  };
  // the next N not-allotted candidates (shown order, i.e. register-number order) go to the room
  const fillNext = () => {
    if (!target) return toast.error("Add a room first.");
    const n = Math.max(1, Number(size) || 30);
    const next = list.filter((c) => !roomOf.has(c.registerNumber)).slice(0, n).map((c) => c.registerNumber);
    if (!next.length) return toast.error("Everybody in this list is already in a room.");
    put(next, target);
  };
  const removeRoom = async (name) => {
    const ok = await confirm({ title: `Remove ${name}?`, message: "Its students become “not allotted”.", confirmText: "Remove", tone: "danger" });
    if (ok) change((rs) => rs.filter((r) => r.name !== name));
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("put", `${path}/rooms`, { rooms });
      toast.success(r.data.message, 6000);
      setDirty(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the rooms."), 8000);
    }
    setBusy(false);
  };
  const [examId, date, session] = path.split("/").slice(2);
  const print = (room) => `/print/exam-room/${examId}?date=${date}&session=${session}${room ? `&room=${encodeURIComponent(room)}` : ""}`;

  return (
    <div className="pb-24">
      {closed && <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700">The session is over – rooms can only be viewed and printed.</p>}

      {/* rooms */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rooms.map((r) => (
          <div key={r.name} className={`rounded-xl border p-3 ${target === r.name ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200"} bg-white`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setTarget(r.name)} className="flex-1 text-left text-sm font-bold text-slate-950">
                {r.name}
              </button>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{r.students.length}</span>
            </div>
            <input
              value={r.invigilator}
              disabled={closed}
              onChange={(e) => change((rs) => rs.map((x) => (x.name === r.name ? { ...x, invigilator: e.target.value } : x)))}
              placeholder="Invigilator (optional)"
              className="mt-2 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => setShow(r.name)} className={btn.small}>
                Show
              </button>
              {!dirty && r.students.length > 0 && (
                <a href={print(r.name)} target="_blank" rel="noreferrer" className={btn.small}>
                  <Icon name="download" className="h-3.5 w-3.5" />
                  Room diary
                </a>
              )}
              {!closed && (
                <button onClick={() => removeRoom(r.name)} className={`${btn.small} !text-red-700`}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {!closed && (
          <div className="rounded-xl border border-dashed border-slate-300 p-3">
            <p className="text-xs font-semibold text-slate-500">Add a room</p>
            <div className="mt-2 flex gap-1.5">
              <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoom()} placeholder="e.g. Room 12" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs" />
              <button onClick={addRoom} className={btn.small}>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${free.length ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>
          {free.length ? `${free.length} of ${d.candidates.length} not allotted` : `All ${d.candidates.length} allotted ✓`}
        </span>
        {dirty && <span className="text-xs text-orange-700">Save the rooms to print the room diaries.</span>}
      </div>

      {/* allotting */}
      {!closed && rooms.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="text-xs text-slate-600">
            Room
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm">
              {rooms.map((r) => (
                <option key={r.name}>{r.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            How many
            <input type="number" min="1" value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 block h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
          <button onClick={fillNext} className={btn.primary}>
            Put the next {Math.max(1, Number(size) || 30)} not-allotted in {target || "the room"}
          </button>
          <button onClick={putPicked} disabled={!picked.size} className={btn.secondary}>
            Put {picked.size || ""} ticked in {target || "the room"}
          </button>
        </div>
      )}

      {/* filters */}
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no. or name" className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm" />
        <select value={paper} onChange={(e) => setPaper(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">All papers</option>
          {d.papers.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code}
            </option>
          ))}
        </select>
        <select value={show} onChange={(e) => setShow(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="ALL">Everybody</option>
          <option value="FREE">Not allotted only</option>
          {rooms.map((r) => (
            <option key={r.name} value={r.name}>
              In {r.name}
            </option>
          ))}
        </select>
      </div>

      <CandidateTable
        rows={list}
        tint={tint}
        picked={closed ? null : picked}
        setPicked={setPicked}
        extra={(c) =>
          roomOf.get(c.registerNumber) ? (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">{roomOf.get(c.registerNumber)}</span>
          ) : (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Not allotted</span>
          )
        }
        extraHead="Room"
        rowClass={(c) => (roomOf.has(c.registerNumber) ? "" : "!bg-orange-50/70")}
      />

      {/* printing – at the end of the page */}
      {rooms.some((r) => r.students.length) && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mr-auto text-sm text-slate-600">
            {dirty
              ? "Save the rooms first, then print."
              : `${rooms.filter((r) => r.students.length).length} room diaries · ${d.candidates.length - free.length} students`}
            {free.length > 0 && !dirty && <span className="font-semibold text-orange-700"> · {free.length} not allotted yet</span>}
          </p>
          {dirty ? (
            <span className={`${btn.primary} pointer-events-none opacity-40`}>
              <Icon name="download" className="h-4 w-4" />
              Print all room diaries
            </span>
          ) : (
            <a href={print("")} target="_blank" rel="noreferrer" className={btn.primary}>
              <Icon name="download" className="h-4 w-4" />
              Print all room diaries
            </a>
          )}
        </div>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">Rooms changed – not saved yet.</p>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busy ? "Saving…" : "Save rooms"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ absentees

function Absentees({ d, path, tint, locked, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [absent, setAbsent] = useState(() => new Set(d.candidates.filter((c) => c.attendance === "ABSENT").map((c) => c.registerNumber)));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState("");
  const [paper, setPaper] = useState("");
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState("");
  const t = d.times;
  const open = t.absent === "OPEN" && !locked;

  const list = d.candidates.filter(
    (c) =>
      (!room || c.room === room) &&
      (!paper || c.code === paper) &&
      (!onlyAbsent || absent.has(c.registerNumber)) &&
      (!q || `${c.registerNumber} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  );
  const toggle = (n) => {
    setAbsent((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });
    setDirty(true);
  };
  // register numbers typed / pasted from the room diaries
  const addPasted = () => {
    const known = new Set(d.candidates.map((c) => c.registerNumber));
    const nums = [...new Set(paste.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
    const bad = nums.filter((n) => !known.has(n));
    setAbsent((s) => new Set([...s, ...nums.filter((n) => known.has(n))]));
    setDirty(true);
    setPaste("");
    if (bad.length) toast.error(`Not in this session: ${bad.join(", ")}`, 8000);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `${path}/absent`, { absent: [...absent] });
      toast.success(r.data.message, 6000);
      setDirty(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the absentees."), 8000);
    }
    setBusy(false);
  };

  return (
    <div className="pb-24">
      <div
        className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          locked ? "bg-slate-100 text-slate-700" : t.absent === "OPEN" ? "bg-emerald-50 text-emerald-900" : t.absent === "BEFORE" ? "bg-orange-50 text-orange-900" : "bg-red-50 text-red-800"
        }`}
      >
        {locked
          ? "A paper of this session is already coded – absentees can no longer be changed."
          : t.absent === "OPEN"
          ? `Open now until ${time(t.endsAt)}. Mark the students written “Absent” in the room diaries, then Save.`
          : t.absent === "BEFORE"
          ? `Absentees can be marked from ${time(t.absentOpensAt)} (30 minutes after the start) until ${time(t.endsAt)} on ${day(d.date)}.`
          : "The session is over – absentees can no longer be marked here. Ask the COE office for any correction."}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{absent.size} absent</span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{d.candidates.length - absent.size} present</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no. or name" className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm" />
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">All rooms</option>
          {d.rooms.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>
        <select value={paper} onChange={(e) => setPaper(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">All papers</option>
          {d.papers.map((p) => (
            <option key={p.code}>{p.code}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} className="h-4 w-4" />
          Absent only
        </label>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="min-w-0 flex-1 text-xs text-slate-600">
            Or type / paste the absent register numbers
            <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="103CS26004, 103CS26017 …" className="mt-1 block h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
          <button onClick={addPasted} disabled={!paste.trim()} className={btn.secondary}>
            Mark absent
          </button>
        </div>
      )}

      <CandidateTable
        rows={list}
        tint={tint}
        extraHead="Present / Absent"
        rowClass={(c) => (absent.has(c.registerNumber) ? "!bg-red-50" : "")}
        extra={(c) => (
          <button
            onClick={() => toggle(c.registerNumber)}
            disabled={!open}
            className={`rounded-lg border px-3 py-1 text-xs font-bold disabled:cursor-not-allowed ${
              absent.has(c.registerNumber) ? "border-red-600 bg-red-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-800"
            } ${!open ? "opacity-60" : ""}`}
          >
            {absent.has(c.registerNumber) ? "ABSENT" : "Present"}
          </button>
        )}
        showRoom
      />

      {dirty && open && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">{absent.size} absent – not saved yet.</p>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busy ? "Saving…" : "Save absentees"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the candidate table

function CandidateTable({ rows, tint, picked, setPicked, extra, extraHead, rowClass, showRoom }) {
  const all = picked && rows.length > 0 && rows.every((c) => picked.has(c.registerNumber));
  return (
    <div className="mt-3 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            {picked && (
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={() => setPicked(all ? new Set() : new Set(rows.map((c) => c.registerNumber)))}
                  aria-label="Tick all shown"
                  className="h-4 w-4"
                />
              </th>
            )}
            <th className="w-12 px-3 py-2">Sl.</th>
            <th className="px-3 py-2">Register No.</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Class</th>
            <th className="px-3 py-2">Paper</th>
            {showRoom && <th className="px-3 py-2">Room</th>}
            <th className="px-3 py-2">{extraHead}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c._id} className={`border-t border-slate-100 ${PAPER_TINTS[tint[c.code]]} ${rowClass ? rowClass(c) : ""}`}>
              {picked && (
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={picked.has(c.registerNumber)}
                    onChange={() =>
                      setPicked((s) => {
                        const x = new Set(s);
                        if (x.has(c.registerNumber)) x.delete(c.registerNumber);
                        else x.add(c.registerNumber);
                        return x;
                      })
                    }
                    className="h-4 w-4"
                  />
                </td>
              )}
              <td className="px-3 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
              <td className="px-3 py-1.5 font-semibold tabular-nums text-slate-900">{c.registerNumber}</td>
              <td className="px-3 py-1.5 text-slate-700">{c.name}</td>
              <td className="px-3 py-1.5 text-xs text-slate-600">
                {String(c.department || "").toUpperCase()} · Sem {c.semester}
                {c.kind === "BACKLOG" && <span className="ml-1 font-semibold text-orange-700">(back paper)</span>}
              </td>
              <td className="px-3 py-1.5">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${PAPER_CHIPS[tint[c.code]]}`}>{c.code}</span>
              </td>
              {showRoom && <td className="px-3 py-1.5 text-xs text-slate-700">{c.room || "–"}</td>}
              <td className="px-3 py-1.5">{extra(c)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                Nobody matches the filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
